import type { FastifyPluginAsync } from "fastify";
import {
  getAppSettings,
  getSetting,
  setSetting,
  setApiKey,
} from "../lib/db/app-db.js";
import { updateSettingsSchema } from "../lib/schemas.js";

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET / — get settings (returns has_api_key instead of raw encrypted key)
  fastify.get("/", async (_req, reply) => {
    const settings = getAppSettings();
    return reply.send({
      has_api_key: settings.api_key_encrypted !== null,
      safety_mode: settings.safety_mode,
      theme: settings.theme,
    });
  });

  // PUT / — update settings
  fastify.put("/", async (req, reply) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { api_key, safety_mode, theme } = parsed.data;

    if (api_key !== undefined) {
      setApiKey(api_key);
    }
    if (safety_mode !== undefined) {
      setSetting("safety_mode", String(safety_mode));
    }
    if (theme !== undefined) {
      setSetting("theme", theme);
    }

    const settings = getAppSettings();
    return reply.send({
      has_api_key: settings.api_key_encrypted !== null,
      safety_mode: settings.safety_mode,
      theme: settings.theme,
    });
  });
};

export default settingsRoutes;
