/**
 * The library's manual shelves. Three fixed collections, deliberately not
 * per-reader-type: a document filed under "Studying" has to stay filed if the
 * onboarding answer ever changes.
 *
 * Labels live in `home.json` under `library.collections.names`.
 */
import type { ComponentType } from "react";
import type { SvgProps } from "react-native-svg";

import {
  BookOpenIcon,
  ClockIcon,
  StarIcon,
} from "react-native-heroicons/outline";

import { colors } from "./colors";

export type CollectionId = "important" | "later" | "studying";

/** Either a plain emoji glyph or a heroicons component — render both via `CollectionGlyph`. */
export type CollectionIcon =
  | string
  | ComponentType<SvgProps & { size?: number }>;

/** Light/dark pair — resolve with `resolveCollectionColor` before handing to `CollectionGlyph`. */
export interface CollectionColor {
  light: string;
  dark: string;
}

export interface CollectionMeta {
  id: CollectionId;
  icon: CollectionIcon;
  /** Identity tint for the icon. Omit to fall back to the caller's default ink color. */
  color?: CollectionColor;
}

export const COLLECTION_META: CollectionMeta[] = [
  {
    id: "studying",
    icon: BookOpenIcon,
    color: { light: colors.light.accent, dark: colors.dark.accent },
  },
  {
    id: "later",
    icon: ClockIcon,
    color: { light: colors.light.accent, dark: colors.dark.accent },
  },
  {
    id: "important",
    icon: StarIcon,
    color: { light: colors.light.accent, dark: colors.dark.accent },
  },
];

/** Resolves a collection's identity color for the active theme, falling back when unset. */
export function resolveCollectionColor(
  color: CollectionColor | undefined,
  dark: boolean,
  fallback: string,
): string {
  if (!color) return fallback;
  return dark ? color.dark : color.light;
}

/** The shelf the list-view swipe files into. */
export const FAVORITE_COLLECTION: CollectionId = "important";
