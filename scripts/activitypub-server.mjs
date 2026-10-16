#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { serveActivityPubProvider } from "@red-cup-engineering/activitypub-server";
import { deliverActivity } from "@red-cup-engineering/activitypub-services-section/deliver";
import { createDiscoveryOfferOutbox } from "../src/activitypub-offer.mjs";
import { createActivityPubR2Custody } from "../src/activitypub-r2-custody.mjs";
import { receiveDiscoveryActivity } from "../src/receive-discovery-activity.mjs";
import { loadDiscoveryRuntime } from "../src/runtime.mjs";

/** The existing Red Cup ActivityPub server owns signatures, delivery,
 * network queue and actor transport. This business cell owns only the
 * bounded discovery operation and its already-authored outbox. */
const origin = process.env.ACTIVITYPUB_ORIGIN ?? "https://bare-cedar-fog.561.group";
const identifier = process.env.ACTIVITYPUB_IDENTIFIER ?? "capability-offer-discovery";
const network = process.env.SETTLEMENT_CAIP2;
if (!network) throw new Error("SETTLEMENT_CAIP2 is required at the deployment boundary");
const custody = createActivityPubR2Custody({ actor: identifier });
const agentCard = process.env.A2A_AGENT_CARD_URL ?? new URL("/.well-known/agent-card.json", origin).href;
let installed;
async function lookupInbox(sender) {
  const url = new URL(sender);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new TypeError("ActivityPub sender actor must be reached over HTTPS outside loopback");
  }
  const response = await fetch(url, {
    redirect: "error", headers: { accept: "application/activity+json" },
    signal: AbortSignal.timeout(8500),
  });
  if (!response.ok) throw new Error("sender actor discovery failed");
  const document = await response.json();
  if (document.id !== sender) throw new TypeError("sender discovery must return the same ActivityPub actor");
  const inbox = typeof document.inbox === "string" ? document.inbox : document.inbox?.id;
  if (typeof inbox !== "string" || !inbox) throw new TypeError("sender actor exposes no ActivityPub inbox");
  const parsed = new URL(inbox);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new TypeError("sender inbox must use HTTPS outside loopback");
  }
  return parsed.href;
}
installed = await serveActivityPubProvider({
  origin, identifier,
  actorName: "Federated Capability Offer Discovery Cell",
  summary: "Finds current public SEN capability Offers in explicitly named peer ActivityPub outboxes.",
  keyPath: process.env.ACTIVITYPUB_KEYS_PATH,
  bearerToken: process.env.ACTIVITYPUB_INBOX_BEARER_TOKEN ?? randomBytes(32).toString("base64url"),
  kv: custody.kv, inbox: custody.inbox, queue: custody.queue,
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? "15614"),
  onActivity: (arrival) => receiveDiscoveryActivity(arrival, {
    origin, identifier, agentCard,
    loadRuntime: loadDiscoveryRuntime,
    lookupInbox,
    deliver: (input) => deliverActivity(installed.provider, input),
  }),
  listOutbox: createDiscoveryOfferOutbox({ origin, identifier, network }),
});
process.stdout.write(`${origin}/actors/${identifier}\n`);
process.on("uncaughtException", (error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
