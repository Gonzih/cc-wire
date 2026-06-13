# TODO — cc-wire v0.2.0 service ownership redesign

- [x] Read all source files and plan
- [ ] git checkout -b feat/service-ownership-v0.2
- [ ] src/channels.ts — add service-scoped discord/tg key builders
- [ ] src/channels.ts — add CC_DISCORD_WORKSPACE_ROOT + CC_TG_WORKSPACE constants
- [ ] src/channels.ts — deprecate metaInputKey, META_AGENTS_INDEX, metaAgentStatusKey
- [ ] src/types.ts — add "discord" to ChatMessage.source union
- [ ] src/types.ts — add service field to ChatMessage
- [ ] src/types.ts — add namespace field to ChatMessage
- [ ] src/channels.test.ts — tests for new builders and constants
- [ ] npm run build — verify passes
- [ ] npm test — verify all tests pass
- [ ] README.md — rewrite for new architecture
- [ ] git diff --staged — verify changes match intent
- [ ] git add + commit
- [ ] npm version minor (→ 0.2.0)
- [ ] npm publish --access public
- [ ] git push + gh pr create + gh pr merge --squash --auto
