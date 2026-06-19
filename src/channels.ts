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

import type { NotificationPayload } from "./types.js";

// ─── Service Ownership Constants ─────────────────────────────────────────────

/**
 * Root directory (relative to HOME) where cc-discord checks out per-namespace
 * workspace clones: `~/cc-discord-workspace/{namespace}`.
 */
export const CC_DISCORD_WORKSPACE_ROOT = "cc-discord-workspace";

/**
 * Directory name (relative to HOME) of the money-brain repo used by cc-tg
 * for its dedicated session: `~/money-brain`.
 * @deprecated — coordinator/TG scheme, will be removed in next major
 */
export const CC_TG_WORKSPACE = "money-brain";

// ─── Static Keys ─────────────────────────────────────────────────────────────

/** Redis Stream written by cc-agent on every job status change. */
export const EVENT_STREAM = "cca:event-stream";

/**
 * Consumer group name used by the coordinator to read from EVENT_STREAM.
 * @deprecated — coordinator/TG scheme, will be removed in next major
 */
export const COORDINATOR_GROUP = "coordinator";

/**
 * SET — canonical registry of meta-agent namespaces.
 * @deprecated cc-discord now maintains its own namespace registry.
 *   This key is no longer written by the cc-suite; kept for migration only.
 */
export const META_AGENTS_INDEX = "cca:meta:agents:index";

/** SET — index of saved profile names. */
export const PROFILES_INDEX = "cca:profiles:index";

/** STRING — current token rotation index (INCR/GET). */
export const TOKEN_INDEX_KEY = "cca:token:index";

/** STRING — running cc-agent npm version. */
export const CC_AGENT_VERSION_KEY = "cca:meta:cc-agent:version";

/** Glob pattern for Redis KEYS scan — matches all job index sets. */
export const JOB_INDEX_GLOB = "cca:jobs:*";

/** Key prefix stripped when extracting namespace from a job index key. */
export const JOB_INDEX_PREFIX = "cca:jobs:";

/**
 * STRING — running cc-tg npm version.
 * @deprecated — coordinator/TG scheme, will be removed in next major
 */
export const CC_TG_VERSION_KEY = "cca:meta:cc-tg:version";

/**
 * LIST — cc-tg voice transcription pending queue (RPUSH, LRANGE, LREM).
 * @deprecated — coordinator/TG scheme, will be removed in next major
 */
export const VOICE_PENDING_KEY = "voice:pending";

/**
 * LIST — cc-tg voice transcription failure log (RPUSH), TTL 48h.
 * @deprecated — coordinator/TG scheme, will be removed in next major
 */
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

/** STRING — byte offset into the job's log file, used for re-attach after restart. */
export const jobLogOffsetKey = (jobId: string): string =>
  `cca:job:${jobId}:log-offset`;

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

/**
 * STRING — coordinator plan JSON stored per job.
 * @deprecated — coordinator/TG scheme, will be removed in next major
 */
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

/**
 * LIST — notification delivery queue (RPUSH by cc-agent, RPOP by cc-tg).
 *
 * Same Redis key as `notifyChannel`; pub/sub channels and list keys occupy
 * separate namespaces in Redis so the dual use is safe. cc-tg polls this
 * list every 5 s via RPOP to catch notifications that arrived while the
 * subscriber was disconnected.
 */
export const notifyListKey = (namespace: string): string =>
  `cca:notify:${namespace}`;

/** LIST — notification log (LPUSH capped at 100, LIFO). */
export const notifyLogKey = (namespace: string): string =>
  `cca:notify-log:${namespace}`;

/**
 * Returns a `redis-cli PUBLISH` shell command string for the given namespace
 * and payload. Useful for cron prompts that need to emit shell commands.
 *
 * Example output:
 *   redis-cli PUBLISH 'cca:notify:myns' '{"text":"hello","routing":["discord"]}'
 *
 * @deprecated — coordinator/TG scheme, will be removed in next major
 */
export const notifyPublishCommand = (
  namespace: string,
  payload: NotificationPayload
): string => {
  const channel = notifyChannel(namespace);
  const json = JSON.stringify(payload).replace(/'/g, "'\\''");
  return `redis-cli PUBLISH '${channel}' '${json}'`;
};

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

/**
 * STRING (JSON) — MetaAgentInfo state, TTL 30 days.
 * @deprecated — coordinator/TG scheme, will be removed in next major
 */
export const metaKey = (namespace: string): string =>
  `cca:meta:${namespace}`;

/**
 * LIST — input queue for a meta-agent (RPUSH by cc-tg, RPOP by cc-agent).
 * @deprecated Use `discordMetaInputKey(ns)` — cc-discord now owns namespace sessions directly.
 */
export const metaInputKey = (namespace: string): string =>
  `cca:meta:${namespace}:input`;

/**
 * STRING (JSON) — live meta-agent status (typing, tool, etc.), TTL 7 days.
 * @deprecated Use `discordMetaStatusKey(ns)` — cc-discord now owns namespace sessions directly.
 */
export const metaAgentStatusKey = (namespace: string): string =>
  `cca:meta-agent:status:${namespace}`;

// ─── cc-discord Keys (dynamic) ───────────────────────────────────────────────
//
// cc-discord owns all namespace-scoped Claude sessions. It reads from the
// meta input queue, writes status, and publishes/subscribes to chat/notify
// channels — all under the "cca:discord:" prefix to avoid collisions with
// the old cc-agent-owned keys.

/** LIST — input queue for a cc-discord-managed namespace session (RPUSH/RPOP). */
export const discordMetaInputKey = (namespace: string): string =>
  `cca:discord:meta:${namespace}:input`;

/** STRING (JSON) — live status for a cc-discord-managed namespace session, TTL 7 days. */
export const discordMetaStatusKey = (namespace: string): string =>
  `cca:discord:meta:${namespace}:status`;

/** CHANNEL — cc-discord → UI outgoing chat messages (pub/sub). */
export const discordChatOutgoing = (namespace: string): string =>
  `cca:discord:chat:outgoing:${namespace}`;

/** LIST — cc-discord chat history (LPUSH capped at 500, LIFO). */
export const discordChatLog = (namespace: string): string =>
  `cca:discord:chat:log:${namespace}`;

/** CHANNEL — UI/Discord → cc-discord incoming chat messages (pub/sub). */
export const discordChatIncoming = (namespace: string): string =>
  `cca:discord:chat:incoming:${namespace}`;

/**
 * CHANNEL + LIST — job-completion notifications for a Discord namespace.
 *
 * Same dual-purpose pattern as `notifyChannel`/`notifyListKey`: PUBLISH by
 * coordinator (pub/sub) and RPUSH/RPOP delivery queue; Redis pub/sub and list
 * namespaces are independent so the dual use is safe.
 */
export const discordNotify = (namespace: string): string =>
  `cca:discord:notify:${namespace}`;

// ─── cc-tg Keys (static) ─────────────────────────────────────────────────────
//
// cc-tg owns a single dedicated money-brain session with no namespace scoping.

/**
 * CHANNEL — cc-tg → UI outgoing chat messages (pub/sub).
 * @deprecated — coordinator/TG scheme, will be removed in next major
 */
export const tgChatOutgoing = (): string => "cca:tg:chat:outgoing";

/**
 * CHANNEL — UI/Telegram → cc-tg incoming chat messages (pub/sub).
 * @deprecated — coordinator/TG scheme, will be removed in next major
 */
export const tgChatIncoming = (): string => "cca:tg:chat:incoming";

/**
 * CHANNEL + LIST — job-completion notifications for the cc-tg session.
 * Same dual-purpose pattern (pub/sub + RPOP poll fallback).
 * @deprecated — coordinator/TG scheme, will be removed in next major
 */
export const tgNotify = (): string => "cca:tg:notify";

// ─── Learnings Keys (dynamic) ─────────────────────────────────────────────────

/** LIST — learnings for a namespace (LPUSH capped at 50, LIFO), TTL 90 days. */
export const learningsKey = (namespace: string): string =>
  `cca:learnings:${namespace}`;

// ─── Cron Keys (dynamic) ──────────────────────────────────────────────────────

/** STRING (JSON array) — cron job definitions for a namespace. */
export const cronsKey = (namespace: string): string =>
  `cca:crons:${namespace}`;

/** SET — tombstone set of deleted cron IDs for a namespace, TTL 7 days. */
export const deletedCronsKey = (namespace: string): string =>
  `cca:deleted-crons:${namespace}`;

// ─── Wiki Keys (dynamic) ──────────────────────────────────────────────────────

/**
 * HASH — per-repo wiki pages.
 * field = page name, value = markdown string.
 */
export const wikiKey = (repoSlug: string) =>
  `cca:wiki:${repoSlug}` as const;

/** STRING — ISO timestamp of last update for a repo's wiki. */
export const wikiUpdatedKey = (repoSlug: string) =>
  `cca:wiki:${repoSlug}:updated` as const;

// ─── Swarm Keys (dynamic) ─────────────────────────────────────────────────────

/** STRING (JSON) — SwarmRecord for a given swarm ID. */
export const swarmKey = (swarmId: string): string =>
  `cca:swarm:${swarmId}`;

// ─── cc-discord Cron Engine Keys ──────────────────────────────────────────────

/** HASH index — all cron job IDs (HSET/HDEL/HKEYS). */
export const cronListKey = (): string => "cca:discord:cron:list";

/** HASH — individual cron record fields for a given cron ID. */
export const cronHashKey = (id: string): string => `cca:discord:cron:${id}`;

// ─── cc-discord Meta-Agent Streaming ──────────────────────────────────────────

/** CHANNEL — live streaming output from the meta-agent for a namespace (pub/sub). */
export const metaStreamChannel = (ns: string): string => `cca:meta:${ns}:stream`;

/** LIST — persisted meta-agent streaming output log for a namespace (LPUSH capped). */
export const metaLogKey = (ns: string): string => `cca:meta:${ns}:log`;

// ─── cc-discord Singleton and Dedup ───────────────────────────────────────────

/** STRING — singleton presence key; SET EX to claim the Discord instance lock. */
export const DISCORD_INSTANCE_KEY = "cca:discord:instance";

/** STRING — dedup sentinel for a sent notification/message in a namespace, TTL 120 s. */
export const dedupKey = (ns: string): string => `cca:discord:sent:${ns}`;

// ─── TTL Constants ────────────────────────────────────────────────────────────

export const TTL = {
  /** 7 days in seconds — job records, output lists, done queues, meta-agent status. */
  JOB_SECONDS: 7 * 24 * 60 * 60,
  /** 30 days in seconds — plans, meta-agent state. */
  PLAN_SECONDS: 30 * 24 * 60 * 60,
  /** 90 days in seconds — learnings lists. */
  LEARNINGS_SECONDS: 90 * 24 * 60 * 60,
  /**
   * 48 hours in seconds — voice:failed list.
   * @deprecated coordinator/TG scheme, will be removed in next major
   */
  VOICE_FAILED_SECONDS: 48 * 60 * 60,
} as const;

/** Milliseconds before the cc-discord singleton instance lock expires and must be renewed. */
export const DISCORD_INSTANCE_TTL_MS = 30000;

/** Seconds before a sent-message dedup sentinel expires and the same message can be re-sent. */
export const DEDUP_TTL_SECONDS = 120;

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
  /**
   * How often the coordinator polls the event stream for new entries (ms).
   * @deprecated coordinator/TG scheme, will be removed in next major
   */
  COORDINATOR_POLL_MS: 2000,
  /** How often the dependency scheduler checks pending jobs (ms). */
  DEPENDENCY_TICK_MS: 3000,
  /** How often the meta-agent poller drains input queues (ms). */
  INPUT_POLL_INTERVAL_MS: 3000,
  /** Debounce delay before cc-tg flushes meta-agent streaming output (ms). */
  META_AGENT_FLUSH_DELAY_MS: 1500,
} as const;
