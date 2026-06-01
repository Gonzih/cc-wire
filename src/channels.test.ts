import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  wikiKey,
  wikiUpdatedKey,
  notifyChannel,
  notifyListKey,
  notifyLogKey,
  jobKey,
  jobIndexKey,
  chatLogKey,
  chatIncomingChannel,
  chatOutgoingChannel,
  metaKey,
  cronsKey,
  swarmKey,
  planKey,
  profileKey,
  learningsKey,
  TTL,
  CAP,
} from "./channels.js";

describe("wiki keys", () => {
  it("wikiKey builds correct hash key", () => {
    assert.equal(wikiKey("gonzih/cc-agent"), "cca:wiki:gonzih/cc-agent");
  });

  it("wikiUpdatedKey builds correct timestamp key", () => {
    assert.equal(
      wikiUpdatedKey("gonzih/cc-agent"),
      "cca:wiki:gonzih/cc-agent:updated"
    );
  });

  it("wikiKey and wikiUpdatedKey keys are distinct", () => {
    const slug = "org/repo";
    assert.notEqual(wikiKey(slug), wikiUpdatedKey(slug));
  });
});

describe("notify keys", () => {
  it("notifyChannel", () =>
    assert.equal(notifyChannel("myns"), "cca:notify:myns"));
  it("notifyListKey matches notifyChannel (dual-purpose key)", () =>
    assert.equal(notifyListKey("myns"), notifyChannel("myns")));
  it("notifyLogKey", () =>
    assert.equal(notifyLogKey("myns"), "cca:notify-log:myns"));
});

describe("job keys", () => {
  it("jobKey", () => assert.equal(jobKey("abc"), "cca:job:abc"));
  it("jobIndexKey", () =>
    assert.equal(jobIndexKey("ns"), "cca:jobs:ns"));
});

describe("chat keys", () => {
  it("chatLogKey", () =>
    assert.equal(chatLogKey("ns"), "cca:chat:log:ns"));
  it("chatIncomingChannel", () =>
    assert.equal(chatIncomingChannel("ns"), "cca:chat:incoming:ns"));
  it("chatOutgoingChannel", () =>
    assert.equal(chatOutgoingChannel("ns"), "cca:chat:outgoing:ns"));
});

describe("misc keys", () => {
  it("metaKey", () => assert.equal(metaKey("ns"), "cca:meta:ns"));
  it("cronsKey", () => assert.equal(cronsKey("ns"), "cca:crons:ns"));
  it("swarmKey", () => assert.equal(swarmKey("id"), "cca:swarm:id"));
  it("planKey", () => assert.equal(planKey("id"), "cca:plan:id"));
  it("profileKey", () =>
    assert.equal(profileKey("default"), "cca:profile:default"));
  it("learningsKey", () =>
    assert.equal(learningsKey("ns"), "cca:learnings:ns"));
});

describe("TTL and CAP constants are positive integers", () => {
  for (const [k, v] of Object.entries(TTL)) {
    it(`TTL.${k} > 0`, () => assert.ok(v > 0, `${k} should be positive`));
  }
  for (const [k, v] of Object.entries(CAP)) {
    it(`CAP.${k} > 0`, () => assert.ok(v > 0, `${k} should be positive`));
  }
});
