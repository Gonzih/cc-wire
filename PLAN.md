# PLAN — cc-wire v0.2.0 service ownership redesign

## Task restatement

Redesign cc-wire to reflect a new simplified ownership model:
- **cc-wire**: owns Redis key definitions and storage contracts (this repo)
- **cc-discord**: directly owns and manages all namespace Claude sessions (was cc-agent's job)
- **cc-tg**: has its own dedicated money-brain session, completely isolated
- **cc-agent**: pure job runner only (`spawn_agent`); meta-agent lifecycle removed from it
- No state sharing between cc-tg and cc-discord

This is a breaking change → **v0.2.0 minor bump**.

## Approach

Single linear approach: augment `channels.ts` with service-scoped builders, deprecate
old shared keys, update `ChatMessage` type, add workspace constants, update tests, update README,
bump version, publish, open PR.

There are no meaningful design alternatives — the task spec is prescriptive about what keys to add
and what to deprecate.

## Files to touch

- `src/channels.ts` — add discord/tg service-scoped builders, deprecate old meta keys, add constants
- `src/types.ts` — add `service` field to ChatMessage, add `"discord"` to ChatMessage.source
- `src/channels.test.ts` — add tests for new builders
- `README.md` — rewrite for new architecture, new key table, migration notes
- `package.json` — bump to 0.2.0

## Changes detail

### `src/channels.ts`

**Add service-scoped builders:**
```
discordMetaInputKey(ns)   → "cca:discord:meta:{ns}:input"
discordMetaStatusKey(ns)  → "cca:discord:meta:{ns}:status"
discordChatOutgoing(ns)   → "cca:discord:chat:outgoing:{ns}"
discordChatLog(ns)        → "cca:discord:chat:log:{ns}"
discordChatIncoming(ns)   → "cca:discord:chat:incoming:{ns}"
discordNotify(ns)         → "cca:discord:notify:{ns}"
tgChatOutgoing()          → "cca:tg:chat:outgoing"
tgChatIncoming()          → "cca:tg:chat:incoming"
tgNotify()                → "cca:tg:notify"
```

**Add workspace constants:**
```
CC_DISCORD_WORKSPACE_ROOT = "cc-discord-workspace"
CC_TG_WORKSPACE = "money-brain"
```

**Deprecate (keep exported, mark @deprecated):**
- `metaInputKey(ns)` → `@deprecated use discordMetaInputKey(ns)`
- `META_AGENTS_INDEX` → `@deprecated cc-discord maintains its own namespace registry`
- `metaAgentStatusKey(ns)` → `@deprecated use discordMetaStatusKey(ns)`

### `src/types.ts`

- `ChatMessage.source`: add `"discord"` to union
- `ChatMessage`: add `service: "cc-discord" | "cc-tg"` field (optional for back-compat with existing data? — keep optional since existing messages won't have it; new messages must set it)
- `ChatMessage.namespace`: add `namespace: string` (makes source of truth clear for routing)

### `src/channels.test.ts`

- Tests for all new discord/tg builders
- Tests for workspace constants

### `README.md`

- New architecture overview section with service ownership diagram
- Full Redis key table with Owner column
- Migration notes section (old `cca:meta:*` → new `cca:discord:meta:*`)

## Risks

- `ChatMessage.service` is additive but `source` union type change (`"discord"` addition) is also additive — not breaking for consumers
- Deprecated keys remain exported — no removal yet, just JSDoc `@deprecated`
- Both `chatLogKey`/`chatIncomingChannel`/`chatOutgoingChannel` stay as-is (backward compat); new service-scoped builders added alongside
