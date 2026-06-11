# TODO — cc-suite notification routing fix

- [x] Research cc-discord: subscribe pattern, spawning, notification routing
- [x] Research cc-tg: spawning_namespace injection, notify channels
- [x] Research cc-agent: coordinator namespace fallback, spawningNamespace flow
- [x] Write PLAN.md with diagnosis and correct flow
- [ ] git checkout -b feat/routing-flow-fix
- [ ] Add `spawning_namespace` to `SpawnParams` in src/types.ts
- [ ] Add Notification Routing section to README.md (broken flow, correct flow, Redis keys)
- [ ] npm run build — verify build passes
- [ ] npm test — verify all tests pass
- [ ] git add + git diff --staged — verify changes
- [ ] git commit
- [ ] npm version patch && npm publish --access public
- [ ] gh pr create + gh pr merge --squash --auto
- [ ] gh issue create on gonzih/cc-agent (Bug A: auto-inject spawning_namespace)
- [ ] gh issue create on gonzih/cc-discord (Bug B: per-namespace notify subscriptions)
