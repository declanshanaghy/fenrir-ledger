/**
 * GET /health — Liveness probe.
 *
 * Returns a JSON object with server status, service name, and ISO timestamp.
 * Used by Fly.io health checks, monitoring, and the frontend availability probe.
 */

import { z } from "zod";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

const health = new OpenAPIHono();

/**
 * Response schema for the health endpoint.
 */
const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  ts: z.string(),
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Liveness probe",
  description:
    "Returns server status, service name, and current ISO timestamp. " +
    "Used by Fly.io health checks, monitoring, and the frontend availability probe.",
  responses: {
    200: {
      description: "Server is healthy",
      content: {
        "application/json": {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

health.openapi(healthRoute, (c) => {
  return c.json(
    {
      status: "ok" as const,
      service: "fenrir-ledger-backend",
      ts: new Date().toISOString(),
    },
    200,
  );
});

export default health;
