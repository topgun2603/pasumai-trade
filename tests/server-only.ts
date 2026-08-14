/**
 * Test stand-in for the `server-only` package.
 *
 * The real module throws the moment it is imported outside a React Server
 * Component. Under Next that is what keeps server code — Admin credentials,
 * write validators — from being bundled into the browser. Under Vitest it just
 * means a pure validator cannot be tested, so the alias in `vitest.config.mts`
 * points here instead. Empty on purpose.
 */
export {};
