# PLAN: @gonzih/cc-wire

## Task Restatement
Build and publish `@gonzih/cc-wire` — a TypeScript npm package that centralizes every Redis channel name, key pattern, and message shape used across cc-tg, cc-agent, and cc-agent-ui. All three packages communicate via Redis pub/sub and key/value; right now channel names are scattered hardcoded strings. This package becomes the single source of truth.

## Approach
Single approach: TypeScript-only constants + builder functions + interfaces, compiled to dual ESM+CJS via `tsc`. No bundler, no runtime deps, no Redis client. Just types and strings.

Files to touch:
- `package.json`
- `tsconfig.json`
- `tsconfig.cjs.json`
- `src/channels.ts`
- `src/types.ts`
- `src/index.ts`

## Key Audit Results (from reading actual source)

### Job Keys
- `cca:job:{id}` — STRING, full JobRecord JSON, TTL 7d
- `cca:job:{id}:output` — LIST, log lines (RPUSH), TTL 7d
- `cca:job:{id}:signal` — STRING, control signal: `cancel` | `wake`
- `cca:job:{id}:input` — LIST, in-flight messages (RPUSH/RPOP)
- `cca:job:{id}:output:live` — CHANNEL, live output pub/sub
- `cca:job:done:{id}` — CHANNEL, job completion pub/sub
- `cca:job:done:{id}:queue` — LIST, LPUSH/BLPOP for wait_for_job, TTL 7d
- `cca:jobs:{namespace}` — SET, job IDs per namespace

### Event Stream
- `cca:event-stream` — STREAM (XADD/XREADGROUP), job status events
- consumer group: `coordinator`

### Coordinator
- `cca:coordinator:plan:{jobId}` — STRING, coordinator plan JSON

### Notify / Chat
- `cca:notify:{namespace}` — CHANNEL, job completion notifications
- `cca:notify-log:{namespace}` — LIST, LPUSH capped 100, LIFO
- `cca:chat:log:{namespace}` — LIST, LPUSH capped 500, LIFO
- `cca:chat:incoming:{namespace}` — CHANNEL, UI → cc-tg
- `cca:chat:outgoing:{namespace}` — CHANNEL, cc-tg → UI

### Meta-Agent Keys
- `cca:meta:{namespace}` — STRING (JSON), TTL 30d
- `cca:meta:{namespace}:input` — LIST, input queue RPUSH/RPOP
- `cca:meta-agent:status:{namespace}` — STRING (JSON), TTL 7d
- `cca:meta:agents:index` — SET, canonical registry

### Profile Keys
- `cca:profile:{name}` — STRING (JSON)
- `cca:profiles:index` — SET, profile names

### Plan Keys
- `cca:plan:{id}` — STRING (JSON), TTL 30d

### Learnings Keys
- `cca:learnings:{namespace}` — LIST, LPUSH capped 50, LIFO, TTL 90d

### Token Keys
- `cca:token:index` — STRING, rotation index

### Version Keys
- `cca:meta:cc-agent:version` — STRING
- `cca:meta:cc-tg:version` — STRING

### Cron Keys
- `cca:crons:{namespace}` — STRING (JSON array)

### Swarm Keys
- `cca:swarm:{swarm_id}` — STRING (JSON)
- `cca:swarm:requests` — LIST (LPUSH)

### Voice Keys (cc-tg only)
- `voice:pending` — LIST (RPUSH/LRANGE/LREM)
- `voice:failed` — LIST (RPUSH), TTL 48h

## Risks
- Additional keys may exist in private repos — package is designed to be incrementally expanded
- Dual ESM+CJS output requires two tsconfig files or declaration mapping
