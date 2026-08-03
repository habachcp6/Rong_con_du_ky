import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { CONFIG } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// `createApp` normally owns an API-only 404 handler for unit/API callers.
// Static hosting needs the entry point to install the SPA fallback below.
const app = await createApp({ deferNotFoundHandler: true });
const clientBuildPath = path.join(__dirname, "../../dist");

await app.register(fastifyStatic, {
  root: clientBuildPath,
  prefix: "/",
});

app.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith("/api/")) {
    return reply
      .status(404)
      .send({ error: "NOT_FOUND", message: "API route not found" });
  }
  return reply.sendFile("index.html");
});

try {
  await app.listen({ port: CONFIG.port, host: "0.0.0.0" });
  app.log.info({ port: CONFIG.port }, "Server listening");
} catch (error) {
  app.log.error(error, "Server failed to start");
  process.exit(1);
}
