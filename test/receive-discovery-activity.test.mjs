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
const MOMENT = "2026-10-16T18:00:00.000Z";
function request(overrides = {}) {
  return {
    kind: "org.emsenn.capability-offer-discovery.request.v1", requestId:"buyer-1",
    operation: "retrieve-territorial-quote", observer:BUYER, evaluatedAt:MOMENT,
    endpoints: [{ outbox:"https://supplier.example/actors/supplier/outbox",
      actor:"https://supplier.example/actors/supplier",
      agentCard:"https://supplier.example/.well-known/agent-card.json" }],
    ...overrides,
  };
}
function arrival(value = request()) {
  return { jsonLd: projectSenActivity({
    type:"Create",origin:"https://buyer.example",identifier:"buyer",
    recipient:ACTOR,agentCard:BUYER_CARD,
    objectBytes:senActivityObjectBytes({objectKind:value.kind,value}),
    eventTime:MOMENT,
  }) };
}
function handlers(overrides = {}) {
  let delivered;
  let observed = 0;
  const options = {
    origin:ORIGIN,identifier:IDENTIFIER,agentCard:CARD,now:()=>MOMENT,
    loadRuntime:async()=>({providers:{
      observe:async()=>{observed+=1;return [];},
      record:async()=>({id:"source-observation-only"}),
    }}),
    lookupInbox:async (sender)=>{assert.equal(sender,BUYER);return "https://buyer.example/actors/buyer/inbox";},
    deliver:async (input)=>{delivered=input;},
    ...overrides,
  };
  return { options, get delivered(){return delivered;}, get observed(){return observed;} };
}
test("a signed SEN discovery request completes the native A2A response through ActivityPub++",async()=>{
  const h=handlers(),r=await receiveDiscoveryActivity(arrival(),h.options);
  assert.equal(r.kind,"DiscoveryResultDispatched");
  assert.equal(r.recipient,BUYER);
  assert.equal(r.admittedOffers,0);
  assert.equal(h.observed,1);
  assert.equal(h.delivered.recipient,BUYER);
  const extracted=extractSenActivity(h.delivered.activity,{
    expectedActor:ACTOR,expectedRecipient:BUYER,expectedAgentCard:CARD,
  });
  assert.equal(extracted.type,"Accept");
  assert.equal(extracted.cloudEvent.source,ACTOR);
  assert.match(extracted.objectNi,/^ni:\/\/\/sha-256;/u);
});
test("cross-principal observer spoofing is refused before any work or transport",async()=>{
  const h=handlers();
  await assert.rejects(()=>receiveDiscoveryActivity(arrival(request({
    observer:"https://someone-else.example/actors/other",
  })),h.options),/signed sender actor/);
  assert.equal(h.observed,0);
  assert.equal(h.delivered,undefined);
});
test("an activity's wrong SEN operation kind cannot be interpreted as a market demand",async()=>{
  const h=handlers();
  const a=arrival({...request(),kind:"org.other.unrelated.v1"});
  await assert.rejects(()=>receiveDiscoveryActivity(a,h.options),/not a discovery request/);
  assert.equal(h.observed,0);
});
test("self-activity is not a fresh demand and never obtains a payment or acceptance",async()=>{
  const h=handlers();
  assert.deepEqual(await receiveDiscoveryActivity({jsonLd:{actor:ACTOR}},h.options),{ignored:"self-activity"});
  assert.equal(h.observed,0);
});
