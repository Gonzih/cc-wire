/**
 * @gonzih/cc-wire
 *
 * Single source of truth for Redis channel names, key patterns, and message
 * shapes across the cc-suite (cc-agent, cc-tg, cc-agent-ui).
 *
 * No runtime deps, no Redis client — just constants, builders, and types.
 */

export * from "./channels.js";
export * from "./types.js";
