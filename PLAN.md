# PLAN — cc-suite notification routing fix (cc-wire side)

## Task restatement

Research the full message routing flow across cc-suite (cc-discord, cc-tg, cc-agent)
and fix the broken routing: jobs spawned from a simorgh-mobile-app Discord channel
complete and notify money-brain (Telegram) instead of routing back to the originating
Discord channel.

The cc-wire repo's deliverables are:
1. Add `spawning_namespace` to `SpawnParams` in types.ts (currently missing)
2. Document the broken vs correct routing flow in README
3. Open GitHub issues on cc-discord and cc-agent describing the exact code changes needed

## Diagnosis

### Broken flow
1. Discord user sends message in `#simorgh-mobile-app` channel
2. cc-discord calls `routeToMetaAgent("simorgh-mobile-app", ...)` → RPUSH to `cca:meta:simorgh-mobile-app:input`
3. cc-agent meta-agent picks up the message, decides to spawn a sub-job
4. Meta-agent calls `spawn_agent` MCP tool WITHOUT `spawning_namespace` — cc-agent's MCP
   server does NOT auto-inject it (unlike cc-tg which does explicitly)
5. Coordinator processes job completion: `targetNamespace = spawningNamespace ?? this.namespace`
   → falls back to `money-brain` (coordinator's own namespace)
6. Coordinator publishes to `cca:notify:money-brain`
7. cc-tg (subscribed to `cca:notify:money-brain`) picks it up → sends to Telegram (WRONG)

### Root causes (two separate bugs)

**Bug A — cc-agent**: The `spawn_agent` MCP handler does not auto-inject
`spawning_namespace` when called from within a meta-agent context. cc-tg works around
this by injecting it client-side, but meta-agents running in cc-agent cannot.

**Bug B — cc-discord**: The notifier subscribes only to `cca:notify:{CC_AGENT_NAMESPACE}`
(a single hardcoded env-var namespace). Even if fix A is applied, notifications routed
to `cca:notify:simorgh-mobile-app` would go unheard by cc-discord because it never
subscribed to that channel.

### Correct flow (after both fixes)
1. Discord user → `#simorgh-mobile-app` → cc-discord
2. cc-discord → RPUSH to `cca:meta:simorgh-mobile-app:input`
3. Meta-agent spawns sub-job via `spawn_agent`; cc-agent auto-injects
   `spawning_namespace: "simorgh-mobile-app"` for the meta-agent context
4. Coordinator: `targetNamespace = "simorgh-mobile-app"`
5. Publishes to `cca:notify:simorgh-mobile-app`
6. cc-discord (subscribed to `cca:notify:simorgh-mobile-app`) delivers to `#simorgh-mobile-app` (CORRECT)

## Changes in cc-wire (this repo)

### 1. `src/types.ts` — Add `spawning_namespace` to `SpawnParams`
The `SpawnParams` interface is the canonical type for job-spawn parameters, but it is
missing the `spawning_namespace` field that cc-tg injects and cc-agent stores/reads.
Adding it documents the contract and lets consumers type-check spawn calls.

### 2. `README.md` — Document the routing flow
Add a "Notification Routing" section that:
- Shows the broken flow (no spawning_namespace → defaults to coordinator ns)
- Shows the correct flow (spawning_namespace set → routes back to originator)
- Maps each hop to the exact Redis key/channel from cc-wire
- Describes what each repo must do

## GitHub issues to open
- `gonzih/cc-agent`: "fix: auto-inject spawning_namespace for meta-agent-spawned jobs"
- `gonzih/cc-discord`: "fix: subscribe to cca:notify:{ns} per namespace and route back to Discord channel"

## Files touched
- `src/types.ts`
- `README.md`
- `package.json` (version bump)

## Risks / unknowns
- `spawning_namespace` in SpawnParams is additive/optional — no breaking change.
- cc-agent meta-agent context propagation mechanism needs the issue to spell out the
  expected implementation contract clearly.
