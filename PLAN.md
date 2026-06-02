# PLAN — effort_level and fast_mode in cc-wire types

## Task restatement
Add optional `effort_level` and `fast_mode` fields to the relevant TypeScript interfaces in
`src/types.ts` so that cc-agent (writer) and cc-agent-ui (reader) share a single type source.

## Approach
Single approach — direct, non-breaking type additions. All new fields are optional (`?`).

Changes to `src/types.ts`:
1. Export a named `EffortLevel` union type (avoids repeating the literal union in every interface).
2. Add `effort_level?: EffortLevel` and `fast_mode?: boolean` to `JobRecord`.
3. Add `SpawnParams` interface — the parameter bag used when creating a job (used by cc-agent's
   spawn RPC and coordinator's next_step). Includes `effort_level` and `fast_mode`.
4. Extract the inline plan-step shape to a named `PlanStep` interface, add the two fields, and
   update `PlanRecord.steps` to use `PlanStep[]`.
5. Update `CoordinatorPlan.next_step` inline type to include `effort_level` and `fast_mode`
   (coordinator inherits the spawn parameters it passes to the next job).

## Files touched
- `src/types.ts` — add type / interfaces

## Risks / unknowns
- None — all fields are optional, no breaking changes.
