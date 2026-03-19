import Fastify from "fastify";
import cors from "@fastify/cors";
import connectionsRoutes from "./routes/connections.js";
import chatRoutes from "./routes/chat.js";
import settingsRoutes from "./routes/settings.js";

const PORT = 3099;

export async function startServer() {
  const fastify = Fastify({
    logger: true,
  });

  // CORS — allow Vite dev server
  await fastify.register(cors, {
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Routes
  await fastify.register(connectionsRoutes, { prefix: "/api/connections" });
  await fastify.register(chatRoutes, { prefix: "/api/chat" });
  await fastify.register(settingsRoutes, { prefix: "/api/settings" });

  // Health check
  fastify.get("/api/health", async () => ({ ok: true }));

  try {
    await fastify.listen({ port: PORT, host: "127.0.0.1" });
    console.log(`Querybox server listening on http://127.0.0.1:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  return fastify;
}

// Start when run directly
startServer();
