import { asQuotaError, type AiQuota } from "@/services/lexi-ai";
import { api } from "@/utils/axios";

export type ClaimKind =
  | "inaccurate"
  | "outdated"
  | "disputed"
  | "miscited"
  | "unsupported";

export interface FlaggedClaim {
  quote: string;
  kind: ClaimKind;
  note: string;
  confidence: number;
}

export interface PageCheck {
  claims: FlaggedClaim[];
  checked: boolean;
  reason?: "FICTION" | "TOO_SHORT" | "FAILED";
  quota?: AiQuota;
}

export const CLAIM_LABEL: Record<ClaimKind, string> = {
  disputed: "Still debated",
  inaccurate: "Looks wrong",
  miscited: "Cited wrongly",
  outdated: "Out of date",
  unsupported: "Nothing behind it",
};

const EMPTY: PageCheck = { checked: false, claims: [] };

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
