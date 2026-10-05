/**
 * Category names come from the server and are admin-managed, so this stays an
 * open string rather than a closed union. Seeding a new category in the
 * dashboard must not require a client release.
 */
export type PhraseCategory = string;

export interface Phrase {
  id: string;
  category: PhraseCategory;
  english: string;
  hausa: string;
  pronunciation: string;
  audioUrl: string | null;
  isFavorite: boolean;
  /**
   * Which server collection this row came from. Words and phrases are shown in
   * one flat list, but contributions must reference the correct collection or
   * the server rejects the contentId.
   */
  contentType: ContentType;
}

export type ContentType = 'word' | 'phrase';

export interface CategoryMeta {
  name: PhraseCategory;
  description: string;
  icon: string;
  /** Resolved hex color, assigned deterministically from the slug. */
  color: string;
}