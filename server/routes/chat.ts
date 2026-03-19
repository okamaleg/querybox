import type { FastifyPluginAsync } from "fastify";
import { getConnectionConfig } from "../lib/db/app-db.js";
import { getApiKey, getAppSettings } from "../lib/db/app-db.js";
import { createDriver } from "../lib/db/drivers/index.js";
import { streamChat } from "../lib/ai/chat.js";
import type Anthropic from "@anthropic-ai/sdk";

interface ChatBody {
  connectionId: string;
  messages: Anthropic.MessageParam[];
}

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // POST / — streaming chat via SSE
  fastify.post<{ Body: ChatBody }>("/", async (req, reply) => {
    const { connectionId, messages } = req.body;

    if (!connectionId) {
      return reply.status(400).send({ error: "connectionId is required" });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return reply.status(400).send({ error: "messages array is required" });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return reply.status(400).send({ error: "API key not configured. Please set it in Settings." });
    }

    const config = getConnectionConfig(connectionId);
    if (!config) {
      return reply.status(404).send({ error: "Connection not found" });
    }

    const settings = getAppSettings();

    // Introspect schema
    let schema;
    try {
      const driver = createDriver(config);
      await driver.connect();
      schema = await driver.introspect();
      await driver.disconnect();
    } catch (e) {
      return reply.status(500).send({
        error: e instanceof Error ? e.message : "Failed to connect to database",
      });
    }

    // Hijack response — Fastify won't touch it after this
    reply.hijack();

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    try {
      await streamChat(messages, config, schema, settings.safety_mode, apiKey, reply);
    } catch (e) {
      reply.raw.write(
        `data: ${JSON.stringify({ type: "error", error: e instanceof Error ? e.message : "Chat failed" })}\n\n`
      );
    }

    reply.raw.end();
  });
};

export default chatRoutes;
