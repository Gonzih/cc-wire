# PLAN — cc-wire v0.3.0 runtime (`createCcWire`)

## Task restatement

Turn cc-wire from a pure key-dictionary into a **storage runtime**. Services import
`createCcWire(redis)` and call typed methods. Raw Redis calls and key builder imports
become private implementation details.

## Approach

Single factory function `createCcWire(redis: Redis): CcWire` that wraps an ioredis
`Redis` instance and returns typed namespaced APIs for discord, tg, jobs, and token.

Key decisions:
- `subscribeOutgoing` calls `redis.duplicate()` internally — subscribe mode requires
  a dedicated connection and callers don't need to manage it.
- `publishOutgoing` uses a pipeline: PUBLISH + LPUSH log + LTRIM (atomic from the
  client's perspective; pipeline is not transactional but preserves ordering).
- All serialization/deserialization is JSON, internal to the runtime.
- Key builders remain exported (backward compat, `@deprecated` JSDoc).
- `ioredis` is a peer dependency (services bring their own client).
- Tests use Vitest with `ioredis-mock` so CI needs no real Redis.

## Files to touch

- `src/runtime.ts` — new file: `createCcWire`, `CcWire` interface, private key helpers
- `src/runtime.test.ts` — new file: Vitest tests with ioredis-mock
- `src/index.ts` — add `export * from "./runtime.js"`
- `package.json` — peer dep `ioredis`, dev deps `ioredis-mock` + `vitest`, update test script
- `vitest.config.ts` — minimal Vitest config (node environment)
- `README.md` — add createCcWire section, update install instructions

## Private key builders inside runtime.ts

```
channelHashKey(channelId)  → cca:discord:channel:{channelId}   HASH (namespace, repoUrl)
CHANNELS_SET               → cca:discord:channels:index          SET of channelIds
DISCORD_NOTIFY_LOG(ns)     → cca:discord:notify-log:{ns}         LIST audit log
TG_NOTIFY_LOG              → cca:tg:notify-log                   LIST audit log
SPAWN_QUEUE                → cca:spawn:queue                     LIST spawn requests
MASTER_TOKEN_KEY           → cca:token:master                    STRING
```

## discord.notify / pollNotify semantics

- `notify(ns, payload)` → pipeline: PUBLISH `discordNotify(ns)` + RPUSH `discordNotify(ns)` (delivery list)
- `pollNotify(ns)` → RPOP `discordNotify(ns)`
  (Same dual-purpose pattern as existing notifyChannel/notifyListKey)

## Risks

- `ioredis-mock` pub/sub works via EventEmitter sharing between duplicated clients —
  if the mock doesn't relay publish to subscribers, pub/sub tests will be flaky.
  Mitigation: use `await new Promise(resolve => setTimeout(resolve, 20))` in pub/sub tests.
- Subscribe methods leak connections (no cleanup API). Acceptable for the defined interface.
- CJS test coverage: Vitest only tests ESM; CJS path is verified via the build.
