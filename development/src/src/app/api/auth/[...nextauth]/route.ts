/**
 * Auth.js v5 — Next.js API Route Handler
 *
 * Mounts the Auth.js request handler at /api/auth/*.
 * All OAuth callbacks, sign-in, and sign-out flows route through here.
 *
 * This file is intentionally minimal — all configuration lives in src/auth.ts.
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
