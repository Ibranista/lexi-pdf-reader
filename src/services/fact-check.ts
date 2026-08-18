/**
 * Reading the page for claims that don't hold up.
 *
 * A mark on someone's book carries the authority of a check, so the bar for
 * putting one there is high and the server does most of the enforcing: it
 * refuses fiction outright, requires the model to quote the page verbatim, and
 * throws away anything it wasn't confident about. What arrives here is only
 * what survived all of that — and an empty list is the normal answer.
 *
 * The claims are anchored the same way saved highlights are: by searching the
 * rendered page for the quoted text. That is why the quote has to be verbatim,
 * and why a claim that can't be found is simply not drawn rather than being
 * attached to whatever was nearest.
 */
import { asQuotaError, type AiQuota } from "@/services/lexi-ai";
import { api } from "@/utils/axios";

/** Why a passage was flagged. Each reads as a short label on the card. */
export type ClaimKind =
  | "inaccurate"
  | "outdated"
  | "disputed"
  | "miscited"
  | "unsupported";

export interface FlaggedClaim {
  /** Verbatim from the page — this is what gets marked. */
  quote: string;
  kind: ClaimKind;
  /** What is actually the case, in a sentence or two. */
  note: string;
  confidence: number;
}

export interface PageCheck {
  claims: FlaggedClaim[];
  /** False when nothing was read: fiction, too short, or the check failed. */
  checked: boolean;
  reason?: "FICTION" | "TOO_SHORT" | "FAILED";
  quota?: AiQuota;
}

/** How each kind is named on the card. Plain words, not jargon. */
export const CLAIM_LABEL: Record<ClaimKind, string> = {
  disputed: "Still debated",
  inaccurate: "Looks wrong",
  miscited: "Cited wrongly",
  outdated: "Out of date",
  unsupported: "Nothing behind it",
};

const EMPTY: PageCheck = { checked: false, claims: [] };

/**
 * Check one page. Never throws except on the quota wall — a failed check is a
 * page with no marks on it, which is indistinguishable from a clean page and
 * is not worth interrupting someone's reading over.
 */
export async function checkPage(input: {
  docKey: string;
  page: number;
  text: string;
  title?: string;
  author?: string;
}): Promise<PageCheck> {
  try {
    const { data } = await api.post<PageCheck>("/ai/page-check", {
      author: input.author,
      docKey: input.docKey,
      page: input.page,
      text: input.text,
      title: input.title,
    });
    return data;
  } catch (error) {
    const quota = asQuotaError(error);
    if (quota) throw quota;
    return EMPTY;
  }
}
