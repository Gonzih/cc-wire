import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import RedisMock from "ioredis-mock";
import type { Redis } from "ioredis";
import { createCcWire } from "./runtime.js";
import type { ChatMessage, MetaAgentStatus, NotificationPayload } from "./types.js";

const makeRedis = () => new RedisMock() as unknown as Redis;

const makeMsg = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "test-id-1",
  source: "discord",
  service: "cc-discord",
  role: "user",
  content: "hello world",
  namespace: "testns",
  timestamp: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeStatus = (overrides: Partial<MetaAgentStatus> = {}): MetaAgentStatus => ({
  namespace: "testns",
  status: "idle",
  isTyping: false,
  turnCount: 0,
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

// ─── discord ─────────────────────────────────────────────────────────────────

describe("discord.enqueue / discord.dequeue", () => {
  let redis: Redis;

  beforeAll(() => { redis = makeRedis(); });
  afterAll(async () => { await redis.quit(); });

  it("round-trips a ChatMessage through the input queue", async () => {
    const wire = createCcWire(redis);
    const msg = makeMsg();

    await wire.discord.enqueue("testns", msg);
    const out = await wire.discord.dequeue("testns");

    expect(out).toEqual(msg);
  });

  it("dequeue returns null when queue is empty", async () => {
    const wire = createCcWire(redis);
    const out = await wire.discord.dequeue("empty-ns");
    expect(out).toBeNull();
  });

  it("LIFO: dequeue returns most-recently-enqueued message first (RPUSH+RPOP)", async () => {
    const wire = createCcWire(redis);
    const m1 = makeMsg({ id: "m1", content: "first" });
    const m2 = makeMsg({ id: "m2", content: "second" });

    await wire.discord.enqueue("lifo-ns", m1);
    await wire.discord.enqueue("lifo-ns", m2);

    expect(await wire.discord.dequeue("lifo-ns")).toEqual(m2);
    expect(await wire.discord.dequeue("lifo-ns")).toEqual(m1);
    expect(await wire.discord.dequeue("lifo-ns")).toBeNull();
  });
});

describe("discord.publishOutgoing", () => {
  let redis: Redis;

  beforeAll(() => { redis = makeRedis(); });
  afterAll(async () => { await redis.quit(); });

  it("writes message to chat log", async () => {
    const wire = createCcWire(redis);
    const msg = makeMsg({ content: "hello from publish" });

    await wire.discord.publishOutgoing("pub-ns", msg);

    const log = await wire.discord.getChatLog("pub-ns");
    expect(log).toHaveLength(1);
    expect(log[0]).toEqual(msg);
  });

  it("getChatLog returns chronological order (oldest first)", async () => {
    const wire = createCcWire(redis);
    const m1 = makeMsg({ id: "c1", content: "first" });
    const m2 = makeMsg({ id: "c2", content: "second" });
    const m3 = makeMsg({ id: "c3", content: "third" });

    await wire.discord.publishOutgoing("chrono-ns", m1);
    await wire.discord.publishOutgoing("chrono-ns", m2);
    await wire.discord.publishOutgoing("chrono-ns", m3);

    const log = await wire.discord.getChatLog("chrono-ns");
    expect(log.map((m) => m.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("getChatLog respects limit", async () => {
    const wire = createCcWire(redis);
    for (let i = 0; i < 5; i++) {
      await wire.discord.publishOutgoing(
        "limit-ns",
        makeMsg({ id: `lm${i}`, content: `msg ${i}` })
      );
    }

    const log = await wire.discord.getChatLog("limit-ns", 3);
    expect(log).toHaveLength(3);
  });
});

describe("discord.setStatus / discord.getStatus", () => {
  let redis: Redis;

  beforeAll(() => { redis = makeRedis(); });
  afterAll(async () => { await redis.quit(); });

  it("round-trips a MetaAgentStatus", async () => {
    const wire = createCcWire(redis);
    const status = makeStatus({ isTyping: true, turnCount: 5 });

    await wire.discord.setStatus("testns", status);
    const out = await wire.discord.getStatus("testns");

    expect(out).toEqual(status);
  });

  it("getStatus returns null for unknown namespace", async () => {
    const wire = createCcWire(redis);
    const out = await wire.discord.getStatus("does-not-exist");
    expect(out).toBeNull();
  });
});

describe("discord.writeChatLog / discord.getChatLog", () => {
  let redis: Redis;

  beforeAll(() => { redis = makeRedis(); });
  afterAll(async () => { await redis.quit(); });

  it("writeChatLog persists and getChatLog retrieves chronologically", async () => {
    const wire = createCcWire(redis);
    const m1 = makeMsg({ id: "wl1", content: "write one" });
    const m2 = makeMsg({ id: "wl2", content: "write two" });

    await wire.discord.writeChatLog("write-ns", m1);
    await wire.discord.writeChatLog("write-ns", m2);

    const log = await wire.discord.getChatLog("write-ns");
    expect(log.map((m) => m.id)).toEqual(["wl1", "wl2"]);
  });
});

describe("discord.notify / discord.pollNotify", () => {
  let redis: Redis;

  beforeAll(() => { redis = makeRedis(); });
  afterAll(async () => { await redis.quit(); });

  it("pollNotify returns null when no notifications queued", async () => {
    const wire = createCcWire(redis);
    expect(await wire.discord.pollNotify("empty-ns")).toBeNull();
  });

  it("notify enqueues and pollNotify dequeues payload", async () => {
    const wire = createCcWire(redis);
    const payload: NotificationPayload = { text: "job done", routing: ["discord"] };

    await wire.discord.notify("notify-ns", payload);
    const out = await wire.discord.pollNotify("notify-ns");

    expect(out).toEqual(payload);
    expect(await wire.discord.pollNotify("notify-ns")).toBeNull();
  });
});

describe("discord.registerChannel / getChannel / listChannels", () => {
  let redis: Redis;

  beforeAll(() => { redis = makeRedis(); });
  afterAll(async () => { await redis.quit(); });

  it("getChannel returns null for unknown channelId", async () => {
    const wire = createCcWire(redis);
    expect(await wire.discord.getChannel("unknown-chan")).toBeNull();
  });

  it("registerChannel + getChannel round-trip", async () => {
    const wire = createCcWire(redis);
    await wire.discord.registerChannel("chan-123", "myns", "https://github.com/org/repo");

    const out = await wire.discord.getChannel("chan-123");
    expect(out).toEqual({ namespace: "myns", repoUrl: "https://github.com/org/repo" });
  });

  it("listChannels returns all registered channels", async () => {
    const wire = createCcWire(redis);
    await wire.discord.registerChannel("list-chan-1", "ns1", "https://github.com/a/b");
    await wire.discord.registerChannel("list-chan-2", "ns2", "https://github.com/c/d");

    const list = await wire.discord.listChannels();
    const ids = list.map((c) => c.channelId).sort();
    expect(ids).toContain("list-chan-1");
    expect(ids).toContain("list-chan-2");
  });
});

describe("discord.subscribeOutgoing", () => {
  it("receives messages published via publishOutgoing", async () => {
    const redis = makeRedis();
    const wire = createCcWire(redis);
    const received: ChatMessage[] = [];

    wire.discord.subscribeOutgoing("sub-ns", (msg) => received.push(msg));

    // Give the subscribe call time to register
    await new Promise((r) => setTimeout(r, 20));

    const msg = makeMsg({ id: "sub-msg", content: "subscribed!" });
    await wire.discord.publishOutgoing("sub-ns", msg);

    await new Promise((r) => setTimeout(r, 20));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(msg);

    await redis.quit();
  });
});

// ─── tg ──────────────────────────────────────────────────────────────────────

describe("tg.publishOutgoing / tg.subscribeOutgoing", () => {
  it("subscriber receives message published via publishOutgoing", async () => {
    const redis = makeRedis();
    const wire = createCcWire(redis);
    const received: ChatMessage[] = [];

    wire.tg.subscribeOutgoing((msg) => received.push(msg));

    await new Promise((r) => setTimeout(r, 20));

    const msg = makeMsg({ source: "cc-tg", service: "cc-tg", content: "tg message" });
    await wire.tg.publishOutgoing(msg);

    await new Promise((r) => setTimeout(r, 20));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(msg);

    await redis.quit();
  });
});

describe("tg.notify / tg.pollNotify", () => {
  let redis: Redis;

  beforeAll(() => { redis = makeRedis(); });
  afterAll(async () => { await redis.quit(); });

  it("pollNotify returns null when empty", async () => {
    const wire = createCcWire(redis);
    expect(await wire.tg.pollNotify()).toBeNull();
  });

  it("notify + pollNotify round-trip", async () => {
    const wire = createCcWire(redis);
    const payload: NotificationPayload = { text: "tg notif", routing: ["telegram"] };

    await wire.tg.notify(payload);
    const out = await wire.tg.pollNotify();

    expect(out).toEqual(payload);
    expect(await wire.tg.pollNotify()).toBeNull();
  });
});

// ─── jobs ─────────────────────────────────────────────────────────────────────

describe("jobs.enqueue / jobs.getStatus", () => {
  let redis: Redis;

  beforeAll(() => { redis = makeRedis(); });
  afterAll(async () => { await redis.quit(); });

  it("enqueue + getStatus round-trip", async () => {
    const wire = createCcWire(redis);
    const job = {
      id: "job-001",
      repoUrl: "https://github.com/org/repo",
      task: "run tests",
    };

    await wire.jobs.enqueue(job);
    const status = await wire.jobs.getStatus("job-001") as Record<string, unknown>;

    expect(status).not.toBeNull();
    expect(status["id"]).toBe("job-001");
    expect(status["status"]).toBe("pending");
    expect(status["repoUrl"]).toBe(job.repoUrl);
  });

  it("getStatus returns null for unknown jobId", async () => {
    const wire = createCcWire(redis);
    expect(await wire.jobs.getStatus("does-not-exist")).toBeNull();
  });
});

describe("jobs.publishDone", () => {
  let redis: Redis;

  beforeAll(() => { redis = makeRedis(); });
  afterAll(async () => { await redis.quit(); });

  it("writes result to done queue", async () => {
    const wire = createCcWire(redis);
    const result = { job_id: "job-002", status: "done", score: 0.9 };

    await wire.jobs.publishDone("job-002", result);

    // Verify the done queue has the entry
    const raw = await redis.lpop("cca:job:done:job-002:queue");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(result);
  });
});

// ─── token ───────────────────────────────────────────────────────────────────

describe("token.getMaster / token.setMaster", () => {
  let redis: Redis;

  beforeAll(() => { redis = makeRedis(); });
  // ioredis-mock shares global state across instances; flush between tests
  afterEach(async () => { await redis.flushall(); });
  afterAll(async () => { await redis.quit(); });

  it("setMaster + getMaster round-trip", async () => {
    const wire = createCcWire(redis);
    await wire.token.setMaster("secret-token-xyz");
    expect(await wire.token.getMaster()).toBe("secret-token-xyz");
  });

  it("getMaster throws when token not set", async () => {
    const wire = createCcWire(redis);
    await expect(wire.token.getMaster()).rejects.toThrow("master token not set");
  });
});

// ─── _redis escape hatch ─────────────────────────────────────────────────────

describe("_redis", () => {
  it("exposes the underlying redis client", () => {
    const redis = makeRedis();
    const wire = createCcWire(redis);
    expect(wire._redis).toBe(redis);
  });
});
