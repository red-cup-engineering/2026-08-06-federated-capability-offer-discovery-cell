import assert from "node:assert/strict";
import test from "node:test";
import { projectSenActivity, extractSenActivity, senActivityObjectBytes } from "@red-cup-engineering/activitypub-services-section/sen-activity";
import { receiveDiscoveryActivity } from "../src/receive-discovery-activity.mjs";

const ORIGIN = "https://discovery.example";
const IDENTIFIER = "discovery";
const ACTOR = `${ORIGIN}/actors/${IDENTIFIER}`;
const CARD = `${ORIGIN}/.well-known/agent-card.json`;
const BUYER = "https://buyer.example/actors/buyer";
const BUYER_CARD = "https://buyer.example/.well-known/agent-card.json";
const INBOX = BUYER + "/inbox";
const MOMENT = "2026-10-16T18:00:00.000Z";

function request(overrides = {}) {
  return {
    kind: "org.emsenn.capability-offer-discovery.request.v1",
    requestId: "buyer-1", operation: "*", observer: BUYER, evaluatedAt: MOMENT,
    endpoints: [{ outbox: "https://supplier.example/actors/supplier/outbox",
      actor: "https://supplier.example/actors/supplier",
      agentCard: "https://supplier.example/.well-known/agent-card.json" }],
    ...overrides,
  };
}
function arrival(value = request()) {
  return {
    // A native SEN projector owns an immutable authored activity; Fedify's
    // compact JSON-LD arrival is a separate decoded representation. Copy its
    // outer record so the negative tests can tamper with claimed actor text.
    jsonLd: { ...projectSenActivity({
      type: "Create", origin: "https://buyer.example", identifier: "buyer",
      recipient: ACTOR, agentCard: BUYER_CARD,
      objectBytes: senActivityObjectBytes({ objectKind: value.kind, value }),
      eventTime: MOMENT,
    }) },
    activity: { actorId: new URL(BUYER), actorIds: [new URL(BUYER)] },
    sender: { actorId: BUYER, inboxId: INBOX, sharedInboxId: null },
  };
}
function handlers(overrides = {}) {
  let delivered, observed = 0, runtimeLoaded = 0;
  const options = {
    origin: ORIGIN, identifier: IDENTIFIER, agentCard: CARD, now: () => MOMENT,
    loadRuntime: async () => {
      runtimeLoaded++;
      return { providers: {
        observe: async () => { observed++; return []; },
        record: async () => ({ id: "source-observation-only" }),
      } };
    },
    deliver: async (input) => { delivered = input; },
    ...overrides,
  };
  return {
    options, get delivered() { return delivered; },
    get observed() { return observed; }, get runtimeLoaded() { return runtimeLoaded; },
  };
}

test("provider-resolved signed sender receives the native SEN discovery result without another actor lookup", async () => {
  const h = handlers(), r = await receiveDiscoveryActivity(arrival(), h.options);
  assert.equal(r.kind, "DiscoveryResultDispatched");
  assert.equal(r.recipient, BUYER);
  assert.equal(r.admittedOffers, 0);
  assert.equal(h.observed, 1);
  assert.equal(h.delivered.recipient, BUYER);
  assert.equal(h.delivered.inbox, INBOX);
  const received = extractSenActivity(h.delivered.activity, {
    expectedActor: ACTOR, expectedRecipient: BUYER, expectedAgentCard: CARD,
  });
  assert.equal(received.type, "Accept");
  assert.equal(received.cloudEvent.source, ACTOR);
  assert.match(received.objectNi, /^ni:\/\/\/sha-256;/u);
});

test("cross-principal observer spoofing is refused before any discovery or publication", async () => {
  const h = handlers(), forged = arrival(request({ observer: "https://another.example/actors/other" }));
  await assert.rejects(() => receiveDiscoveryActivity(forged, h.options), /signed sender actor/);
  assert.equal(h.observed, 0);
  assert.equal(h.delivered, undefined);
});

test("signed provider identity and JSON-LD claimed actor cannot disagree", async () => {
  for (const mutate of [
    a => { a.sender.actorId = "https://other.example/actors/other"; },
    a => { a.activity.actorId = new URL("https://other.example/actors/other"); },
    a => { a.jsonLd.actor = "https://other.example/actors/other"; },
    a => { delete a.sender; },
  ]) {
    const a = arrival(), h = handlers();
    mutate(a);
    await assert.rejects(() => receiveDiscoveryActivity(a, h.options),
      /provider-resolved signed sender/);
    assert.equal(h.runtimeLoaded, 0);
    assert.equal(h.delivered, undefined);
  }
});

test("a valid signed actor can carry compact expanded JSON-LD actor objects", async () => {
  const a = arrival();
  a.jsonLd = { ...a.jsonLd, actor: { id: BUYER } };
  const h = handlers(), r = await receiveDiscoveryActivity(a, h.options);
  assert.equal(r.recipient, BUYER);
  assert.equal(h.delivered.inbox, INBOX);
});

test("invalid resolved inbox is refused before source acquisition or record creation", async () => {
  for (const inboxId of ["ftp://localhost/private", "file:///tmp/private",
    "http://market.example/private", "https://user:pass@buyer.example/inbox",
    "https://buyer.example/inbox#different", "relative/inbox"]) {
    const a = arrival(), h = handlers();
    a.sender.inboxId = inboxId;
    await assert.rejects(() => receiveDiscoveryActivity(a, h.options),
      /resolved ActivityPub inbox|no resolved ActivityPub inbox/);
    assert.equal(h.runtimeLoaded, 0);
    assert.equal(h.delivered, undefined);
  }
});

test("wrong SEN request kind cannot cause a market discovery or reply", async () => {
  const h = handlers(), a = arrival({ ...request(), kind: "org.other.unrelated.v1" });
  await assert.rejects(() => receiveDiscoveryActivity(a, h.options), /not a discovery request/);
  assert.equal(h.runtimeLoaded, 0);
  assert.equal(h.delivered, undefined);
});

test("self-activity is ignored only after its actor has been resolved by the provider", async () => {
  const h = handlers();
  assert.deepEqual(await receiveDiscoveryActivity({
    jsonLd: { actor: ACTOR },
    activity: { actorId: new URL(ACTOR), actorIds: [new URL(ACTOR)] },
    sender: { actorId: ACTOR, inboxId: ACTOR + "/inbox" },
  }, h.options), { ignored: "self-activity" });
  assert.equal(h.runtimeLoaded, 0);
  await assert.rejects(() => receiveDiscoveryActivity({
    jsonLd: { actor: ACTOR },
  }, h.options), /provider-resolved signed sender/);
});
