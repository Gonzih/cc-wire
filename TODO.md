# TODO: effort_level and fast_mode fields

- [ ] Add EffortLevel union type to src/types.ts
- [ ] Add effort_level and fast_mode to JobRecord
- [ ] Add SpawnParams interface
- [ ] Extract PlanStep interface from PlanRecord inline type and add fields
- [ ] Update CoordinatorPlan.next_step to include effort_level and fast_mode
- [ ] npm run build (verify clean compile)
- [ ] git checkout -b feat/effort-fast-types
- [ ] git add + git diff --staged + git commit
- [ ] git push + gh pr create + gh pr merge
- [ ] npm version patch + npm publish
