import { CategoryMeta } from '@/types/phrase';
import { ApiCategory } from '@/services/api';

/**
 * Category presentation is derived, never enumerated.
 *
 * Categories are created and renamed in the admin dashboard, so the app cannot
 * ship a lookup table of slugs. Colors are assigned by position in the server's
 * sorted category list so every category gets a distinct palette entry, and the
 * icon falls back to a slug-derived pick when the dashboard leaves it blank.
 */

const PALETTE = [
  '#d9653b',
  '#477a5b',
  '#4d557e',
  '#b6853e',
  '#41768a',
  '#a8585d',
  '#b84b3a',
];

const ICONS = ['book-open', 'message-circle', 'compass', 'users', 'sun', 'map-pin', 'briefcase', 'heart'];

/** FNV-1a with a final avalanche mix — stable per slug, no dependencies. */
function hashSlug(slug: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export function colorAt(index: number): string {
  return PALETTE[Math.abs(index) % PALETTE.length];
}

export function iconForSlug(slug: string): string {
  return ICONS[hashSlug(slug) % ICONS.length];
}

export function colorForSlug(slug: string): string {
  return colorAt(hashSlug(slug));
}

/**
 * Builds card metadata for one category.
 *
 * @param index Position in the server-provided list. Colors are assigned by
 *   index rather than hashed from the slug because similar slugs ("greetings"
 *   and "classroom") hash to the same palette slot, which made neighbouring
 *   cards indistinguishable. Index keeps every card visually distinct.
 */
export function categoryMetaFromServer(cat: ApiCategory, index: number): CategoryMeta {
  const color = colorAt(index);
  // Honor a slug that names a known icon ("map-pin"), else pick by hash.
  const iconHint = cat.slug.replace(/-/g, ' ').trim();
  const iconFromSlug = ICONS.find((candidate) => candidate.replace(/-/g, ' ') === iconHint);
  return {
    name: cat.name,
    description: cat.description ?? '',
    icon: cat.icon || iconFromSlug || iconForSlug(cat.slug),
    color,
  };
}