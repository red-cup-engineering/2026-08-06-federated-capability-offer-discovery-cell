# Federated Capability Offer Discovery — ActivityPub++ SEN

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

One Engineering-owned bounded reader of **external capability Offers**, composed
with the common 561 Group ActivityPub++ and x402 carriers. This is an existing
Capability Cell, not a second market, agency registry, signer, token or customer
ledger.

## Executable source chain

1. A sovereign seller declares one exact priced operation in its original x402
   offer catalogue. The shared `@red-cup-engineering/x402-services-section`
   `./capability-outbox` producer compiles that source as
   `org.emsenn.capability-offer.v3` using the native SEN
   `application/sen+cbor` serialization.
2. Its ActivityPub Service actor exposes a public OrderedCollection, e.g.
   `https://market.561.group/actors/market/outbox`. The published Offer
   contains **ActivityPub → CloudEvents → A2A → canonical SEN**;
   the offer is only a seller-authored claim, not a payment or sale.
3. The existing `@red-cup-engineering/activitypub-services-section/sen-outbox-client`
   reads an **explicit endpoint denominator**, rejects unsigned-format or
   source-address mismatches and unpacks the semantic bytes. Public and
   correctly addressed peer activities are distinct from private ones.
4. `discoverFederatedCapabilityOffers` admits current offer kind and source
   identity; retains seller, beneficiary/book attribution, current x402
   network/asset/atomic amount, source-rights **unassayed** status and residual
   coordinates. It never invents capacity, buyer demand, source permissions
   or provider acceptance. The provider's independent WitnessJournal keeps
   the discovery result and coverage/refusals; it is not the buyer's receipt.
5. The cell's current server accepts a signed and addressed discovery
   request under its own Actor, then publishes its answer as a native SEN
   ActivityPub `Accept`. An answer is an offered research result, **not**
   an accepted purchase, work fulfillment, account movement or revenue.
6. Downstream Operations' existing capability-market evaluation can now
   consume the returned current `kind`, `price`, `coordinates`,
   `provider`, `seller` and `book` fields, joined to independently
   obtained provider records, work-specific requirements, **current x402
   challenges** and separately authorized payee/capital policies.
   FeltOS/MetroPlat should only act on lawfully admitted actual Work.
   No second marketplace or book is created here.

## Run

```sh
npm run check
npm test
```

The package exports `.` (bounded discovery), `./outbox` (its own publisher)
and `./receive-activity` (its signed-inbox handler). The existing A2A
operation boundary remains a local adapter for already commissioned callers;
there is **one public federation face**, ActivityPub++. For a running server,
the original authorized configuration must provide the actor identity,
keypair custody, the settlement-network context, and separately provisioned
durable R2 message storage.

The `test/discovery.test.mjs` exercises a source-like x402 paid seller
projection through the **real SEN producer and addressed ActivityPub outbox
reader**, including current seller/finance attribution and source tampering.
The `test/receive-discovery-activity.test.mjs` exercises request admission,
agent response projection and refusal before an external provider action.
These are source tests; running federation, external customer choice, paid
settlement and received outputs require **additional installed
source-and-consumer evidence**.

## WIT, ACK, ATT and Rendanheyi

- **WIT**: a named source's observable offer and the evidence of its reading,
  with explicit omissions, disputes and coverage. A claimed commercial
  capability is not self-authenticating.
- **ATT**: a consumer's actual attention/work allocation under its own
  budget/mandate, not the number of source offers fetched.
- **ACK**: legitimate independent buyer, work receiver or settlement
  acceptance. A public Offer, a discovery result or the transport-level
  ActivityPub `Accept` does **not** generate ACK automatically.

The seller remains its own responsible enterprise. The site and the
discovery cell have no power to pool other sovereign settlements' ledgers,
redirect payment recipients, select a winner without consumer authority, or
claim that contextual circulation value is already booked net revenue.

## Bounded peer attention (ActivityPub Services 0.8.5)

The source-owned SEN outbox reader now enforces a finite page, activity, per-response
byte and total-byte budget on each externally supplied market denominator. It
rejects cross-origin or repeated page/activity identities and incomplete outboxes.
Exceeded bounds yield a **source-level refusal** with no accepted partial
candidate list; the existing discovery record retains the exact refused
outbox. The local 131-offer SEN producer → paginated reader → discovery
consumer regression represents the complete useful traversal. This is no
new registry, no funding authority and no ACK for an external buyer.

### Discover an unfamiliar market without knowing operation names

A contracted discovery request may name `operation: "*"` to discover **all**
public or caller-addressed SEN Offers within the explicitly supplied outbox
denominator. The normal, exact operation filter remains the default when an
actual buyer already knows its requested operation. Wildcard discovery still
uses the same finite ActivityPub source budget, atomic per-peer admission and
current unexpired typed Offer checks; it does not invent capacity, terms,
customer ACK, or a purchase. The current producer/consumer regression covers
41 different operations over multiple ActivityPub pages, as well as a single
exact-operation selection. Batches of market surveys remain the source-owning
consumer's decision, not a central compulsory catalog.

## ActivityPub provider identity and inbox custody

The production `serve-federated-capability-offer-discovery-activitypub` inlet
now consumes the *same provider-resolved sender and inbox* received from Red
Cup's shared ActivityPub server. The claimed compact JSON-LD actor and the
provider's resolved `arrival.activity.actorId` must equal
`arrival.sender.actorId` before the discovery runtime or WitnessJournal can
be opened. The seller's inbox is taken directly from that resolved sender;
the old redundant actor-document network GET was removed. This cuts a
remote round trip per accepted request and denies forged recipient and inbox
substitution without inventing a second identity registry.

The Agent Card version is projected from the actual package manifest; the
new factory code must not contain an independent literal product version.
A federated `Accept` is a transport response; it is still not the buyer's
commercial ACK, a paid x402 receipt, or transfer of sovereign treasury.

## Peer-address network admission

The shared ActivityPub 0.8.6 outbox reader now calls the original Red Cup HTTP
public-address policy **before every network fetch**, including each paginated
peer source. This rejects localhost, private IP literals, special-use addresses
and DNS resolving to a private or special-use address; same-origin page limits,
no redirects and exact SEN admission are still required. Networkless fixtures
supply an explicit replacement authorizer only in tests. A remote request
cannot send a JavaScript policy function, relax the host's rule, or turn a
refused peer into observed supply.
