import {resolve} from "node:path";
import {listAddressedSenOutbox} from "@red-cup-engineering/activitypub-services-section/sen-outbox-client";
import {identifyJsonSemanticContent, EMPTY_WITNESS_ROOT} from "@red-cup-engineering/computer-data-engineering-services-section/semiotic-expression-notation/semantic-content-identity";
import {createSettlementStore} from "@red-cup-engineering/witness-journal-rdf-projection-service/client";

function identifyDiscoveryRequest(value) {
  if (value?.kind !== "org.emsenn.capability-offer-discovery.request.v1") {
    throw new TypeError("only one identified federated discovery request can be admitted");
  }
  return { id: identifyJsonSemanticContent({
    objectKind: value.kind, value, witnessRoot: EMPTY_WITNESS_ROOT,
  }).id };
}

export function createCapabilityOfferDiscoveryRuntime({root}) {
  const store = createSettlementStore({
    settlementRoot: root,
    agentUrl: process.env.WITNESS_JOURNAL_RDF_AGENT ?? "http://127.0.0.1:19764/.well-known/agent-card.json",
    caip2: process.env.SETTLEMENT_CAIP2 ?? "eip155:5615611",
  });
  return Object.freeze({
    providers: Object.freeze({
      identify: async (value) => identifyDiscoveryRequest(value),
      observe: (input) => listAddressedSenOutbox(input),
      record: (input) => store.record(input),
    }),
  });
}
