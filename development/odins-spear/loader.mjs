/**
 * Node.js ESM resolve hook — maps @fenrir/* tsconfig path aliases
 * to the frontend source tree at runtime.
 *
 * Registered via register.mjs (--import ./register.mjs).
 */

const baseDir = new URL(".", import.meta.url);

const aliases = [
  { prefix: "@fenrir/logger", target: "../frontend/src/lib/logger.ts", exact: true },
  { prefix: "@fenrir/", target: "../frontend/src/" },
];

export function resolve(specifier, context, nextResolve) {
  for (const alias of aliases) {
    if (alias.exact && specifier === alias.prefix) {
      const resolved = new URL(alias.target, baseDir).href;
      return { url: resolved, shortCircuit: true };
    }
    if (!alias.exact && specifier.startsWith(alias.prefix)) {
      const rest = specifier.slice(alias.prefix.length);
      const resolved = new URL(alias.target + rest, baseDir).href;
      return { url: resolved, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
