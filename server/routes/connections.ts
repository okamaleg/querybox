import type { FastifyPluginAsync } from "fastify";
import {
  createConnection,
  getConnections,
  getConnection,
  getConnectionConfig,
  updateConnection,
  deleteConnection,
} from "../lib/db/app-db.js";
import { createDriver } from "../lib/db/drivers/index.js";
import { createConnectionSchema } from "../lib/schemas.js";

const connectionsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET / — list all connections (strip config_encrypted)
  fastify.get("/", async (_req, reply) => {
    const connections = getConnections().map(({ config_encrypted: _ce, ...rest }) => rest);
    return reply.send(connections);
  });

  // POST / — create connection
  fastify.post("/", async (req, reply) => {
    const parsed = createConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const connection = createConnection(parsed.data.name, parsed.data.config);
    const { config_encrypted: _ce, ...safe } = connection;
    return reply.status(201).send(safe);
  });

  // GET /:id — get single connection
  fastify.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const connection = getConnection(req.params.id);
    if (!connection) return reply.status(404).send({ error: "Connection not found" });

    const { config_encrypted: _ce, ...safe } = connection;
    return reply.send(safe);
  });

  // PUT /:id — update connection
  fastify.put<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const parsed = createConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const updated = updateConnection(req.params.id, parsed.data.name, parsed.data.config);
    if (!updated) return reply.status(404).send({ error: "Connection not found" });

    const { config_encrypted: _ce, ...safe } = updated;
    return reply.send(safe);
  });

  // DELETE /:id — delete connection
  fastify.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const deleted = deleteConnection(req.params.id);
    if (!deleted) return reply.status(404).send({ error: "Connection not found" });
    return reply.status(204).send();
  });

  // POST /:id/test — test connection
  fastify.post<{ Params: { id: string } }>("/:id/test", async (req, reply) => {
    const config = getConnectionConfig(req.params.id);
    if (!config) return reply.status(404).send({ error: "Connection not found" });

    const driver = createDriver(config);
    const result = await driver.testConnection();
    return reply.send(result);
  });

  // GET /:id/schema — introspect schema
  fastify.get<{ Params: { id: string } }>("/:id/schema", async (req, reply) => {
    const config = getConnectionConfig(req.params.id);
    if (!config) return reply.status(404).send({ error: "Connection not found" });

    try {
      const driver = createDriver(config);
      await driver.connect();
      const schema = await driver.introspect();
      await driver.disconnect();
      return reply.send(schema);
    } catch (e) {
      return reply.status(500).send({
        error: e instanceof Error ? e.message : "Failed to introspect schema",
      });
    }
  });
};

export default connectionsRoutes;
