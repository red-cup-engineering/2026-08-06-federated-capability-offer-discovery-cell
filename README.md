# Federated Capability Offer Discovery — ActivityPub++ SEN

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
