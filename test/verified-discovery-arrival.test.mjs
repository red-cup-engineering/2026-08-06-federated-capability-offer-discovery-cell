import assert from "node:assert/strict";
import test from "node:test";
import { resolvedSender, resolvedInbox } from "../src/verified-discovery-arrival.mjs";

const actor = "https://buyer.example/actors/buyer";
const valid = () => ({
  jsonLd: { actor },
  activity: { actorId: new URL(actor) },
  sender: { actorId: actor, inboxId: actor + "/inbox" },
});

test("Fedify-resolved actor and inbox are consumed unchanged without a network fetch", () => {
  const input = valid();
  assert.equal(resolvedSender(input), actor);
  assert.equal(resolvedInbox(input), actor + "/inbox");
  input.jsonLd.actor = { id: actor };
  assert.equal(resolvedSender(input), actor);
});

test("forged or unresolved incoming actors are rejected", () => {
  const changes = [
    a => { a.sender.actorId = "https://other.example/actors/other"; },
    a => { a.activity.actorId = new URL("https://other.example/actors/other"); },
    a => { a.jsonLd.actor = "https://other.example/actors/other"; },
    a => { delete a.sender; },
    a => { delete a.activity; },
  ];
  for (const mutate of changes) {
    const input = valid();
    mutate(input);
    assert.throws(() => resolvedSender(input), /provider-resolved signed sender/);
  }
});

test("only the original provider-resolved HTTPS inbox or HTTP loopback is admissible", () => {
  assert.equal(resolvedInbox(valid()), actor + "/inbox");
  for (const href of [
    "http://localhost:8080/actors/abc/inbox",
    "http://127.0.0.1:8080/inbox",
    "https://another-transport.example/inbox",
  ]) {
    const input = valid(); input.sender.inboxId = href;
    assert.equal(resolvedInbox(input), href);
  }
  for (const href of [
    "ftp://localhost/private", "file:///tmp/private",
    "http://market.example/private", "https://user:pass@buyer.example/inbox",
    "https://buyer.example/inbox#fragment", "relative/inbox", null,
  ]) {
    const input = valid(); input.sender.inboxId = href;
    assert.throws(() => resolvedInbox(input), /resolved ActivityPub inbox|no resolved ActivityPub inbox/);
  }
});
