# TODO — cc-wire v0.3.0 runtime

- [x] Read all source files and plan
- [ ] git checkout -b feat/runtime-v0.3
- [ ] npm install ioredis ioredis-mock vitest (pin peer dep, dev deps)
- [ ] src/runtime.ts — createCcWire factory + CcWire interface + private key helpers
- [ ] src/runtime.test.ts — Vitest tests: discord enqueue/dequeue, publishOutgoing, setStatus/getStatus, subscribeOutgoing, tg.publishOutgoing/subscribeOutgoing
- [ ] vitest.config.ts — minimal Vitest node config
- [ ] src/index.ts — add export from runtime
- [ ] package.json — peerDep ioredis, devDep ioredis-mock + vitest, update test script
- [ ] npm run build — verify passes
- [ ] npm test — verify all tests pass (node + vitest)
- [ ] README.md — add createCcWire section
- [ ] git diff --staged — verify changes match intent
- [ ] git add + commit
- [ ] npm version minor (→ 0.3.0)
- [ ] npm publish --access public
- [ ] git push + gh pr create + gh pr merge --squash --auto
