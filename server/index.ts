import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import connectionsRoutes from "./routes/connections.js";
import chatRoutes from "./routes/chat.js";
import settingsRoutes from "./routes/settings.js";

const PORT = parseInt(process.env.PORT || "3099", 10);
const isDev = process.env.NODE_ENV !== "production";

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

  // API Routes
  await fastify.register(connectionsRoutes, { prefix: "/api/connections" });
  await fastify.register(chatRoutes, { prefix: "/api/chat" });
  await fastify.register(settingsRoutes, { prefix: "/api/settings" });

  // Health check
  fastify.get("/api/health", async () => ({ ok: true }));

  // In production, serve the Vite build as static files
  if (!isDev) {
    const distPath = path.join(__dirname, "..", "dist");
    await fastify.register(fastifyStatic, {
      root: distPath,
      prefix: "/",
    });

    // SPA fallback — serve index.html for all non-API routes
    fastify.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) {
        reply.status(404).send({ error: "Not found" });
      } else {
        reply.sendFile("index.html");
      }
    });
  }

  try {
    const host = isDev ? "127.0.0.1" : "0.0.0.0";
    await fastify.listen({ port: PORT, host });
    console.log(`Querybox server listening on http://127.0.0.1:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  return fastify;
}

// Start when run directly
startServer();
