import { NextResponse } from "next/server";

/**
 * Health check endpoint for Kubernetes liveness and readiness probes.
 *
 * This route is intentionally unauthenticated — K8s probes do not carry
 * application credentials. The endpoint returns minimal data to keep
 * probe responses fast and lightweight.
 *
 * GET /api/health → 200 { status: "ok", timestamp: "..." }
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
      buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "unknown",
    },
    { status: 200 }
  );
}
