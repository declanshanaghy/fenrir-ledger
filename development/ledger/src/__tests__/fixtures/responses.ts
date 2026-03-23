/**
 * Shared HTTP response test fixtures — issue #1858
 *
 * Generic helpers for constructing mock fetch/API Response objects in tests.
 * Prefer these over hand-rolling `new Response(JSON.stringify(...))` in every
 * test file.
 */

/**
 * Returns a 200 JSON Response containing the provided data payload.
 * Optionally override status (e.g. 201).
 */
export function makeJsonResponse(
  data: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Returns an error JSON Response with a standard `{ error, error_description }`
 * payload.  Defaults to HTTP 400.
 */
export function makeErrorResponse(
  error: string,
  description = "",
  status = 400,
): Response {
  return new Response(
    JSON.stringify({ error, error_description: description }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}
