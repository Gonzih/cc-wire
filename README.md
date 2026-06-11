# @gonzih/cc-wire

Single source of truth for Redis channel names, key patterns, and message shapes across the cc-suite (`cc-agent`, `cc-tg`, `cc-agent-ui`).

No runtime dependencies. No Redis client. Just constants, builders, and types.

## Install

```sh
npm install @gonzih/cc-wire
```

## Usage

```typescript
import {
  wikiKey,
  wikiUpdatedKey,
  notifyChannel,
  notifyListKey,
  notifyPublishCommand,
  jobKey,
  jobIndexKey,
  chatLogKey,
  TTL,
  CAP,
  type Transport,
  type NotificationPayload,
} from "@gonzih/cc-wire";

// Wiki keys
const hash = wikiKey("org/repo");         // "cca:wiki:org/repo"
const ts   = wikiUpdatedKey("org/repo");  // "cca:wiki:org/repo:updated"

// Job keys
const job  = jobKey("abc-123");           // "cca:job:abc-123"
const idx  = jobIndexKey("myns");         // "cca:jobs:myns"

// Notify
const chan = notifyChannel("myns");       // "cca:notify:myns"
const list = notifyListKey("myns");       // "cca:notify:myns" (same key, dual-purpose)

// NotificationPayload — routing controls which transports deliver the message
const payload: NotificationPayload = {
  text: "Build finished ✓",
  routing: ["discord"],       // omit or leave empty for all transports
};

// notifyPublishCommand — generate a redis-cli shell command
const cmd = notifyPublishCommand("myns", payload);
// => "redis-cli PUBLISH 'cca:notify:myns' '{\"text\":\"Build finished ✓\",\"routing\":[\"discord\"]}'"

// Constants
TTL.JOB_SECONDS   // 604800
CAP.CHAT_LOG      // 500
```

## Key Reference

### Wiki

| Builder | Pattern | Redis type | Description |
|---|---|---|---|
| `wikiKey(repoSlug)` | `cca:wiki:{repoSlug}` | HASH | Per-repo wiki pages. Field = page name, value = markdown. |
| `wikiUpdatedKey(repoSlug)` | `cca:wiki:{repoSlug}:updated` | STRING | ISO timestamp of last wiki update. |

### Jobs

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

### Event Stream

| Constant | Value | Description |
|---|---|---|
| `EVENT_STREAM` | `cca:event-stream` | Redis Stream — job status events. |
| `COORDINATOR_GROUP` | `coordinator` | Consumer group name. |

### Notify / Chat

| Builder | Pattern | Description |
|---|---|---|
| `notifyChannel(ns)` | `cca:notify:{ns}` | CHANNEL — coordinator publishes job completion. |
| `notifyListKey(ns)` | `cca:notify:{ns}` | LIST — delivery queue (RPUSH/RPOP). Same key as channel (safe — Redis pub/sub and list namespaces are independent). |
| `notifyLogKey(ns)` | `cca:notify-log:{ns}` | LIST — persistent audit log, capped at `CAP.NOTIFY_LOG` (100). |
| `notifyPublishCommand(ns, payload)` | — | Returns a `redis-cli PUBLISH` shell command string. Useful for cron prompts. |
| `chatLogKey(ns)` | `cca:chat:log:{ns}` | LIST — chat history, capped at `CAP.CHAT_LOG` (500), LIFO. |
| `chatIncomingChannel(ns)` | `cca:chat:incoming:{ns}` | CHANNEL — UI → cc-tg. |
| `chatOutgoingChannel(ns)` | `cca:chat:outgoing:{ns}` | CHANNEL — cc-tg → UI. |

### Meta-Agent

| Builder | Pattern | Description |
|---|---|---|
| `metaKey(ns)` | `cca:meta:{ns}` | STRING (JSON) — MetaAgentInfo state, TTL 30d. |
| `metaInputKey(ns)` | `cca:meta:{ns}:input` | LIST — input queue (RPUSH/RPOP). |
| `metaAgentStatusKey(ns)` | `cca:meta-agent:status:{ns}` | STRING (JSON) — live status, TTL 7d. |
| `META_AGENTS_INDEX` | `cca:meta:agents:index` | SET — canonical registry. |

### Wiki

| Builder | Pattern | Description |
|---|---|---|
| `wikiKey(repoSlug)` | `cca:wiki:{repoSlug}` | HASH — wiki pages. Field = page name, value = markdown. |
| `wikiUpdatedKey(repoSlug)` | `cca:wiki:{repoSlug}:updated` | STRING — ISO timestamp of last update. |

### Profiles

| Builder | Pattern | Description |
|---|---|---|
| `profileKey(name)` | `cca:profile:{name}` | STRING (JSON) — saved Profile. |
| `PROFILES_INDEX` | `cca:profiles:index` | SET — profile names. |

### Crons

| Builder | Pattern | Description |
|---|---|---|
| `cronsKey(ns)` | `cca:crons:{ns}` | STRING (JSON array) — cron definitions. |
| `deletedCronsKey(ns)` | `cca:deleted-crons:{ns}` | SET — tombstone IDs, TTL 7d. |

### Learnings

| Builder | Pattern | Description |
|---|---|---|
| `learningsKey(ns)` | `cca:learnings:{ns}` | LIST — learnings (LPUSH, capped at `CAP.LEARNINGS` = 50), TTL 90d, LIFO. |

### Plans / Coordinator

| Builder | Pattern | Description |
|---|---|---|
| `planKey(id)` | `cca:plan:{id}` | STRING (JSON) — PlanRecord, TTL 30d. |
| `coordinatorPlanKey(jobId)` | `cca:coordinator:plan:{jobId}` | STRING — coordinator plan JSON. |

### Swarm

| Builder | Pattern | Description |
|---|---|---|
| `swarmKey(id)` | `cca:swarm:{id}` | STRING (JSON) — SwarmRecord. |
| `SWARM_REQUESTS_KEY` | `cca:swarm:requests` | LIST — task request queue (LPUSH). |

### Version / Token

| Constant | Value | Description |
|---|---|---|
| `CC_AGENT_VERSION_KEY` | `cca:meta:cc-agent:version` | STRING — running cc-agent version. |
| `CC_TG_VERSION_KEY` | `cca:meta:cc-tg:version` | STRING — running cc-tg version. |
| `TOKEN_INDEX_KEY` | `cca:token:index` | STRING — token rotation index. |

### Voice (cc-tg only)

| Constant | Value | Description |
|---|---|---|
| `VOICE_PENDING_KEY` | `voice:pending` | LIST — transcription pending queue. |
| `VOICE_FAILED_KEY` | `voice:failed` | LIST — failure log, TTL 48h. |

## Constants

```typescript
TTL.JOB_SECONDS       // 604800   (7 days)
TTL.PLAN_SECONDS      // 2592000  (30 days)
TTL.LEARNINGS_SECONDS // 7776000  (90 days)
TTL.VOICE_FAILED_SECONDS // 172800 (48 hours)

CAP.NOTIFY_LOG        // 100
CAP.CHAT_LOG          // 500
CAP.LEARNINGS         // 50
CAP.EVENT_STREAM      // 500

TIMING.COORDINATOR_POLL_MS     // 2000
TIMING.DEPENDENCY_TICK_MS      // 3000
TIMING.INPUT_POLL_INTERVAL_MS  // 3000
TIMING.META_AGENT_FLUSH_DELAY_MS // 1500
```

## Development

```sh
npm run build   # compile ESM + CJS
npm test        # run tests (Node built-in test runner via tsx)
```

## License

MIT
