/**
 * Node.js ESM resolve hook — maps @fenrir/* tsconfig path aliases
 * to the correct source files at runtime.
 *
 * Registered via register.mjs (--import ./register.mjs).
 */

const baseDir = new URL(".", import.meta.url);

const aliases = [
  // Order matters: exact matches before prefix matches
  { prefix: "@fenrir/logger-base", target: "../ledger/src/lib/logger.ts", exact: true },
  { prefix: "@fenrir/logger",      target: "./src/log.ts",                  exact: true },
  { prefix: "@fenrir/",            target: "../ledger/src/" },
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
