# cc-suite Architecture

*Last updated: 2026-06-18*

## Overview

The cc-suite is a set of npm packages built around a shared Redis contract defined
by **cc-wire**. Services consume cc-wire's typed storage runtime rather than
constructing Redis keys directly.

```
┌──────────────────────────────────────────────────────────────────┐
│  cc-wire                                                          │
│  Redis key contracts · type definitions · storage runtime        │
└────────────────────────────┬─────────────────────────────────────┘
                             │ imported by
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐
│  cc-discord     │  │  cc-agent    │  │  cc-agent-ui     │
│  v0.2.15        │  │  v0.16.11    │  │  v0.5.34         │
└─────────────────┘  └──────────────┘  └──────────────────┘
```

## Components

### cc-wire (this package)

Core shared library. Defines:
- All Redis key builder functions
- TypeScript types (`ChatMessage`, `SpawnParams`, `JobRecord`, etc.)
- `createCcWire(redis)` typed storage runtime

No business logic. No external dependencies beyond ioredis (peer dep).

### cc-agent v0.16.11

MCP server exposing 50+ tools for Claude agents. Handles:
- Job spawning, lifecycle, cancellation, scoring
- Cron scheduling
- Wiki per repository
- Per-namespace learnings
- Swarm tasks (parallel multi-agent)
- Plan creation and tracking

cc-agent is a **pure job runner** — it does not manage meta-agent lifecycle or
Claude sessions. It is invoked by Claude via MCP tool calls.

### cc-discord v0.2.15

Discord gateway and per-channel meta-agent manager. Handles:
- Discord gateway connection (receives messages from all registered channels)
- Per-channel namespace mapping (`cca:discord:channel:{id}` → namespace)
- MetaAgentManager: one autonomous Claude session per namespace
- Workspace provisioning at `~/cc-discord-workspace/{namespace}/`
- gitkb initialization in each workspace
- cc-agent MCP injection into each session
- Flushing Claude responses back to Discord

**No coordinator pattern.** Each Discord channel is fully autonomous — there is no
single session routing requests to other sessions.

### cc-agent-ui v0.5.34

Web dashboard for monitoring jobs. Reads job records and event stream from Redis,
streams live output via WebSocket. Read-only consumer of cc-wire keys.

### gitkb (git-kb mcp)

Persistent, per-workspace knowledge base. Each meta-agent workspace initialized by
cc-discord includes `git-kb mcp`. Claude uses it to read and write structured KB
pages across sessions.

---

## Meta-Agent Flow (cc-discord)

```
Discord message arrives on channel #simorgh
  → cc-discord looks up channel: cca:discord:channel:{id} → namespace="simorgh"
  → RPUSH cca:discord:meta:simorgh:input  (enqueue)

MetaAgentManager poll loop (3 s):
  → RPOP cca:discord:meta:simorgh:input
  → ensureWorkspace ~/cc-discord-workspace/simorgh/
  → git-kb init (gitkb MCP available in session)
  → injectMcp (cc-agent MCP tools injected into Claude session)
  → spawnSession: claude --continue -p "{msg}" cwd=~/cc-discord-workspace/simorgh/

Claude runs in workspace:
  → reads/writes KB via gitkb MCP
  → spawns jobs via cc-agent MCP (spawn_agent, etc.)
  → cc-agent PUBLISHes cca:discord:notify:simorgh on job completion

cc-discord notify handler:
  → picks up notification
  → flushPending() → Discord channel reply
```

---

## Redis Key Families

### cc-discord owned keys

| Key pattern | Redis type | Description |
|---|---|---|
| `cca:discord:meta:{ns}:input` | LIST | Meta-agent input queue (RPUSH/RPOP) |
| `cca:discord:meta:{ns}:status` | STRING (JSON) | Live session status, TTL 7d |
| `cca:discord:chat:outgoing:{ns}` | CHANNEL | Outgoing messages to UI (pub/sub) |
| `cca:discord:chat:log:{ns}` | LIST | Chat history, capped 500, LIFO |
| `cca:discord:chat:incoming:{ns}` | CHANNEL | Incoming from UI/Discord (pub/sub) |
| `cca:discord:notify:{ns}` | CHANNEL + LIST | Job-completion notifications (dual-purpose) |
| `cca:discord:channel:{id}` | HASH | Per-channel record: namespace + repoUrl |
| `cca:discord:channels:index` | SET | Registry of all registered channel IDs |

### cc-agent owned keys (jobs)

| Key pattern | Redis type | Description |
|---|---|---|
| `cca:job:{id}` | STRING (JSON) | Full JobRecord, TTL 7d |
| `cca:job:{id}:output` | LIST | Log lines (RPUSH/LRANGE), TTL 7d |
| `cca:job:{id}:signal` | STRING | Control signal: `cancel` \| `wake` |
| `cca:job:{id}:input` | LIST | In-flight messages (RPUSH/RPOP) |
| `cca:job:{id}:output:live` | CHANNEL | Live output pub/sub |
| `cca:job:done:{id}` | CHANNEL | Job completion pub/sub |
| `cca:job:done:{id}:queue` | LIST | LPUSH/BLPOP queue for wait_for_job, TTL 7d |
| `cca:jobs:{ns}` | SET | Job IDs per namespace |
| `cca:event-stream` | STREAM | Job status events (XADD/XREADGROUP) |

### cc-agent owned keys (other)

| Key pattern | Redis type | Description |
|---|---|---|
| `cca:plan:{id}` | STRING (JSON) | PlanRecord, TTL 30d |
| `cca:profile:{name}` | STRING (JSON) | Saved spawn profile |
| `cca:profiles:index` | SET | Profile names |
| `cca:crons:{ns}` | STRING (JSON array) | Cron definitions |
| `cca:deleted-crons:{ns}` | SET | Tombstone IDs, TTL 7d |
| `cca:learnings:{ns}` | LIST | Learnings (LPUSH, capped 50), TTL 90d |
| `cca:wiki:{repoSlug}` | HASH | Wiki pages (field = page name) |
| `cca:wiki:{repoSlug}:updated` | STRING | ISO timestamp of last wiki update |
| `cca:swarm:{id}` | STRING (JSON) | SwarmRecord |
| `cca:swarm:requests` | LIST | Swarm task request queue (LPUSH) |

### Shared keys

| Key pattern | Redis type | Description |
|---|---|---|
| `cca:notify:{ns}` | CHANNEL + LIST | Legacy notify (use service-scoped builders for new code) |
| `cca:notify-log:{ns}` | LIST | Notification audit log, capped 100 |
| `cca:token:master` | STRING | Master Claude API token |
| `cca:token:index` | STRING | Token rotation index |
| `cca:meta:cc-agent:version` | STRING | Running cc-agent version |

---

## Notification Routing

When cc-agent completes a job it routes the completion notification to the spawning
namespace's notify channel:

```typescript
// SpawnParams.spawning_namespace tells cc-agent where to route the notify
const params: SpawnParams = {
  repoUrl: "https://github.com/org/repo",
  task: "fix the build",
  spawning_namespace: "simorgh",
};
```

cc-agent PUBLISHes on `cca:discord:notify:{ns}` and also RPUSHes to the same key
(poll fallback). cc-discord's notify handler picks this up and relays to Discord.

---

## Deployment

All services run via `npx --prefer-online @gonzih/<package>@latest`. No local
artifacts. Upgrade cycle: build → test → `npm version patch` → `npm publish` →
restart service (launchd respawn pulls latest).

| Service | Runtime | Restart mechanism |
|---|---|---|
| cc-discord | launchd (KeepAlive: true) | `pkill` — launchd respawns |
| cc-agent | MCP server | spawned by Claude sessions via cc-discord |
| cc-agent-ui | Docker | container restart |

---

## Deprecated: cc-tg

cc-tg was a Telegram bridge that maintained a single `money-brain` Claude session.
It is **deprecated** (2026). Do not use `wire.tg.*` runtime methods or
`tgChatOutgoing()` / `tgChatIncoming()` / `tgNotify()` key builders in new code —
they will be removed in a future major release.
