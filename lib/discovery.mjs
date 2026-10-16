import { makeNiUri, isNiUri } from "@red-cup-engineering/uri-services-section/ni-uri";
import { admitNormalizedSemanticContent } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-expression-notation/runtime";
import { termToJson } from "@red-cup-engineering/computer-data-engineering-services-section/semiotic-expression-notation/json-codec";
import { identifyJsonSemanticContent, EMPTY_WITNESS_ROOT } from "@red-cup-engineering/computer-data-engineering-services-section/semiotic-expression-notation/semantic-content-identity";

const ACTOR = "urn:ame:federated-capability-offer-discovery-cell";
const KIND = "org.emsenn.capability-offer.v3";
// Native RFC 6920 canonical name admission lives in the URI service.
const COORDINATE_NAMES = Object.freeze(["signedAgentCard", "packageOperation", "deploymentHealth", "resourceMeter", "settlementReturn"]);

function fail(message) {
  throw new TypeError(message);
}

function exact(value, fields, label) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${label} must be a plain record`);
  }
  const keys = Object.keys(value);
  for (const field of fields) if (!Object.hasOwn(value, field)) fail(`${label} is missing ${field}`);
  for (const field of keys) if (!fields.includes(field)) fail(`${label} has unexpected ${field}`);
}

function text(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(`${label} must be nonempty text`);
  return value;
}

function absoluteUrl(value, label) {
  text(value, label);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${label} must be an absolute URL`);
  }
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    fail(`${label} must use HTTPS outside loopback development`);
  }
  return url.href;
}

function coordinateResidual(coordinate, state, reason) {
  return Object.freeze({
    kind: "org.emsenn.capability-offer.coordinate-residual.v1",
    coordinate,
    state,
    reason,
  });
}

function coordinateReference(value, coordinate, label) {
  const fields = ["kind", "href", ...(coordinate === "packageOperation" ? ["operation", "consumes", "emits", "invocation", "currentState"] : [])];
  exact(value, fields.filter((field) => Object.hasOwn(value, field) || field === "kind" || field === "href"), label);
  if (value.kind !== "reference") fail(`${label}.kind must be reference`);
  const reference = {kind: "reference", href: absoluteUrl(value.href, `${label}.href`)};
  if (coordinate === "packageOperation") {
    if (Object.hasOwn(value, "operation")) reference.operation = text(value.operation, `${label}.operation`);
    for (const field of ["consumes", "emits"]) {
      if (!Object.hasOwn(value, field)) continue;
      if (!Array.isArray(value[field]) || value[field].length === 0) fail(`${label}.${field} must name one or more declared media or semantic types`);
      reference[field] = Object.freeze(value[field].map((entry) => text(entry, `${label}.${field}[]`)));
    }
    for (const field of ["invocation", "currentState"]) {
      if (Object.hasOwn(value, field)) reference[field] = absoluteUrl(value[field], `${label}.${field}`);
    }
  }
  return Object.freeze(reference);
}

function coordinateValue(value, coordinate, label) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) fail(`${label} must be a coordinate reference or residual`);
  if (value.kind === "reference") return coordinateReference(value, coordinate, label);
  exact(value, ["kind", "coordinate", "state", "reason"], label);
  if (value.kind !== "org.emsenn.capability-offer.coordinate-residual.v1" || value.coordinate !== coordinate
      || !["unknown", "missing", "unreachable"].includes(value.state)) {
    fail(`${label} is not a residual for ${coordinate}`);
  }
  text(value.reason, `${label}.reason`);
  return coordinateResidual(coordinate, value.state, value.reason);
}

function normalizeCoordinates(value) {
  if (value === undefined) {
    return Object.freeze(Object.fromEntries(COORDINATE_NAMES.map((coordinate) => [
      coordinate,
      coordinateResidual(coordinate, "missing", "the published v3 offer did not supply this coordinate"),
    ])));
  }
  exact(value, COORDINATE_NAMES, "offer.coordinates");
  return Object.freeze(Object.fromEntries(COORDINATE_NAMES.map((coordinate) => [
    coordinate,
    coordinateValue(value[coordinate], coordinate, `offer.coordinates.${coordinate}`),
  ])));
}

/** Consume the SAME ActivityPub++ SEN bytes manufactured by x402's
 * capability-outbox. An RMN "ascribe" is not an alternate wire encoding.
 * The ActivityPub client has already checked actor, card, CloudEvent,
 * embedded A2A part and canonical byte digest; repeat the object check here
 * so a different injected observer cannot bypass its semantic type. */
function decodeOffer(bytes, expectedNi) {
  const raw = Buffer.from(bytes ?? []);
  const identity = makeNiUri(raw);
  if (identity !== expectedNi) fail("offer SEN bytes do not match their source identity");
  const semantic = admitNormalizedSemanticContent(raw, expectedNi);
  if (semantic.envelope.objectKind !== KIND) fail("wrong capability offer kind");
  const value = termToJson(semantic.envelope.settledBody);
  exact(value, ["kind", "cell", "sku", "provider", "operation", "law", "agentCard", "authorization", "price", "expiresAt",
    ...(Object.hasOwn(value, "coordinates") ? ["coordinates"] : []),
    ...(Object.hasOwn(value, "seller") ? ["seller"] : []),
    ...(Object.hasOwn(value, "book") ? ["book"] : []),
    ...(Object.hasOwn(value, "sourceRightsClaim") ? ["sourceRightsClaim"] : []),
    ...(Object.hasOwn(value, "sourceRightsVerification") ? ["sourceRightsVerification"] : [])], "offer");
  if (value.kind !== KIND) fail("wrong capability offer kind");
  for (const field of ["provider", "operation", "agentCard", "expiresAt"]) text(value[field], `offer.${field}`);
  if (!isNiUri(value.cell)) fail("offer.cell must be a canonical SEN cell identity");
  if (!isNiUri(value.sku)) fail("offer.sku must be a canonical SEN product identity");
  if (!isNiUri(value.law)) fail("offer.law must be a canonical SEN law identity");
  exact(value.authorization, ["profile", "grantRequired"], "offer.authorization");
  if (!["x402", "OCapN", "none"].includes(value.authorization.profile)
      || typeof value.authorization.grantRequired !== "boolean"
      || (value.authorization.profile === "x402" && value.authorization.grantRequired !== false)) {
    fail("offer authorization profile is unsupported");
  }
  exact(value.price, ["protocol", "asset", "amount", "network",
    ...(Object.hasOwn(value.price ?? {}, "basis") ? ["basis"] : []),
    ...(Object.hasOwn(value.price ?? {}, "pricing") ? ["pricing"] : [])], "offer.price");
  if (value.price.protocol !== "x402" || !/^(0|[1-9][0-9]*)$/u.test(value.price.amount)) fail("offer price must use x402 and a canonical atomic amount");
  for (const field of ["asset", "network"]) text(value.price[field], `offer.price.${field}`);
  if (!/^eip155:[1-9][0-9]*$/u.test(value.price.network)) fail("offer price must declare a CAIP-2 EIP-155 network");
  if (value.price.basis !== undefined && value.price.basis !== "maximum-authorized-tariff") fail("unsupported priced offer basis");
  if (value.price.pricing !== undefined && (value.price.pricing === null || typeof value.price.pricing !== "object" || Array.isArray(value.price.pricing))) {
    fail("offer pricing declaration must be an object");
  }
  if (value.seller !== undefined && value.seller !== null) {
    if (typeof value.seller !== "object" || Array.isArray(value.seller)
        || typeof value.seller.enterprise !== "string" || value.seller.enterprise.length === 0) {
      fail("offer seller must identify an actual enterprise");
    }
  }
  if (value.book !== undefined && value.book !== null && (typeof value.book !== "object" || Array.isArray(value.book))) {
    fail("offer book attribution must be an object");
  }
  if (value.sourceRightsVerification !== undefined && value.sourceRightsVerification !== "unassayed") {
    fail("unverified seller source rights cannot acquire verified status from an offer");
  }
  if (value.sourceRightsClaim !== undefined && (value.sourceRightsClaim === null
      || typeof value.sourceRightsClaim !== "object" || Array.isArray(value.sourceRightsClaim))) {
    fail("source rights claim must remain attributable declaration evidence");
  }
  if (!Number.isFinite(Date.parse(value.expiresAt))) fail("offer expiry must be an instant");
  return { offer: Object.freeze({ ...value, coordinates: normalizeCoordinates(value.coordinates) }), offerNi: identity };
}

export async function discoverFederatedCapabilityOffers(request, providers, options = {}) {
  // maximumCandidates is accepted only as a legacy hint.  It cannot truncate
  // the observed market; callers pay for the denominator they ask us to read.
  exact(request, ["kind", "requestId", "operation", "observer", "evaluatedAt",
    ...(Object.hasOwn(request ?? {}, "maximumCandidates") ? ["maximumCandidates"] : []), "endpoints"], "request");
  if (request.kind !== "org.emsenn.capability-offer-discovery.request.v1") fail("wrong discovery request kind");
  text(request.requestId, "requestId");
  text(request.operation, "operation");
  absoluteUrl(request.observer, "observer");
  const evaluatedAt = Date.parse(request.evaluatedAt);
  if (!Number.isFinite(evaluatedAt)) fail("evaluatedAt must be an exact instant");
  if (!Array.isArray(request.endpoints) || request.endpoints.length < 1) {
    fail("one explicit endpoint denominator is required");
  }
  if (!providers || typeof providers.observe !== "function" || typeof providers.record !== "function") {
    fail("contracted ActivityPub observation and WitnessJournal providers are required");
  }
  const endpoints = request.endpoints.map((endpoint) => {
    exact(endpoint, ["outbox", "actor", "agentCard"], "endpoint");
    return {
      outbox: absoluteUrl(endpoint.outbox, "endpoint.outbox"),
      actor: absoluteUrl(endpoint.actor, "endpoint.actor"),
      agentCard: absoluteUrl(endpoint.agentCard, "endpoint.agentCard"),
    };
  }).sort((left, right) => left.outbox.localeCompare(right.outbox));
  if (new Set(endpoints.map(({ outbox }) => outbox)).size !== endpoints.length) fail("endpoint denominator contains duplicate outboxes");
  const normalizedRequest = {...request, endpoints};
  const requestTerm = providers.identify
    ? await providers.identify(normalizedRequest)
    : {id: identifyJsonSemanticContent({
      objectKind: "org.emsenn.capability-offer-discovery.request.v1",
      value: normalizedRequest, witnessRoot: EMPTY_WITNESS_ROOT,
    }).id};
  if (!isNiUri(requestTerm?.id)) fail("identified discovery request must be one canonical SEN name");
  const candidates = [];
  const refusals = [];
  const residuals = [];
  for (const endpoint of endpoints) {
    // Hoare-style atomic source admission: an endpoint succeeds as a whole or
    // contributes only a refusal. A late invalid SEN offer must not leave
    // earlier candidate claims from the same source in the market result.
    const sourceCandidates = [];
    const sourceResiduals = [];
    try {
      const projections = await providers.observe({
        outboxUrl: endpoint.outbox,
        expectedActor: endpoint.actor,
        expectedAgentCard: endpoint.agentCard,
        recipient: request.observer,
      });
      for (const projection of projections) {
        const { offer, offerNi } = decodeOffer(projection.objectBytes, projection.objectNi);
        // An explicitly requested all-operations survey lets a new sovereign
        // market be discovered without guessing its operation vocabulary.
        // It observes only the caller-addressable public SEN denominator;
        // receipt, independent qualification, payment and ACK remain separate.
        if (request.operation !== "*" && offer.operation !== request.operation) continue;
        if (offer.agentCard !== endpoint.agentCard) fail("offer Agent Card differs from the published ActivityPub projection");
        if (offer.authorization.profile === "x402" && offer.provider !== endpoint.actor) {
          fail("seller-provided x402 offer actor differs from the signed ActivityPub actor");
        }
        if (Date.parse(offer.expiresAt) <= evaluatedAt) continue;
        sourceCandidates.push(Object.freeze({
          kind: KIND, offer: offerNi,
          cell: offer.cell,
          sku: offer.sku,
          activity: projection.activityId,
          publisher: endpoint.actor,
          provider: offer.provider,
          operation: offer.operation,
          law: offer.law,
          agentCard: offer.agentCard,
          authorization: offer.authorization,
          price: offer.price,
          seller: offer.seller ?? null,
          book: offer.book ?? null,
          sourceRightsClaim: offer.sourceRightsClaim ?? null,
          sourceRightsVerification: offer.sourceRightsVerification ?? "not-declared",
          expiresAt: offer.expiresAt,
          coordinates: offer.coordinates,
        }));
        for (const coordinate of COORDINATE_NAMES) {
          const observation = offer.coordinates[coordinate];
          if (observation.kind !== "reference") sourceResiduals.push(Object.freeze({
            ...observation,
            offer: offerNi,
            transition: "offer-coordinate-observation",
          }));
        }
      }
      candidates.push(...sourceCandidates);
      residuals.push(...sourceResiduals);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      refusals.push({outbox: endpoint.outbox, reason});
      residuals.push(Object.freeze({
        ...coordinateResidual("deploymentHealth", "unreachable", reason),
        transition: "outbox-observation",
        outbox: endpoint.outbox,
      }));
    }
  }
  candidates.sort((left, right) => left.offer.localeCompare(right.offer));
  const record = Object.freeze({
    kind: "org.emsenn.capability-offer-discovery.result.v1",
    provider: ACTOR,
    request: requestTerm.id,
    operation: request.operation,
    denominator: endpoints.map(({outbox}) => outbox),
    completeness: "supplied-denominator-only",
    candidates,
    refusals,
    residuals,
  });
  const receipt = await providers.record({
    category: "federated-capability-offer-discovery",
    recordedAt: options.now ?? new Date().toISOString(),
    record,
  });
  return Object.freeze({...record, receipt: receipt ?? coordinateResidual("settlementReturn", "missing", "WitnessJournal provider returned no record receipt")});
}
