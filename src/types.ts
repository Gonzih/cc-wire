/**
 * cc-wire: types.ts
 *
 * TypeScript interfaces for every message payload and record shape
 * published/stored on each Redis channel or key across the cc-suite.
 *
 * Derived from actual source: cc-agent/src/types.ts, cc-agent/src/store.ts,
 * cc-agent/src/meta-agent.ts, cc-tg/src/notifier.ts, cc-agent-ui/server.js,
 * and docs/redis-protocol.md (both repos).
 */

// ─── Job Status ───────────────────────────────────────────────────────────────

export type JobStatus =
  | "pending"
  | "cloning"
  | "running"
  | "done"
  | "failed"
  | "cancelled"
  | "sleeping"
  | "pending_approval"
  | "rejected"
  | "interrupted";

// ─── Job Record (cca:job:{id}) ────────────────────────────────────────────────

/**
 * Full job metadata stored in `cca:job:{id}`.
 * JSON-encoded string, TTL 7 days.
 */
export interface JobRecord {
  id: string;
  status: JobStatus;
  repoUrl: string;
  task: string;
  branch?: string;
  createBranch?: string;
  dependsOn?: string[];
  startedAt?: string;           // ISO 8601
  finishedAt?: string;          // ISO 8601
  exitCode?: number;
  error?: string;
  pid?: number;
  sessionIdAfter?: string;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCacheReadTokens?: number;
  totalCacheWriteTokens?: number;
  costUsd?: number;
  recentTools: string[];
  outputLineCount: number;
  sleepUntil?: string;          // ISO 8601 — set when status is "sleeping"
  sleepReason?: string;
  approvalIssueUrl?: string;
  approvalRepo?: string;
  approvalIssueNumber?: number;
  score?: number | null;        // 0.0 – 1.0
  scoreSource?: "self_reported" | "heuristic" | null;
  variantIndex?: number;
  parentVariant?: string;
  siblings?: string[];
  dockerIsolation?: boolean;
  isolation?: "docker" | "host";
  resumedFrom?: string;
  interruptedAt?: string;       // ISO 8601
  tokenIndex?: number;
  agentDriver?: string;
  agentModel?: string;
  noPreamble?: boolean;
  retryCount?: number;
  timeoutMinutes?: number;
  timedOut?: boolean;
  failReason?: string;
}

// ─── Job Signal (cca:job:{id}:signal) ────────────────────────────────────────

/** Values that may be written to `cca:job:{id}:signal`. */
export type JobSignal = "cancel" | "wake";

// ─── Job Done Payload (cca:job:done:{id}) ─────────────────────────────────────

/**
 * JSON payload published to `cca:job:done:{id}` and LPUSH'd to
 * `cca:job:done:{id}:queue`.
 */
export interface JobDonePayload {
  job_id: string;
  status: JobStatus;
  score?: number | null;
  score_source?: "self_reported" | "heuristic" | null;
  finished_at?: string;         // ISO 8601
  exit_code?: number;
}

// ─── Event Stream Entry (cca:event-stream) ────────────────────────────────────

/**
 * Fields written to `cca:event-stream` via XADD.
 * All field values are strings (Redis Stream requirement).
 */
export interface JobEvent {
  jobId: string;
  status: string;
  title: string;                // First line of task, truncated to 120 chars
  repoUrl: string;
  lastLines: string[];          // JSON-encoded array of last 5 output lines
  score?: number;
  timestamp: string;            // ISO 8601
  coordinatorPlan?: CoordinatorPlan;
}

// ─── Coordinator Plan ─────────────────────────────────────────────────────────

/** Optional follow-up job plan attached to a job event. */
export interface CoordinatorPlan {
  next_step?: {
    repo_url: string;
    task: string;
  };
  summary?: string;
}

// ─── Notification Payload (cca:notify:{namespace}) ───────────────────────────

/**
 * JSON payload published to `cca:notify:{namespace}` and LPUSH'd to
 * `cca:notify-log:{namespace}`.
 */
export interface NotificationPayload {
  text: string;
  driver?: string;
  model?: string;
  cost?: number;
}

// ─── Chat Message (cca:chat:log:{ns}, cca:chat:outgoing:{ns}, cca:chat:incoming:{ns}) ──

/**
 * Shape for all messages written to chat channels and the chat log.
 *
 * Ordering note: `cca:chat:log:{ns}` is LIFO (LPUSH). Consumers must reverse
 * the LRANGE result for chronological display.
 */
export interface ChatMessage {
  id: string;                                               // UUID
  source: "telegram" | "ui" | "claude" | "cc-tg";
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: string;                                        // ISO 8601
  chatId: number;                                           // 0 for non-Telegram
}

// ─── Meta-Agent State (cca:meta:{namespace}) ──────────────────────────────────

/**
 * Persisted meta-agent state stored in `cca:meta:{namespace}`.
 * JSON-encoded string, TTL 30 days.
 */
export interface MetaAgentInfo {
  namespace: string;
  repoUrl: string;
  cwd: string;
  pid?: number;
  status: "running" | "idle";
  startedAt: string;            // ISO 8601
  lastMessageAt?: string;       // ISO 8601
  lastActivity?: string;        // ISO 8601 of last tool use or message
  currentTool?: string;         // e.g. "Bash", "Read"
  isTyping?: boolean;
  lastMessage?: string;         // last ~80 chars of last assistant message
  turnCount?: number;
}

// ─── Meta-Agent Live Status (cca:meta-agent:status:{namespace}) ───────────────

/**
 * Live status written to `cca:meta-agent:status:{namespace}` on every change.
 * JSON-encoded string, TTL 7 days.
 */
export interface MetaAgentStatus {
  namespace: string;
  status: "running" | "idle";
  pid?: number;
  startedAt?: string;           // ISO 8601
  lastActivity?: string;        // ISO 8601
  currentTool?: string;
  isTyping: boolean;
  lastMessage?: string;
  turnCount: number;
  updatedAt: string;            // ISO 8601
}

// ─── Profile (cca:profile:{name}) ─────────────────────────────────────────────

/**
 * Saved spawn profile stored in `cca:profile:{name}`.
 * JSON-encoded string (no TTL).
 */
export interface Profile {
  name: string;
  repoUrl: string;
  taskTemplate: string;         // supports {{variable}} interpolation
  defaultBudgetUsd?: number;
  branch?: string;
  description?: string;
  preamble?: string;
  builtin?: boolean;
  createdAt: string;            // ISO 8601
}

// ─── Plan Record (cca:plan:{id}) ──────────────────────────────────────────────

/**
 * Multi-step plan record stored in `cca:plan:{id}`.
 * JSON-encoded string, TTL 30 days.
 */
export interface PlanRecord {
  id: string;
  goal: string;
  steps: Array<{
    stepId: string;
    jobId: string;
    status: string;
  }>;
  createdAt: string;            // ISO 8601
}

// ─── Cron Job (cca:crons:{namespace}) ────────────────────────────────────────

/**
 * A single cron job entry inside the JSON array at `cca:crons:{namespace}`.
 */
export interface CronJob {
  id: string;
  schedule: string;             // cron expression or human interval (e.g. "every 1h")
  prompt: string;
  createdAt: string;            // ISO 8601
}

// ─── Swarm Record (cca:swarm:{swarm_id}) ──────────────────────────────────────

/**
 * Swarm orchestration record stored in `cca:swarm:{swarm_id}`.
 * JSON-encoded string.
 */
export interface SwarmRecord {
  swarm_id: string;
  [key: string]: unknown;       // additional fields vary by swarm type
}

// ─── Voice Pending Entry (voice:pending) ──────────────────────────────────────

/**
 * Entry in the `voice:pending` list (RPUSH'd by cc-tg).
 * JSON-encoded string.
 */
export interface VoicePendingEntry {
  id: string;
  chatId: number;
  threadId?: number;
  filePath: string;
  enqueuedAt: string;           // ISO 8601
}

// ─── Token Usage ──────────────────────────────────────────────────────────────

/** Token usage breakdown reported by agent drivers. */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}
