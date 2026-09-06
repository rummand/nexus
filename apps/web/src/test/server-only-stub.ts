/**
 * Stands in for the `server-only` package under Vitest.
 *
 * That package deliberately throws when resolved through the client condition, which is what
 * stops a server module reaching a browser bundle. A test runner is neither environment, so it
 * would throw for no reason; see vitest.config.ts.
 */
export {};
