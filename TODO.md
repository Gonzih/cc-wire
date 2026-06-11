# TODO: NotificationPayload type and routing field

- [ ] Add `Transport` type to `src/types.ts`
- [ ] Add `routing?: Transport[]` to `NotificationPayload` in `src/types.ts`
- [ ] Add `notifyPublishCommand` builder to `src/channels.ts`
- [ ] Add tests for `notifyPublishCommand` in `src/channels.test.ts`
- [ ] Update README with new types and builder usage
- [ ] `git checkout -b feat/notification-payload-type`
- [ ] `npm run build` — verify build passes
- [ ] `npm test` — verify all tests pass
- [ ] `git add -A && git diff --staged` — verify changes
- [ ] `git commit`
- [ ] `npm version patch && npm publish --access public`
- [ ] `gh pr create` + `gh pr merge --squash --auto`
