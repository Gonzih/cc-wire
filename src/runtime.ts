/**
 * cc-wire runtime — `createCcWire(redis)`
 *
 * The single entry point for all Redis I/O across the cc-suite.
 * Services import this factory and call typed methods; they never
 * write raw Redis commands or import key builders directly.
 */
import type { Redis } from "ioredis";

import {
  discordMetaInputKey,
  discordMetaStatusKey,
  discordChatOutgoing,
  discordChatLog,
  discordNotify,
  tgChatOutgoing,
  tgNotify,
  jobKey,
  jobDoneChannel,
  jobDoneQueueKey,
  CAP,
  TTL,
} from "./channels.js";
import type {
  ChatMessage,
  MetaAgentStatus,
  NotificationPayload,
  SpawnParams,
} from "./types.js";

// ─── Private key helpers (not exported) ──────────────────────────────────────

const channelHashKey = (channelId: string) =>
  `cca:discord:channel:${channelId}`;

const CHANNELS_SET = "cca:discord:channels:index";

const discordNotifyLogKey = (ns: string) => `cca:discord:notify-log:${ns}`;

const TG_NOTIFY_LOG = "cca:tg:notify-log";

const SPAWN_QUEUE = "cca:spawn:queue";

const MASTER_TOKEN_KEY = "cca:token:master";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface DiscordApi {
  /** RPUSH message to the input queue for a namespace session. */
  enqueue(ns: string, msg: ChatMessage): Promise<void>;
  /** RPOP next message from the input queue; null when empty. */
  dequeue(ns: string): Promise<ChatMessage | null>;
  /**
   * Pipeline: PUBLISH to outgoing channel + LPUSH to chat log + LTRIM.
   * Subscribers on the channel receive the message live; the log persists it.
   */
  publishOutgoing(ns: string, msg: ChatMessage): Promise<void>;
  /** Subscribe to outgoing messages for a namespace. Uses an internal duplicate connection. */
  subscribeOutgoing(ns: string, cb: (msg: ChatMessage) => void): void;
  /** SET session status with 7-day TTL. */
  setStatus(ns: string, status: MetaAgentStatus): Promise<void>;
  /** GET session status; null when key is absent or expired. */
  getStatus(ns: string): Promise<MetaAgentStatus | null>;
  /** LPUSH message to chat log + LTRIM to 500. */
  writeChatLog(ns: string, msg: ChatMessage): Promise<void>;
  /** LRANGE chat log, reversed to chronological order. Default limit 50. */
  getChatLog(ns: string, limit?: number): Promise<ChatMessage[]>;
  /** PUBLISH notify channel + RPUSH delivery list + log. */
  notify(ns: string, payload: NotificationPayload): Promise<void>;
  /** RPOP from notify delivery list; null when empty. */
  pollNotify(ns: string): Promise<NotificationPayload | null>;
  /** Register a Discord channel → namespace mapping. */
  registerChannel(
    channelId: string,
    ns: string,
    repoUrl: string
  ): Promise<void>;
  /** Look up a channel registration; null if not found. */
  getChannel(
    channelId: string
  ): Promise<{ namespace: string; repoUrl: string } | null>;
  /** List all registered channel mappings. */
  listChannels(): Promise<
    Array<{ channelId: string; namespace: string; repoUrl: string }>
  >;
}

/**
 * @deprecated — coordinator/TG scheme, will be removed in next major
 */
export interface TgApi {
  /** Pipeline: PUBLISH to outgoing channel + LPUSH log + LTRIM. */
  publishOutgoing(msg: ChatMessage): Promise<void>;
  /** Subscribe to outgoing messages. Uses an internal duplicate connection. */
  subscribeOutgoing(cb: (msg: ChatMessage) => void): void;
  /** PUBLISH notify channel + RPUSH delivery list + log. */
  notify(payload: NotificationPayload): Promise<void>;
  /** RPOP from notify delivery list; null when empty. */
  pollNotify(): Promise<NotificationPayload | null>;
}

export interface JobsApi {
  /** LPUSH job to spawn queue and write initial job record. */
  enqueue(job: SpawnParams & { id: string }): Promise<void>;
  /** GET job record; null when job does not exist. */
  getStatus(jobId: string): Promise<unknown>;
  /** PUBLISH job-done channel + LPUSH to done queue. */
  publishDone(jobId: string, result: unknown): Promise<void>;
}

export interface TokenApi {
  /** GET master token; throws if not set. */
  getMaster(): Promise<string>;
  /** SET master token (no TTL). */
  setMaster(token: string): Promise<void>;
}

export interface CcWire {
  /** cc-discord: per-namespace session management. */
  discord: DiscordApi;
  /** cc-tg: single money-brain session. */
  tg: TgApi;
  /** cc-agent: job queue. */
  jobs: JobsApi;
  /** Master token (shared across services). */
  token: TokenApi;
  /**
   * Raw redis client escape hatch — for migration only.
   * @internal
   */
  _redis: Redis;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createCcWire(redis: Redis): CcWire {
  return {
    // ── discord ──────────────────────────────────────────────────────────────
    discord: {
      async enqueue(ns, msg) {
        await redis.rpush(discordMetaInputKey(ns), JSON.stringify(msg));
      },

      async dequeue(ns) {
        const val = await redis.rpop(discordMetaInputKey(ns));
        return val ? (JSON.parse(val) as ChatMessage) : null;
      },

      async publishOutgoing(ns, msg) {
        const json = JSON.stringify(msg);
        const pl = redis.pipeline();
        pl.publish(discordChatOutgoing(ns), json);
        pl.lpush(discordChatLog(ns), json);
        pl.ltrim(discordChatLog(ns), 0, CAP.CHAT_LOG - 1);
        await pl.exec();
      },

      subscribeOutgoing(ns, cb) {
        const sub = redis.duplicate();
        sub.subscribe(discordChatOutgoing(ns));
        sub.on("message", (channel: string, message: string) => {
          if (channel === discordChatOutgoing(ns)) {
            cb(JSON.parse(message) as ChatMessage);
          }
        });
      },

      async setStatus(ns, status) {
        await redis.set(
          discordMetaStatusKey(ns),
          JSON.stringify(status),
          "EX",
          TTL.JOB_SECONDS
        );
      },

      async getStatus(ns) {
        const val = await redis.get(discordMetaStatusKey(ns));
        return val ? (JSON.parse(val) as MetaAgentStatus) : null;
      },

      async writeChatLog(ns, msg) {
        const pl = redis.pipeline();
        pl.lpush(discordChatLog(ns), JSON.stringify(msg));
        pl.ltrim(discordChatLog(ns), 0, CAP.CHAT_LOG - 1);
        await pl.exec();
      },

      async getChatLog(ns, limit = 50) {
        const items = await redis.lrange(discordChatLog(ns), 0, limit - 1);
        return items
          .map((i) => JSON.parse(i) as ChatMessage)
          .reverse();
      },

      async notify(ns, payload) {
        const json = JSON.stringify(payload);
        const pl = redis.pipeline();
        pl.publish(discordNotify(ns), json);
        pl.rpush(discordNotify(ns), json);
        pl.lpush(discordNotifyLogKey(ns), json);
        pl.ltrim(discordNotifyLogKey(ns), 0, CAP.NOTIFY_LOG - 1);
        await pl.exec();
      },

      async pollNotify(ns) {
        const val = await redis.rpop(discordNotify(ns));
        return val ? (JSON.parse(val) as NotificationPayload) : null;
      },

      async registerChannel(channelId, ns, repoUrl) {
        const pl = redis.pipeline();
        pl.hset(channelHashKey(channelId), { namespace: ns, repoUrl });
        pl.sadd(CHANNELS_SET, channelId);
        await pl.exec();
      },

      async getChannel(channelId) {
        const data = await redis.hgetall(channelHashKey(channelId));
        if (!data || !data["namespace"]) return null;
        return { namespace: data["namespace"], repoUrl: data["repoUrl"] ?? "" };
      },

      async listChannels() {
        const ids = await redis.smembers(CHANNELS_SET);
        const rows = await Promise.all(
          ids.map(async (channelId) => {
            const data = await redis.hgetall(channelHashKey(channelId));
            if (!data || !data["namespace"]) return null;
            return {
              channelId,
              namespace: data["namespace"],
              repoUrl: data["repoUrl"] ?? "",
            };
          })
        );
        return rows.filter(
          (r): r is { channelId: string; namespace: string; repoUrl: string } =>
            r !== null
        );
      },
    },

    // ── tg ───────────────────────────────────────────────────────────────────
    tg: {
      async publishOutgoing(msg) {
        const json = JSON.stringify(msg);
        const pl = redis.pipeline();
        pl.publish(tgChatOutgoing(), json);
        pl.lpush("cca:tg:chat:log", json);
        pl.ltrim("cca:tg:chat:log", 0, CAP.CHAT_LOG - 1);
        await pl.exec();
      },

      subscribeOutgoing(cb) {
        const sub = redis.duplicate();
        sub.subscribe(tgChatOutgoing());
        sub.on("message", (_channel: string, message: string) => {
          cb(JSON.parse(message) as ChatMessage);
        });
      },

      async notify(payload) {
        const json = JSON.stringify(payload);
        const pl = redis.pipeline();
        pl.publish(tgNotify(), json);
        pl.rpush(tgNotify(), json);
        pl.lpush(TG_NOTIFY_LOG, json);
        pl.ltrim(TG_NOTIFY_LOG, 0, CAP.NOTIFY_LOG - 1);
        await pl.exec();
      },

      async pollNotify() {
        const val = await redis.rpop(tgNotify());
        return val ? (JSON.parse(val) as NotificationPayload) : null;
      },
    },

    // ── jobs ─────────────────────────────────────────────────────────────────
    jobs: {
      async enqueue(job) {
        const pl = redis.pipeline();
        pl.set(
          jobKey(job.id),
          JSON.stringify({ ...job, status: "pending" }),
          "EX",
          TTL.JOB_SECONDS
        );
        pl.lpush(SPAWN_QUEUE, JSON.stringify(job));
        await pl.exec();
      },

      async getStatus(jobId) {
        const val = await redis.get(jobKey(jobId));
        return val ? JSON.parse(val) : null;
      },

      async publishDone(jobId, result) {
        const json = JSON.stringify(result);
        const pl = redis.pipeline();
        pl.publish(jobDoneChannel(jobId), json);
        pl.lpush(jobDoneQueueKey(jobId), json);
        pl.expire(jobDoneQueueKey(jobId), TTL.JOB_SECONDS);
        await pl.exec();
      },
    },

    // ── token ─────────────────────────────────────────────────────────────────
    token: {
      async getMaster() {
        const val = await redis.get(MASTER_TOKEN_KEY);
        if (val === null) throw new Error("cc-wire: master token not set");
        return val;
      },

      async setMaster(token) {
        await redis.set(MASTER_TOKEN_KEY, token);
      },
    },

    _redis: redis,
  };
}
