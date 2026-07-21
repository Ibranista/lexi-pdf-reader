/**
 * The library's manual shelves. Three fixed collections, deliberately not
 * per-reader-type: a document filed under "Studying" has to stay filed if the
 * onboarding answer ever changes.
 *
 * Labels live in `home.json` under `library.collections.names`.
 */
export type CollectionId = "important" | "later" | "studying";

export interface CollectionMeta {
  id: CollectionId;
  emoji: string;
}

export const COLLECTION_META: CollectionMeta[] = [
  { id: "studying", emoji: "📚" },
  { id: "later", emoji: "📖" },
  { id: "important", emoji: "⭐" },
];

/** The shelf the list-view swipe files into. */
export const FAVORITE_COLLECTION: CollectionId = "important";
