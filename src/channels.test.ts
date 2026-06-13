import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  wikiKey,
  wikiUpdatedKey,
  notifyChannel,
  notifyListKey,
  notifyLogKey,
  notifyPublishCommand,
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
  discordMetaInputKey,
  discordMetaStatusKey,
  discordChatOutgoing,
  discordChatLog,
  discordChatIncoming,
  discordNotify,
  tgChatOutgoing,
  tgChatIncoming,
  tgNotify,
  CC_DISCORD_WORKSPACE_ROOT,
  CC_TG_WORKSPACE,
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

describe("notifyPublishCommand", () => {
  it("produces a redis-cli PUBLISH command", () => {
    const cmd = notifyPublishCommand("myns", { text: "hello" });
    assert.ok(cmd.startsWith("redis-cli PUBLISH"), "starts with redis-cli PUBLISH");
    assert.ok(cmd.includes("cca:notify:myns"), "contains channel");
    assert.ok(cmd.includes('"text":"hello"'), "contains JSON payload");
  });

  it("includes routing field when present", () => {
    const cmd = notifyPublishCommand("myns", {
      text: "hi",
      routing: ["discord"],
    });
    assert.ok(cmd.includes('"routing":["discord"]'), "routing present in JSON");
  });

  it("includes chat_id when present", () => {
    const cmd = notifyPublishCommand("myns", {
      text: "hi",
      chat_id: 12345,
    });
    assert.ok(cmd.includes('"chat_id":12345'), "chat_id present in JSON");
  });

  it("escapes single quotes in payload text", () => {
    const cmd = notifyPublishCommand("myns", { text: "it's fine" });
    assert.ok(!cmd.includes("it's fine"), "raw single-quote not present");
    assert.ok(cmd.includes("it"), "text content still present");
  });
});

describe("cc-discord keys", () => {
  it("discordMetaInputKey", () =>
    assert.equal(discordMetaInputKey("simorgh"), "cca:discord:meta:simorgh:input"));
  it("discordMetaStatusKey", () =>
    assert.equal(discordMetaStatusKey("simorgh"), "cca:discord:meta:simorgh:status"));
  it("discordChatOutgoing", () =>
    assert.equal(discordChatOutgoing("simorgh"), "cca:discord:chat:outgoing:simorgh"));
  it("discordChatLog", () =>
    assert.equal(discordChatLog("simorgh"), "cca:discord:chat:log:simorgh"));
  it("discordChatIncoming", () =>
    assert.equal(discordChatIncoming("simorgh"), "cca:discord:chat:incoming:simorgh"));
  it("discordNotify", () =>
    assert.equal(discordNotify("simorgh"), "cca:discord:notify:simorgh"));
  it("discordMetaInputKey and discordMetaStatusKey are distinct for same ns", () =>
    assert.notEqual(discordMetaInputKey("ns"), discordMetaStatusKey("ns")));
  it("discord keys differ from legacy meta keys for same ns", () => {
    assert.notEqual(discordMetaInputKey("ns"), `cca:meta:ns:input`);
    assert.notEqual(discordNotify("ns"), `cca:notify:ns`);
  });
});

describe("cc-tg keys", () => {
  it("tgChatOutgoing is static", () =>
    assert.equal(tgChatOutgoing(), "cca:tg:chat:outgoing"));
  it("tgChatIncoming is static", () =>
    assert.equal(tgChatIncoming(), "cca:tg:chat:incoming"));
  it("tgNotify is static", () =>
    assert.equal(tgNotify(), "cca:tg:notify"));
  it("tgChatOutgoing and tgChatIncoming are distinct", () =>
    assert.notEqual(tgChatOutgoing(), tgChatIncoming()));
  it("tgNotify differs from discordNotify", () =>
    assert.notEqual(tgNotify(), discordNotify("any-ns")));
});

describe("service ownership constants", () => {
  it("CC_DISCORD_WORKSPACE_ROOT is set", () =>
    assert.equal(CC_DISCORD_WORKSPACE_ROOT, "cc-discord-workspace"));
  it("CC_TG_WORKSPACE is set", () =>
    assert.equal(CC_TG_WORKSPACE, "money-brain"));
  it("CC_DISCORD_WORKSPACE_ROOT and CC_TG_WORKSPACE are distinct", () =>
    assert.notEqual(CC_DISCORD_WORKSPACE_ROOT, CC_TG_WORKSPACE));
});

describe("TTL and CAP constants are positive integers", () => {
  for (const [k, v] of Object.entries(TTL)) {
    it(`TTL.${k} > 0`, () => assert.ok(v > 0, `${k} should be positive`));
  }
  for (const [k, v] of Object.entries(CAP)) {
    it(`CAP.${k} > 0`, () => assert.ok(v > 0, `${k} should be positive`));
  }
});
