import assert from "node:assert/strict";
import test from "node:test";
import { makeNiUri } from "@red-cup-engineering/uri-services-section/ni-uri";
import { projectSenActivity, senActivityObjectBytes } from "@red-cup-engineering/activitypub-services-section/sen-activity";
import { listAddressedSenOutbox } from "@red-cup-engineering/activitypub-services-section/sen-outbox-client";
import { ACTIVITYSTREAMS_PUBLIC } from "@red-cup-engineering/activitypub-services-section/activitystreams";
import { discoverFederatedCapabilityOffers } from "../lib/discovery.mjs";

const ACTOR = "https://seller.example/actors/seller";
const OUTBOX = `${ACTOR}/outbox`;
const CARD = "https://seller.example/.well-known/agent-card.json";
const OBSERVER = "https://buyer.example/actors/buyer";
const BASE = "2026-10-16T16:00:00.000Z";
const ni = (text) => makeNiUri(Buffer.from(text));

function offer(overrides = {}) {
  return {
    kind: "org.emsenn.capability-offer.v3", cell: ni("test-cell"), sku: ni("test-sku"),
    provider: ACTOR, operation: "test-operation", law: ni("test-law"),
    seller: { enterprise: "territory-a", entity: "sovereign-settlement-a" },
    book: { enterprise: "territory-a", account: "Income:TerritoryA" },
    agentCard: CARD,
    authorization: { profile: "x402", grantRequired: false },
    price: { protocol: "x402", asset: "0x" + "1".repeat(40), amount: "70000", network: "eip155:8453" },
    sourceRightsVerification: "unassayed",
    coordinates: {
      signedAgentCard: { kind: "reference", href: CARD },
      packageOperation: { kind: "reference", href: "https://seller.example/npm",
        operation: "test-operation", consumes: ["application/json"], emits: ["application/json"],
        invocation: "https://seller.example/v1/test-operation" },
      deploymentHealth: { kind: "reference", href: "https://seller.example/healthz" },
      resourceMeter: { kind: "org.emsenn.capability-offer.coordinate-residual.v1",
        coordinate: "resourceMeter", state: "missing", reason: "supplier meter not published" },
      settlementReturn: { kind: "org.emsenn.capability-offer.coordinate-residual.v1",
        coordinate: "settlementReturn", state: "missing", reason: "not a payment receipt" },
    },
    expiresAt: "2027-10-16T16:00:00.000Z",
    ...overrides,
  };
}
function request(overrides = {}) {
  return {
    kind: "org.emsenn.capability-offer-discovery.request.v1",
    requestId: "research-1", operation: "test-operation",
    observer: OBSERVER, evaluatedAt: BASE,
    maximumCandidates: 8, endpoints: [{ outbox: OUTBOX, actor: ACTOR, agentCard: CARD }],
    ...overrides,
  };
}
function signedOffer(value = offer()) {
  const objectBytes = senActivityObjectBytes({ objectKind: value.kind, value });
  return projectSenActivity({
    type: "Offer", origin: "https://seller.example", identifier: "seller",
    recipient: ACTIVITYSTREAMS_PUBLIC, objectBytes, agentCard: CARD,
    eventTime: BASE,
  });
}
async function study(activity = signedOffer(), overrides = {}, extras = {}) {
  const records = [];
  const provider = {
    observe: input => listAddressedSenOutbox({
      ...input, authorizeUrl: async () => {}, fetcher: async () => ({
        ok: true, json: async () => ({
          type: "OrderedCollection", orderedItems: [activity],
        }),
      }),
    }),
    record: async entry => { records.push(entry); return { settlement: "study-receipt-no-purchase" }; },
    ...extras,
  };
  return { result: await discoverFederatedCapabilityOffers(request(overrides), provider, { now: BASE }), records };
}

test("current x402 SEN ActivityPub++ seller turns into a bounded discoverable candidate", async () => {
  const { result, records } = await study();
  assert.equal(result.completeness, "supplied-denominator-only");
  assert.deepEqual(result.denominator, [OUTBOX]);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].kind, "org.emsenn.capability-offer.v3",
    "the native current offer must feed the existing Coesite provider-market matcher");
  assert.match(result.candidates[0].offer, /^ni:\/\/\/sha-256;/u);
  assert.equal(result.candidates[0].publisher, ACTOR);
  assert.equal(result.candidates[0].provider, ACTOR);
  assert.equal(result.candidates[0].seller.enterprise, "territory-a");
  assert.equal(result.candidates[0].book.account, "Income:TerritoryA");
  assert.equal(result.candidates[0].authorization.profile, "x402");
  assert.equal(result.candidates[0].price.network, "eip155:8453");
  assert.equal(result.candidates[0].price.amount, "70000");
  assert.equal(result.candidates[0].sourceRightsVerification, "unassayed");
  assert.equal(result.candidates[0].sourceRightsClaim, null,
    "absence of a license claim is unknown, not commercial clearance");
  assert.equal(result.residuals.length, 2);
  assert.equal(result.receipt.settlement, "study-receipt-no-purchase");
  assert.equal(records.length, 1);
  assert.equal(records[0].record.receipt, undefined);
});

test("source request identity is invariant to object key insertion order", async () => {
  const ids = [];
  const publisher = {
    observe: async () => [],
    record: async ({ record }) => { ids.push(record.request); return {}; },
  };
  const original = request();
  const reordered = Object.fromEntries(Object.entries(original).reverse());
  await discoverFederatedCapabilityOffers(original, publisher, { now: BASE });
  await discoverFederatedCapabilityOffers(reordered, publisher, { now: BASE });
  assert.equal(ids[0], ids[1]);
  assert.match(ids[0], /^ni:\/\/\/sha-256;/u);
});

test("a contradictory signed actor or swapped SEN bytes cannot masquerade as an x402 provider", async () => {
  const foreignSeller = signedOffer(offer({ provider: "https://other.example/actors/impersonator" }));
  const result = (await study(foreignSeller)).result;
  assert.equal(result.candidates.length, 0);
  assert.match(result.refusals[0].reason, /seller-provided x402 offer actor/u);

  const corrupt = structuredClone(signedOffer());
  corrupt.object.name = ni("unrelated bytes");
  const different = (await study(corrupt)).result;
  assert.equal(different.candidates.length, 0);
  assert.match(different.refusals[0].reason, /SEN bytes do not match|ni identity/u);
});

test("source expiry and missed publication coordinates remain explicit, not paid acceptance", async () => {
  const expired = await study(signedOffer(offer({ expiresAt: "2026-10-15T00:00:00.000Z" })));
  assert.deepEqual(expired.result.candidates, []);
  const short = offer(); delete short.coordinates;
  const missing = await study(signedOffer(short));
  assert.equal(missing.result.candidates.length, 1);
  assert.equal(missing.result.residuals.length, 5);
  assert.equal(missing.result.candidates[0].coordinates.resourceMeter.state, "missing");
});

test("endpoint errors preserve incomplete coverage, and duplicate outboxes are refused", async () => {
  const bad = await discoverFederatedCapabilityOffers(request(), {
    observe: async () => { throw new Error("peer outbox unavailable"); },
    record: async () => {},
  });
  assert.equal(bad.candidates.length, 0);
  assert.deepEqual(bad.refusals, [{ outbox: OUTBOX, reason: "peer outbox unavailable" }]);
  assert.equal(bad.completeness, "supplied-denominator-only");
  await assert.rejects(() => discoverFederatedCapabilityOffers(request({
    endpoints: [request().endpoints[0], request().endpoints[0]],
  }), { observe: async () => [], record: async () => {} }), /duplicate outboxes/u);
});

test("source rights survive as publisher testimony but cannot become permission to resell", async () => {
  const claims = {
    basis: "stated-by-provider",
    sourceUrl: "https://seller.example/data",
    licenseUrl: "https://seller.example/license",
    permissions: ["computed-output"],
    evidenceNis: [ni("publisher-license-copy")],
    observedAt: BASE,
  };
  const v = (await study(signedOffer(offer({ sourceRightsClaim: claims })))).result;
  assert.equal(v.candidates.length, 1);
  assert.deepEqual(v.candidates[0].sourceRightsClaim, claims);
  assert.equal(v.candidates[0].sourceRightsVerification, "unassayed");
  assert.equal(v.receipt.settlement, "study-receipt-no-purchase");
});

test("paged sovereign seller feeds all 131 exact SEN offers without false ACK or candidate truncation", async () => {
  const activities = Array.from({ length: 131 }, (_, index) =>
    signedOffer(offer({ sku: ni("independent-seller-offer-" + index) })));
  const pages = [];
  for (let index = 0; index < activities.length; index += 12) {
    const number = pages.length + 1;
    pages.push({
      id: OUTBOX + "?page=" + number,
      type: "OrderedCollectionPage",
      partOf: OUTBOX,
      orderedItems: activities.slice(index, index + 12),
      ...(index + 12 < activities.length ? { next: OUTBOX + "?page=" + (number + 1) } : {}),
    });
  }
  const responses = new Map([[OUTBOX, {
    id: OUTBOX, type: "OrderedCollection", totalItems: activities.length,
    first: pages[0].id,
  }], ...pages.map(page => [page.id, page])]);
  const read = async url => {
    const value = responses.get(url);
    return value ? Response.json(value) : new Response(null, { status: 404 });
  };
  const records = [];
  const observer = {
    observe: (input) => listAddressedSenOutbox({ ...input, fetcher: read, authorizeUrl: async () => {} }),
    record: async entry => { records.push(entry); return { settlement: "study-only-no-purchase" }; },
  };
  const result = await discoverFederatedCapabilityOffers(request(), observer, { now: BASE });
  assert.equal(result.candidates.length, 131,
    "maximumCandidates is a legacy hint, not a truncated peer denominator");
  assert.equal(new Set(result.candidates.map(row => row.activity)).size, 131);
  assert.equal(new Set(result.candidates.map(row => row.sku)).size, 131);
  assert.deepEqual(result.refusals, []);
  assert.ok(result.candidates.every(row =>
    row.seller.enterprise === "territory-a" && row.book.account === "Income:TerritoryA" &&
    row.price.amount === "70000" && row.sourceRightsVerification === "unassayed"));
  assert.equal(result.receipt.settlement, "study-only-no-purchase");
  assert.equal(records.length, 1);
  assert.equal(records[0].record.receipt, undefined);

  const withheldRecords = [];
  const constrained = await discoverFederatedCapabilityOffers(request(), {
    observe: (input) => listAddressedSenOutbox({ ...input, fetcher: read, authorizeUrl: async () => {}, maxPages: 2 }),
    record: async entry => { withheldRecords.push(entry); return { settlement: "study-only-no-purchase" }; },
  }, { now: BASE });
  assert.equal(constrained.candidates.length, 0,
    "a remote source beyond budget is refused wholesale, not partially accepted");
  assert.deepEqual(constrained.denominator, [OUTBOX]);
  assert.match(constrained.refusals[0].reason, /bounded page budget/u);
  assert.equal(withheldRecords.length, 1);
  assert.equal(withheldRecords[0].record.receipt, undefined);
});

test("invalid late semantic claim cannot turn a refused seller into partially admitted market supply", async () => {
  const good = signedOffer(offer({ sku: ni("good-priced-offer") }));
  const bad = signedOffer(offer({
    sku: ni("later-incorrect-offer"),
    sourceRightsVerification: "verified",
  }));
  const records = [];
  const observer = {
    observe: input => listAddressedSenOutbox({ ...input, authorizeUrl: async () => {}, fetcher: async () => Response.json({
      type: "OrderedCollection", orderedItems: [good, bad],
    }) }),
    record: async entry => { records.push(entry); return { settlement: "not-a-commercial-receipt" }; },
  };
  const result = await discoverFederatedCapabilityOffers(request(), observer, { now: BASE });
  assert.deepEqual(result.candidates, [],
    "no earlier offer from a semantically rejected peer may survive as a candidate");
  assert.equal(result.refusals.length, 1);
  assert.match(result.refusals[0].reason, /source rights cannot acquire verified status/);
  assert.deepEqual(result.denominator, [OUTBOX]);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].record.candidates, []);
  assert.equal(records[0].record.receipt, undefined);
});

test("bounded all-operations discovery makes an unfamiliar seller's real SEN vocabulary discoverable", async () => {
  const observedOffers = Array.from({ length: 41 }, (_, index) =>
    signedOffer(offer({
      sku: ni("independent-discoverable-sku-" + index),
      operation: "unfamiliar-operation-" + index,
    })));
  const pages = [];
  for (let index = 0; index < observedOffers.length; index += 12) {
    const number = pages.length + 1;
    pages.push({
      id: OUTBOX + "?page=" + number, type: "OrderedCollectionPage",
      partOf: OUTBOX, orderedItems: observedOffers.slice(index, index + 12),
      ...(index + 12 < observedOffers.length ? { next: OUTBOX + "?page=" + (number + 1) } : {}),
    });
  }
  const responses = new Map([[OUTBOX, {
    id: OUTBOX, type: "OrderedCollection", totalItems: observedOffers.length, first: pages[0].id,
  }], ...pages.map(page => [page.id, page])]);
  const fetcher = async url => {
    const value = responses.get(url);
    return value ? Response.json(value) : new Response(null, {status: 404});
  };
  const records = [];
  const observer = {
    observe: input => listAddressedSenOutbox({ ...input, fetcher, authorizeUrl: async () => {} }),
    record: async entry => { records.push(entry); return { settlement: "research-only" }; },
  };
  const whole = await discoverFederatedCapabilityOffers(request({
    operation: "*", maximumCandidates: 8,
  }), observer, { now: BASE });
  assert.equal(whole.candidates.length, 41,
    "a wildcard operation is a full bounded market survey, not a silently truncated eight-offer hint");
  assert.deepEqual(new Set(whole.candidates.map(value => value.operation)),
    new Set(Array.from({ length: 41 }, (_, i) => "unfamiliar-operation-" + i)));
  assert.deepEqual(whole.refusals, []);
  assert.equal(whole.receipt.settlement, "research-only");
  assert.equal(records[0].record.receipt, undefined);
  assert.ok(whole.candidates.every(value => value.book?.account === "Income:TerritoryA" &&
    value.sourceRightsVerification === "unassayed" && value.price.amount === "70000"));
  const particular = await discoverFederatedCapabilityOffers(request({
    operation: "unfamiliar-operation-9",
  }), observer, { now: BASE });
  assert.equal(particular.candidates.length, 1);
  assert.equal(particular.candidates[0].operation, "unfamiliar-operation-9");
});
