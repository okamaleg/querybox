import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getConnectionConfig, getApiKey, getAppSettings } from "@/lib/db/app-db";
import { createDriver } from "@/lib/db/drivers";
import { createDatabaseTools } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";

export const maxDuration = 120;

export async function POST(request: Request) {
  const { messages, connectionId } = await request.json();

  // Validate API key
  const apiKey = getApiKey();
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "API key not configured. Go to Settings to add your Claude API key." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get connection config
  const config = getConnectionConfig(connectionId);
  if (!config) {
    return new Response(
      JSON.stringify({ error: "Database connection not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get schema for system prompt
  const driver = createDriver(config);
  let schema;
  try {
    await driver.connect();
    schema = await driver.introspect();
    await driver.disconnect();
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: `Failed to connect to database: ${e instanceof Error ? e.message : "Unknown error"}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const settings = getAppSettings();
  const systemPrompt = buildSystemPrompt(schema, settings.safety_mode);
  const tools = createDatabaseTools(config, settings.safety_mode);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514", { apiKey }),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 10,
  });

  return result.toDataStreamResponse();
}
