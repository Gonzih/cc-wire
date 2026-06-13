# @gonzih/cc-wire

Single source of truth for Redis channel names, key patterns, message shapes, and
storage runtime across the cc-suite (`cc-agent`, `cc-discord`, `cc-tg`, `cc-agent-ui`).

v0.3.0+: ships a typed storage runtime — services call `createCcWire(redis)` and
never touch raw Redis or import key builders directly.

## Install

```sh
npm install @gonzih/cc-wire ioredis
```

## Architecture — Service Ownership

```
┌──────────────────────────────────────────────────────────────────┐
│  cc-wire  (this package)                                          │
│  Owns: Redis key contracts, type definitions                      │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ imported by
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────────┐  ┌──────────────────┐
│    cc-discord   │   │       cc-tg         │  │    cc-agent      │
│                 │   │                     │  │                  │
│ Owns:           │   │ Owns:               │  │ Owns:            │
│  per-namespace  │   │  money-brain session│  │  job execution   │
│  Claude sessions│   │  (single session)   │  │  (spawn_agent)   │
│  Discord bridge │   │  Telegram bridge    │  │  no meta-agent   │
│                 │   │                     │  │  lifecycle       │
│ Workspace:      │   │ Workspace:          │  │                  │
│  ~/cc-discord-  │   │  ~/money-brain      │  │                  │
│  workspace/{ns} │   │                     │  │                  │
└─────────────────┘   └─────────────────────┘  └──────────────────┘
```

**Key principle:** cc-tg and cc-discord are completely isolated — they share no Redis keys,
no sessions, and no state. cc-agent is a pure job runner; it no longer manages meta-agent
lifecycle.

## Runtime — `createCcWire(redis)`

Pass an [ioredis](https://github.com/redis/ioredis) `Redis` instance and get back
fully-typed storage APIs per service. No raw Redis commands, no key string management.

```typescript
import { createClient } from "ioredis";
import { createCcWire } from "@gonzih/cc-wire";

const redis = new Redis(process.env.REDIS_URL);
const wire = createCcWire(redis);

// cc-discord: per-namespace session management
await wire.discord.enqueue("simorgh", { id: "...", source: "discord", ... });
const msg = await wire.discord.dequeue("simorgh");                    // ChatMessage | null
await wire.discord.publishOutgoing("simorgh", msg);                   // PUBLISH + log + LTRIM
wire.discord.subscribeOutgoing("simorgh", (msg) => console.log(msg)); // live stream
await wire.discord.setStatus("simorgh", { isTyping: true, ... });
const status = await wire.discord.getStatus("simorgh");               // MetaAgentStatus | null
await wire.discord.writeChatLog("simorgh", msg);
const history = await wire.discord.getChatLog("simorgh", 50);         // chronological
await wire.discord.notify("simorgh", { text: "job done" });
const notif = await wire.discord.pollNotify("simorgh");               // NotificationPayload | null
await wire.discord.registerChannel("1234567890", "simorgh", repoUrl);
const chan = await wire.discord.getChannel("1234567890");
const channels = await wire.discord.listChannels();

// cc-tg: single money-brain session
await wire.tg.publishOutgoing(msg);
wire.tg.subscribeOutgoing((msg) => console.log(msg));
await wire.tg.notify({ text: "job done" });
const tgNotif = await wire.tg.pollNotify();

// cc-agent: job queue
await wire.jobs.enqueue({ id: "job-001", repoUrl: "...", task: "..." });
const job = await wire.jobs.getStatus("job-001");
await wire.jobs.publishDone("job-001", { status: "done", score: 1.0 });

// shared master token
await wire.token.setMaster("my-token");
const token = await wire.token.getMaster();

// raw redis escape hatch (migration only)
const raw = wire._redis;
```

## Key builders (v0.2.x compat, use runtime in new code)

```typescript
import {
  // cc-discord service keys
  discordMetaInputKey,
  discordMetaStatusKey,
  discordChatOutgoing,
  discordChatLog,
  discordChatIncoming,
  discordNotify,
  // cc-tg service keys
  tgChatOutgoing,
  tgChatIncoming,
  tgNotify,
  // Service ownership constants
  CC_DISCORD_WORKSPACE_ROOT,
  CC_TG_WORKSPACE,
  // Job keys (cc-agent)
  jobKey,
  jobIndexKey,
  // Shared utility
  notifyPublishCommand,
  TTL,
  CAP,
  type ChatMessage,
  type SpawnParams,
} from "@gonzih/cc-wire";

// cc-discord — per-namespace session keys
const inputQueue   = discordMetaInputKey("simorgh-mobile-app");
// => "cca:discord:meta:simorgh-mobile-app:input"
const statusKey    = discordMetaStatusKey("simorgh-mobile-app");
// => "cca:discord:meta:simorgh-mobile-app:status"
const notifyChan   = discordNotify("simorgh-mobile-app");
// => "cca:discord:notify:simorgh-mobile-app"

// cc-tg — single dedicated money-brain session
const tgOut  = tgChatOutgoing();   // "cca:tg:chat:outgoing"
const tgIn   = tgChatIncoming();   // "cca:tg:chat:incoming"
const tgNtfy = tgNotify();         // "cca:tg:notify"

// Workspace paths
const discordWs = `${process.env.HOME}/${CC_DISCORD_WORKSPACE_ROOT}/simorgh-mobile-app`;
const tgWs      = `${process.env.HOME}/${CC_TG_WORKSPACE}`;

// ChatMessage — with service field
const msg: ChatMessage = {
  id: crypto.randomUUID(),
  source: "discord",
  service: "cc-discord",
  role: "user",
  content: "deploy the app",
  namespace: "simorgh-mobile-app",
  timestamp: new Date().toISOString(),
};
```

## Key Reference

### cc-discord Keys

cc-discord owns all namespace-scoped Claude sessions. All keys live under `cca:discord:`.

| Builder | Pattern | Redis type | Owner | Description |
|---|---|---|---|---|
| `discordMetaInputKey(ns)` | `cca:discord:meta:{ns}:input` | LIST | cc-discord | Input queue for namespace session (RPUSH/RPOP). |
| `discordMetaStatusKey(ns)` | `cca:discord:meta:{ns}:status` | STRING (JSON) | cc-discord | Live session status (typing, tool, etc.), TTL 7d. |
| `discordChatOutgoing(ns)` | `cca:discord:chat:outgoing:{ns}` | CHANNEL | cc-discord | Outgoing messages to UI (pub/sub). |
| `discordChatLog(ns)` | `cca:discord:chat:log:{ns}` | LIST | cc-discord | Chat history, capped at 500, LIFO. |
| `discordChatIncoming(ns)` | `cca:discord:chat:incoming:{ns}` | CHANNEL | cc-discord | Incoming messages from UI/Discord (pub/sub). |
| `discordNotify(ns)` | `cca:discord:notify:{ns}` | CHANNEL + LIST | cc-discord | Job-completion notifications (PUBLISH + RPOP poll). |

### cc-tg Keys

cc-tg owns a single dedicated `money-brain` session with no namespace scoping.

| Builder | Pattern | Redis type | Owner | Description |
|---|---|---|---|---|
| `tgChatOutgoing()` | `cca:tg:chat:outgoing` | CHANNEL | cc-tg | Outgoing messages to UI (pub/sub). |
| `tgChatIncoming()` | `cca:tg:chat:incoming` | CHANNEL | cc-tg | Incoming messages from UI/Telegram (pub/sub). |
| `tgNotify()` | `cca:tg:notify` | CHANNEL + LIST | cc-tg | Job-completion notifications (PUBLISH + RPOP poll). |

### cc-agent Keys (jobs only)

cc-agent is a pure job runner. It no longer manages meta-agent lifecycle.

| Builder | Pattern | Redis type | Description |
|---|---|---|---|
| `jobKey(id)` | `cca:job:{id}` | STRING (JSON) | Full JobRecord, TTL 7d. |
| `jobOutputKey(id)` | `cca:job:{id}:output` | LIST | Log lines (RPUSH/LRANGE), TTL 7d. |
| `jobSignalKey(id)` | `cca:job:{id}:signal` | STRING | Control signal: `cancel` \| `wake`. |
| `jobInputKey(id)` | `cca:job:{id}:input` | LIST | In-flight messages (RPUSH/RPOP). |
| `jobOutputLiveChannel(id)` | `cca:job:{id}:output:live` | CHANNEL | Live output pub/sub. |
| `jobDoneChannel(id)` | `cca:job:done:{id}` | CHANNEL | Job completion pub/sub. |
| `jobDoneQueueKey(id)` | `cca:job:done:{id}:queue` | LIST | LPUSH/BLPOP queue for `wait_for_job`, TTL 7d. |
| `jobIndexKey(ns)` | `cca:jobs:{ns}` | SET | Job IDs per namespace. |
| `EVENT_STREAM` | `cca:event-stream` | STREAM | Job status events (XADD/XREADGROUP). |
| `COORDINATOR_GROUP` | `coordinator` | — | Consumer group name. |

### Shared / Utility Keys

| Builder / Constant | Pattern | Redis type | Description |
|---|---|---|---|
| `notifyChannel(ns)` | `cca:notify:{ns}` | CHANNEL | Legacy coordinator notify (use service-scoped builders for new code). |
| `notifyListKey(ns)` | `cca:notify:{ns}` | LIST | Same key — delivery queue. |
| `notifyLogKey(ns)` | `cca:notify-log:{ns}` | LIST | Notification audit log, capped at 100, LIFO. |
| `notifyPublishCommand(ns, payload)` | — | — | Returns a `redis-cli PUBLISH` shell command string. Useful for cron prompts. |
| `planKey(id)` | `cca:plan:{id}` | STRING (JSON) | PlanRecord, TTL 30d. |
| `coordinatorPlanKey(jobId)` | `cca:coordinator:plan:{jobId}` | STRING | Coordinator plan JSON. |
| `profileKey(name)` | `cca:profile:{name}` | STRING (JSON) | Saved Profile. |
| `PROFILES_INDEX` | `cca:profiles:index` | SET | Profile names. |
| `cronsKey(ns)` | `cca:crons:{ns}` | STRING (JSON array) | Cron definitions. |
| `deletedCronsKey(ns)` | `cca:deleted-crons:{ns}` | SET | Tombstone IDs, TTL 7d. |
| `learningsKey(ns)` | `cca:learnings:{ns}` | LIST | Learnings (LPUSH, capped at 50), TTL 90d, LIFO. |
| `wikiKey(repoSlug)` | `cca:wiki:{repoSlug}` | HASH | Wiki pages. Field = page name, value = markdown. |
| `wikiUpdatedKey(repoSlug)` | `cca:wiki:{repoSlug}:updated` | STRING | ISO timestamp of last wiki update. |
| `swarmKey(id)` | `cca:swarm:{id}` | STRING (JSON) | SwarmRecord. |
| `SWARM_REQUESTS_KEY` | `cca:swarm:requests` | LIST | Swarm task request queue (LPUSH). |
| `CC_AGENT_VERSION_KEY` | `cca:meta:cc-agent:version` | STRING | Running cc-agent version. |
| `CC_TG_VERSION_KEY` | `cca:meta:cc-tg:version` | STRING | Running cc-tg version. |
| `TOKEN_INDEX_KEY` | `cca:token:index` | STRING | Token rotation index. |
| `VOICE_PENDING_KEY` | `voice:pending` | LIST | Transcription pending queue (cc-tg only). |
| `VOICE_FAILED_KEY` | `voice:failed` | LIST | Failure log, TTL 48h (cc-tg only). |

### Service Ownership Constants

```typescript
CC_DISCORD_WORKSPACE_ROOT  // "cc-discord-workspace"
// Usage: `${HOME}/${CC_DISCORD_WORKSPACE_ROOT}/{namespace}`

CC_TG_WORKSPACE            // "money-brain"
// Usage: `${HOME}/${CC_TG_WORKSPACE}`
```

## Constants

```typescript
TTL.JOB_SECONDS            // 604800   (7 days)
TTL.PLAN_SECONDS           // 2592000  (30 days)
TTL.LEARNINGS_SECONDS      // 7776000  (90 days)
TTL.VOICE_FAILED_SECONDS   // 172800   (48 hours)

CAP.NOTIFY_LOG             // 100
CAP.CHAT_LOG               // 500
CAP.LEARNINGS              // 50
CAP.EVENT_STREAM           // 500

TIMING.COORDINATOR_POLL_MS         // 2000
TIMING.DEPENDENCY_TICK_MS          // 3000
TIMING.INPUT_POLL_INTERVAL_MS      // 3000
TIMING.META_AGENT_FLUSH_DELAY_MS   // 1500
```

## Notification Routing

Each service subscribes to its own notify channel for job-completion notifications:

| Service | Notify key builder | Pattern |
|---|---|---|
| cc-discord | `discordNotify(ns)` | `cca:discord:notify:{ns}` |
| cc-tg | `tgNotify()` | `cca:tg:notify` |

Both use the same dual-purpose pattern: the coordinator PUBLISHes on the channel (pub/sub)
and also RPUSHes to the same key as a list (poll fallback). Redis pub/sub and list namespaces
are independent so this is safe.

### Setting spawning_namespace on spawn calls

Any caller spawning jobs via cc-agent must set `spawning_namespace` on `SpawnParams` so
the coordinator routes completion notifications to the right service:

```typescript
import type { SpawnParams } from "@gonzih/cc-wire";

const params: SpawnParams = {
  repoUrl: "https://github.com/org/repo",
  task: "fix the build",
  spawning_namespace: "simorgh-mobile-app",  // cc-agent uses this to route the notify
};
```

## Migration from v0.1.x

If you were using the old cc-agent-owned meta-agent keys, replace them:

| Old (deprecated) | New | Owner |
|---|---|---|
| `metaInputKey(ns)` → `cca:meta:{ns}:input` | `discordMetaInputKey(ns)` → `cca:discord:meta:{ns}:input` | cc-discord |
| `metaAgentStatusKey(ns)` → `cca:meta-agent:status:{ns}` | `discordMetaStatusKey(ns)` → `cca:discord:meta:{ns}:status` | cc-discord |
| `META_AGENTS_INDEX` → `cca:meta:agents:index` | — (cc-discord maintains its own registry) | cc-discord |
| `chatLogKey(ns)` → `cca:chat:log:{ns}` | `discordChatLog(ns)` → `cca:discord:chat:log:{ns}` | cc-discord |
| `chatOutgoingChannel(ns)` → `cca:chat:outgoing:{ns}` | `discordChatOutgoing(ns)` → `cca:discord:chat:outgoing:{ns}` | cc-discord |
| `chatIncomingChannel(ns)` → `cca:chat:incoming:{ns}` | `discordChatIncoming(ns)` → `cca:discord:chat:incoming:{ns}` | cc-discord |
| `notifyChannel(ns)` (Discord use) | `discordNotify(ns)` | cc-discord |
| `notifyChannel(ns)` / `notifyListKey(ns)` (tg use) | `tgNotify()` | cc-tg |

The deprecated exports remain in v0.2.x for migration; they will be removed in v0.3.x.

## Development

```sh
npm run build          # compile ESM + CJS
npm test               # run all tests (channels: node --test; runtime: vitest)
npm run test:channels  # key builder tests only (node --test + tsx)
npm run test:runtime   # runtime tests only (vitest + ioredis-mock)
```

## License

MIT
