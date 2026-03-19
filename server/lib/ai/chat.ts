import Anthropic from "@anthropic-ai/sdk";
import type { FastifyReply } from "fastify";
import { createDriver } from "../db/drivers/index.js";
import { validateSQL } from "./validator.js";
import { buildSystemPrompt } from "./system-prompt.js";
import type { ConnectionConfig, DatabaseSchema } from "../schemas.js";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 8192;

type AnthropicMessage = Anthropic.MessageParam;

function sseWrite(reply: FastifyReply, data: unknown): void {
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  config: ConnectionConfig,
  safetyMode: boolean
): Promise<unknown> {
  const driver = createDriver(config);

  if (toolName === "run_query") {
    const query = (toolInput.query as string) ?? "";
    const validation = validateSQL(query, safetyMode);

    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        query,
      };
    }

    try {
      await driver.connect();
      const result = await driver.query(query);
      await driver.disconnect();
      return { success: true, query, ...result };
    } catch (e) {
      await driver.disconnect().catch(() => {});
      return {
        success: false,
        error: e instanceof Error ? e.message : "Query execution failed",
        query,
      };
    }
  }

  if (toolName === "explain_query") {
    const query = (toolInput.query as string) ?? "";
    const isMongo = config.type === "mongodb";

    if (isMongo) {
      return { success: false, error: "EXPLAIN is not supported for MongoDB" };
    }

    let explainQuery: string;
    if (config.type === "postgresql") {
      explainQuery = `EXPLAIN ANALYZE ${query}`;
    } else if (config.type === "mysql") {
      explainQuery = `EXPLAIN ${query}`;
    } else {
      explainQuery = `EXPLAIN QUERY PLAN ${query}`;
    }

    try {
      await driver.connect();
      const result = await driver.query(explainQuery);
      await driver.disconnect();
      return { success: true, original_query: query, ...result };
    } catch (e) {
      await driver.disconnect().catch(() => {});
      return {
        success: false,
        error: e instanceof Error ? e.message : "Failed to explain query",
        original_query: query,
      };
    }
  }

  if (toolName === "get_table_sample") {
    const tableName = (toolInput.table_name as string) ?? "";
    const limit = Math.min(Math.max(1, (toolInput.limit as number) ?? 5), 50);
    const isMongo = config.type === "mongodb";

    // Validate table/collection name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(tableName)) {
      return { success: false, error: "Invalid table name" };
    }

    try {
      await driver.connect();
      let result;
      if (isMongo) {
        result = await driver.query(
          JSON.stringify({
            collection: tableName,
            operation: "find",
            filter: {},
            limit,
          })
        );
      } else {
        result = await driver.query(`SELECT * FROM "${tableName}" LIMIT ${limit}`);
      }
      await driver.disconnect();
      return {
        success: true,
        table: tableName,
        columns: result.columns,
        rows: result.rows,
        row_count: result.row_count,
      };
    } catch (e) {
      await driver.disconnect().catch(() => {});
      return {
        success: false,
        error: e instanceof Error ? e.message : "Failed to sample table",
        table: tableName,
      };
    }
  }

  return { success: false, error: `Unknown tool: ${toolName}` };
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "run_query",
    description:
      "Execute a SQL or MongoDB query against the connected database and return the results. For MongoDB, pass a JSON string with collection, operation, filter, etc.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The SQL query to execute, or for MongoDB a JSON string like {\"collection\":\"name\",\"operation\":\"find\",\"filter\":{},\"limit\":100}",
        },
        explanation: {
          type: "string",
          description: "Brief explanation of what this query does and why",
        },
      },
      required: ["query", "explanation"],
    },
  },
  {
    name: "explain_query",
    description:
      "Get the execution plan for a SQL query using EXPLAIN/EXPLAIN ANALYZE. Use this to help users understand or optimize their queries.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The SQL query to explain",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_table_sample",
    description:
      "Get a sample of rows from a specific table or collection. Useful to understand data patterns before writing complex queries.",
    input_schema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "The table or collection name to sample from",
        },
        limit: {
          type: "number",
          description: "Number of sample rows (default 5, max 50)",
        },
      },
      required: ["table_name"],
    },
  },
];

export async function streamChat(
  messages: AnthropicMessage[],
  connectionConfig: ConnectionConfig,
  schema: DatabaseSchema,
  safetyMode: boolean,
  apiKey: string,
  reply: FastifyReply
): Promise<void> {
  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(schema, safetyMode);

  const conversationMessages: AnthropicMessage[] = [...messages];

  // Agentic loop: stream -> detect tool_use -> execute -> continue
  while (true) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: TOOLS,
      messages: conversationMessages,
    });

    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
    let assistantText = "";

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          assistantText += event.delta.text;
          sseWrite(reply, { type: "text", content: event.delta.text });
        } else if (event.delta.type === "input_json_delta") {
          // tool input streaming — accumulate silently
        }
      } else if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          sseWrite(reply, {
            type: "tool_call",
            name: event.content_block.name,
            id: event.content_block.id,
          });
        }
      }
    }

    const finalMessage = await stream.finalMessage();

    // Collect tool_use blocks from final response
    for (const block of finalMessage.content) {
      if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    // Add assistant turn to conversation
    conversationMessages.push({
      role: "assistant",
      content: finalMessage.content,
    });

    // If no tool calls, we're done
    if (toolUseBlocks.length === 0 || finalMessage.stop_reason !== "tool_use") {
      break;
    }

    // Execute all tool calls and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      // Send full input now that we have it (streaming only sent name+id)
      sseWrite(reply, {
        type: "tool_input",
        name: toolUse.name,
        input: toolUse.input,
      });

      const result = await executeTool(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
        connectionConfig,
        safetyMode
      );

      sseWrite(reply, {
        type: "tool_result",
        name: toolUse.name,
        result,
      });

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    // Add tool results turn
    conversationMessages.push({
      role: "user",
      content: toolResults,
    });
  }

  sseWrite(reply, { type: "done" });
}
