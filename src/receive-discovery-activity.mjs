import { extractSenActivity, projectSenActivity, senActivityObjectBytes } from "@red-cup-engineering/activitypub-services-section/sen-activity";
import { admitNormalizedSemanticContent } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation/runtime";
import { termToJson } from "@red-cup-engineering/computer-data-engineering-services-section/semiotic-expression-notation/json-codec";
import { discoverFederatedCapabilityOffers } from "../lib/discovery.mjs";
import { resolvedSender, resolvedInbox } from "./verified-discovery-arrival.mjs";

const REQUEST_KIND = "org.emsenn.capability-offer-discovery.request.v1";
const RESPONSE_KIND = "org.emsenn.capability-offer-discovery.result.v1";

/**
 * Handle one provider-verified ActivityPub++ CloudEvent/A2A/SEN request.
 * The original provider, not caller payload or an extra public GET, supplies
 * the principal and delivery inbox. Discovery's source observations and WIT
 * journal remain independent of payment, a work contract and buyer ACK.
 */
export async function receiveDiscoveryActivity(arrival, {
  origin, identifier, agentCard, loadRuntime, deliver,
  now = () => new Date().toISOString(),
} = {}) {
  const activity = arrival?.jsonLd;
  const actor = new URL(`/actors/${identifier}`, origin).href;
  const sender = resolvedSender(arrival);
  if (sender === actor) return Object.freeze({ ignored: "self-activity" });
  const inbox = resolvedInbox(arrival);
  for (const [operation, callback] of Object.entries({ loadRuntime, deliver })) {
    if (typeof callback !== "function") throw new TypeError(`discovery inlet requires ${operation}`);
  }
  // Fedify's compact JSON-LD may expand actor to an object; use only its
  // provider-resolved identity when interpreting the canonical SEN envelope.
  const projection = extractSenActivity({ ...activity, actor: sender }, {
    expectedActor: sender, expectedRecipient: actor,
  });
  if (projection.type !== "Offer" && projection.type !== "Create") {
    throw new TypeError("discovery request must be one addressed Offer or Create");
  }
  const semantic = admitNormalizedSemanticContent(projection.objectBytes, projection.objectNi);
  if (semantic.envelope.objectKind !== REQUEST_KIND) {
    throw new TypeError("the addressed ActivityPub++ object is not a discovery request");
  }
  const request = termToJson(semantic.envelope.settledBody);
  if (request?.kind !== REQUEST_KIND || request.observer !== sender) {
    throw new TypeError("the discovery request observer must be its signed sender actor");
  }
  const runtime = await loadRuntime();
  const result = await discoverFederatedCapabilityOffers(request, runtime.providers);
  const reply = projectSenActivity({
    type: "Accept", origin, identifier, recipient: sender, agentCard,
    objectBytes: senActivityObjectBytes({ objectKind: RESPONSE_KIND, value: result }),
    eventTime: now(),
  });
  await deliver({ activity: reply, recipient: sender, inbox });
  return Object.freeze({
    kind: "DiscoveryResultDispatched", recipient: sender,
    activity: reply.id, admittedOffers: result.candidates.length,
  });
}
