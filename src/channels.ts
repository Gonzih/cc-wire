/**
 * cc-wire: channels.ts
 *
 * Single source of truth for every Redis key pattern and pub/sub channel
 * used across the cc-suite (cc-agent, cc-tg, cc-agent-ui).
 *
 * Conventions:
 *   - SCREAMING_SNAKE_CASE — static key/channel names (no parameters)
 *   - camelCase functions  — dynamic key/channel builders (one or more parameters)
 *
 * All values match the exact strings used in the source repos as of 2026-05.
 */

// ─── Static Keys ─────────────────────────────────────────────────────────────

/** Redis Stream written by cc-agent on every job status change. */
export const EVENT_STREAM = "cca:event-stream";

/** Consumer group name used by the coordinator to read from EVENT_STREAM. */
export const COORDINATOR_GROUP = "coordinator";

/** SET — canonical registry of meta-agent namespaces. */
export const META_AGENTS_INDEX = "cca:meta:agents:index";

/** SET — index of saved profile names. */
export const PROFILES_INDEX = "cca:profiles:index";

/** STRING — current token rotation index (INCR/GET). */
export const TOKEN_INDEX_KEY = "cca:token:index";

/** STRING — running cc-agent npm version. */
export const CC_AGENT_VERSION_KEY = "cca:meta:cc-agent:version";

/** STRING — running cc-tg npm version. */
export const CC_TG_VERSION_KEY = "cca:meta:cc-tg:version";

/** LIST — cc-tg voice transcription pending queue (RPUSH, LRANGE, LREM). */
export const VOICE_PENDING_KEY = "voice:pending";

/** LIST — cc-tg voice transcription failure log (RPUSH), TTL 48h. */
export const VOICE_FAILED_KEY = "voice:failed";

/** LIST — swarm task request queue (LPUSH). */
export const SWARM_REQUESTS_KEY = "cca:swarm:requests";

// ─── Job Keys (dynamic) ───────────────────────────────────────────────────────

/** SET — job IDs for a given namespace. */
export const jobIndexKey = (namespace: string): string =>
  `cca:jobs:${namespace}`;

/** STRING (JSON) — full JobRecord, TTL 7 days. */
export const jobKey = (jobId: string): string =>
  `cca:job:${jobId}`;

/** LIST — log lines (RPUSH, LRANGE), TTL 7 days. */
export const jobOutputKey = (jobId: string): string =>
  `cca:job:${jobId}:output`;

/** STRING — control signal written by cancel/wake: `"cancel"` | `"wake"`. */
export const jobSignalKey = (jobId: string): string =>
  `cca:job:${jobId}:signal`;

/** LIST — in-flight messages queued for a running job (RPUSH/RPOP). */
export const jobInputKey = (jobId: string): string =>
  `cca:job:${jobId}:input`;

/** CHANNEL — live output lines published as the job runs (pub/sub). */
export const jobOutputLiveChannel = (jobId: string): string =>
  `cca:job:${jobId}:output:live`;

/** CHANNEL — job completion notification (pub/sub). */
export const jobDoneChannel = (jobId: string): string =>
  `cca:job:done:${jobId}`;

/** LIST — LPUSH/BLPOP queue for wait_for_job, TTL 7 days. */
export const jobDoneQueueKey = (jobId: string): string =>
  `cca:job:done:${jobId}:queue`;

// ─── Coordinator Keys (dynamic) ───────────────────────────────────────────────

/** STRING — coordinator plan JSON stored per job. */
export const coordinatorPlanKey = (jobId: string): string =>
  `cca:coordinator:plan:${jobId}`;

// ─── Plan Keys (dynamic) ──────────────────────────────────────────────────────

/** STRING (JSON) — PlanRecord, TTL 30 days. */
export const planKey = (planId: string): string =>
  `cca:plan:${planId}`;

// ─── Profile Keys (dynamic) ───────────────────────────────────────────────────

/** STRING (JSON) — saved Profile. */
export const profileKey = (name: string): string =>
  `cca:profile:${name}`;

// ─── Notify / Chat Keys (dynamic) ────────────────────────────────────────────

/** CHANNEL — job completion notifications published by coordinator (pub/sub). */
export const notifyChannel = (namespace: string): string =>
  `cca:notify:${namespace}`;

/** LIST — notification log (LPUSH capped at 100, LIFO). */
export const notifyLogKey = (namespace: string): string =>
  `cca:notify-log:${namespace}`;

/** LIST — chat history (LPUSH capped at 500, LIFO — newest at index 0). */
export const chatLogKey = (namespace: string): string =>
  `cca:chat:log:${namespace}`;

/** CHANNEL — UI → cc-tg messages (pub/sub). */
export const chatIncomingChannel = (namespace: string): string =>
  `cca:chat:incoming:${namespace}`;

/** CHANNEL — cc-tg / meta-agent → UI messages (pub/sub). */
export const chatOutgoingChannel = (namespace: string): string =>
  `cca:chat:outgoing:${namespace}`;

// ─── Meta-Agent Keys (dynamic) ───────────────────────────────────────────────

/** STRING (JSON) — MetaAgentInfo state, TTL 30 days. */
export const metaKey = (namespace: string): string =>
  `cca:meta:${namespace}`;

/** LIST — input queue for a meta-agent (RPUSH by cc-tg, RPOP by cc-agent). */
export const metaInputKey = (namespace: string): string =>
  `cca:meta:${namespace}:input`;

/** STRING (JSON) — live meta-agent status (typing, tool, etc.), TTL 7 days. */
export const metaAgentStatusKey = (namespace: string): string =>
  `cca:meta-agent:status:${namespace}`;

// ─── Learnings Keys (dynamic) ─────────────────────────────────────────────────

/** LIST — learnings for a namespace (LPUSH capped at 50, LIFO), TTL 90 days. */
export const learningsKey = (namespace: string): string =>
  `cca:learnings:${namespace}`;

// ─── Cron Keys (dynamic) ──────────────────────────────────────────────────────

/** STRING (JSON array) — cron job definitions for a namespace. */
export const cronsKey = (namespace: string): string =>
  `cca:crons:${namespace}`;

// ─── Swarm Keys (dynamic) ─────────────────────────────────────────────────────

/** STRING (JSON) — SwarmRecord for a given swarm ID. */
export const swarmKey = (swarmId: string): string =>
  `cca:swarm:${swarmId}`;

// ─── TTL Constants ────────────────────────────────────────────────────────────

export const TTL = {
  /** 7 days in seconds — job records, output lists, done queues, meta-agent status. */
  JOB_SECONDS: 7 * 24 * 60 * 60,
  /** 30 days in seconds — plans, meta-agent state. */
  PLAN_SECONDS: 30 * 24 * 60 * 60,
  /** 90 days in seconds — learnings lists. */
  LEARNINGS_SECONDS: 90 * 24 * 60 * 60,
  /** 48 hours in seconds — voice:failed list. */
  VOICE_FAILED_SECONDS: 48 * 60 * 60,
} as const;

// ─── Cap Constants ────────────────────────────────────────────────────────────

export const CAP = {
  /** Maximum entries in cca:notify-log:{ns} (LTRIM 0 N-1). */
  NOTIFY_LOG: 100,
  /** Maximum entries in cca:chat:log:{ns} (LTRIM 0 N-1). */
  CHAT_LOG: 500,
  /** Maximum entries in cca:learnings:{ns} (LTRIM 0 N-1). */
  LEARNINGS: 50,
  /** Maximum entries in cca:event-stream (XTRIM MAXLEN ~). */
  EVENT_STREAM: 500,
} as const;

// ─── Timing Constants ─────────────────────────────────────────────────────────

export const TIMING = {
  /** How often the coordinator polls the event stream for new entries (ms). */
  COORDINATOR_POLL_MS: 2000,
  /** How often the dependency scheduler checks pending jobs (ms). */
  DEPENDENCY_TICK_MS: 3000,
  /** How often the meta-agent poller drains input queues (ms). */
  INPUT_POLL_INTERVAL_MS: 3000,
  /** Debounce delay before cc-tg flushes meta-agent streaming output (ms). */
  META_AGENT_FLUSH_DELAY_MS: 1500,
} as const;
