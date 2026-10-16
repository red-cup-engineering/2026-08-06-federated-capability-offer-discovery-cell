/**
 * Bind one Fedify-resolved ActivityPub sender to the original compact
 * JSON-LD actor and its delivery inbox. This is a pure, service-specific
 * admission predicate; it never creates a principal or resolves an actor
 * by another network request.
 */
/** Admit exactly the actor/inbox that the original ActivityPub provider resolved
 * with the verified arrival. Raw JSON-LD actor text is an untrusted claim, not
 * delegated authority, and cannot choose who receives the market result. */
export function resolvedSender(arrival) {
  const actor = arrival?.sender?.actorId;
  const signedActor = arrival?.activity?.actorId?.href;
  const stated = typeof arrival?.jsonLd?.actor === "string"
    ? arrival.jsonLd.actor : arrival?.jsonLd?.actor?.id;
  if (typeof actor !== "string" || !actor || signedActor !== actor || stated !== actor) {
    throw new TypeError("discovery request requires one provider-resolved signed sender matching the ActivityPub actor");
  }
  return actor;
}

/** Use the inbox the original provider already obtained for that sender;
 * doing a second ad hoc fetch lets an activity redefine its destination. */
export function resolvedInbox(arrival) {
  const raw = arrival?.sender?.inboxId;
  let url;
  try { url = new URL(raw); }
  catch { throw new TypeError("verified discovery sender has no resolved ActivityPub inbox"); }
  const localHttp = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) ||
      url.username || url.password || url.hash) {
    throw new TypeError("resolved ActivityPub inbox must be HTTPS outside loopback without credentials or fragments");
  }
  return url.href;
}

