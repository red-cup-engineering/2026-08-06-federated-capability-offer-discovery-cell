#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { serveActivityPubProvider } from "@red-cup-engineering/activitypub-server";
import { deliverActivity } from "@red-cup-engineering/activitypub-services-section/deliver";
import { createDiscoveryOfferOutbox } from "../src/activitypub-offer.mjs";
import { createActivityPubR2Custody } from "../src/activitypub-r2-custody.mjs";
import { receiveDiscoveryActivity } from "../src/receive-discovery-activity.mjs";
import { loadDiscoveryRuntime } from "../src/runtime.mjs";
import packageMetadata from "../package.json" with { type: "json" };

/** The existing Red Cup ActivityPub server owns signatures, delivery,
 * network queue and actor transport. This business cell owns only the
 * bounded discovery operation and its already-authored outbox. */
const origin = process.env.ACTIVITYPUB_ORIGIN ?? "https://bare-cedar-fog.561.group";
const identifier = process.env.ACTIVITYPUB_IDENTIFIER ?? "capability-offer-discovery";
const network = process.env.SETTLEMENT_CAIP2;
if (!network) throw new Error("SETTLEMENT_CAIP2 is required at the deployment boundary");
const custody = createActivityPubR2Custody({ actor: identifier });
const agentCard = new URL("/.well-known/agent-card.json", origin).href;
const actor = new URL(`/actors/${identifier}`, origin).href;
const advertisedCard = Object.freeze({
  protocolVersion: "0.3.0",
  name: "Federated Capability Offer Discovery",
  description: "ActivityPub++ SEN discovery of independently attributed x402 seller offers from named peer outboxes.",
  url: actor, preferredTransport: "ActivityPub++", version: packageMetadata.version,
  capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
  defaultInputModes: ["application/sen+cbor"],
  defaultOutputModes: ["application/sen+cbor"],
  skills: [{
    id: "discover-federated-capability-offers",
    name: "Find capability offers",
    description: "Discover specified or all (*) operations from bounded peer ActivityPub++ SEN outboxes; source-qualified offers are not payment or fulfillment.",
    tags: ["federation", "x402", "capabilities"],
  }],
});
let installed;
installed = await serveActivityPubProvider({
  origin, identifier,
  actorName: "Federated Capability Offer Discovery Cell",
  summary: "Finds current public SEN capability Offers in explicitly named peer ActivityPub outboxes.",
  keyPath: process.env.ACTIVITYPUB_KEYS_PATH,
  bearerToken: process.env.ACTIVITYPUB_INBOX_BEARER_TOKEN ?? randomBytes(32).toString("base64url"),
  kv: custody.kv, inbox: custody.inbox, queue: custody.queue,
  wellKnownResources: { "/.well-known/agent-card.json": advertisedCard },
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? "15614"),
  onActivity: (arrival) => receiveDiscoveryActivity(arrival, {
    origin, identifier, agentCard,
    loadRuntime: loadDiscoveryRuntime,
    // The shared provider supplies the verified sender and its resolved inbox.
    // The cell must not perform a second actor fetch or choose a new recipient.
    deliver: (input) => deliverActivity(installed.provider, input),
  }),
  listOutbox: createDiscoveryOfferOutbox({ origin, identifier, network }),
});
process.stdout.write(`${origin}/actors/${identifier}\n`);
process.on("uncaughtException", (error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
