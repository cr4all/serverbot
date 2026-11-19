/** Deterministic desk card media variant from deskId. */

const MEDIA_VARIANTS = 5;

export function deskMediaVariant(deskId: string): number {
  const id = String(deskId ?? '');
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % MEDIA_VARIANTS;
}

export function deskHeroSrc(deskId: string): string {
  const n = deskMediaVariant(deskId) + 1;
  return `/landing/landing0${n}.png`;
}

export function deskMediaClass(deskId: string): string {
  return `sb-bot-card__media--v${deskMediaVariant(deskId)}`;
}
