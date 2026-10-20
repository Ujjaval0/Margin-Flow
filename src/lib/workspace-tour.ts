const claims = new Map<string, Promise<boolean>>();
const seenKey = (ownerId: string) => `marginflow_workspace_tour_seen:${ownerId}`;

export function claimWorkspaceTour(ownerId: string): Promise<boolean> {
  try {
    if (localStorage.getItem(seenKey(ownerId)) === "true") return Promise.resolve(false);
  } catch { /* Account metadata remains authoritative when browser storage is unavailable. */ }
  const pending = claims.get(ownerId);
  if (pending) return pending;
  const claim = fetch("/api/auth/workspace-tour", { method: "POST", credentials: "same-origin" })
    .then(async response => response.ok && (await response.json()).showTour === true)
    .catch(() => false);
  claims.set(ownerId, claim);
  return claim;
}

export function markWorkspaceTourShown(ownerId: string) {
  claims.set(ownerId, Promise.resolve(false));
  try { localStorage.setItem(seenKey(ownerId), "true"); } catch { /* Saved on the account by the claim. */ }
}

export function positionTourCard(rect: { left: number; top: number; right: number; bottom: number }, width: number, height: number, cardHeight: number) {
  const cardWidth = Math.min(320, width - 24);
  const beside = width >= 768 && rect.right + 12 + cardWidth <= width - 12;
  const left = Math.max(12, Math.min(beside ? rect.right + 12 : rect.left, width - cardWidth - 12));
  const preferredTop = beside ? rect.top : rect.bottom + 12;
  const top = Math.max(12, Math.min(preferredTop, height - cardHeight - 12));
  return { left, top, width: cardWidth };
}
