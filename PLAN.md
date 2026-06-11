# PLAN — NotificationPayload type and routing field

## Task restatement
Add a `Transport` type, extend `NotificationPayload` with `routing?: Transport[]`,
add a `notifyPublishCommand` builder, tests, and update the README.

## Approach
Single, non-breaking additions:

1. `src/types.ts`
   - Add `export type Transport = "discord" | "telegram"`
   - Add `routing?: Transport[]` to the existing `NotificationPayload` interface

2. `src/channels.ts`
   - Add `notifyPublishCommand(ns, payload): string` builder that returns a
     `redis-cli PUBLISH <channel> <json>` shell command string

3. `src/channels.test.ts`
   - Add tests for `notifyPublishCommand` output shape

4. `README.md`
   - Add `Transport` and `NotificationPayload` type examples
   - Add `notifyPublishCommand` to the Notify/Chat table and a usage snippet

## Files touched
- `src/types.ts`
- `src/channels.ts`
- `src/channels.test.ts`
- `README.md`
- `package.json` (version bump via `npm version patch`)

## Risks / unknowns
- `notifyPublishCommand` must shell-escape the JSON value. Using single-quotes
  around the JSON and replacing any single-quotes inside the JSON with `'\''`
  is the portable approach for redis-cli invocations.
- All changes are additive / optional fields — no breaking changes.
