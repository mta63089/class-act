import type { ArticleStatus, QuoteStatus } from "./schema";

/** Pure validation rule to be used by the future authenticated publishing service. */
export function getPublicationBlockers(
  article: {
    status: ArticleStatus;
    currentVersion: number;
    approvedVersion: number | null;
    reviewedById: string | null;
  },
  quoteStatuses: readonly QuoteStatus[],
): string[] {
  const errors: string[] = [];
  if (article.status !== "approved" && article.status !== "scheduled") {
    errors.push("The article has not been approved for publication.");
  }
  if (
    !article.reviewedById ||
    article.approvedVersion !== article.currentVersion
  ) {
    errors.push("The current article revision needs explicit editor approval.");
  }
  if (quoteStatuses.some((status) => status !== "verified")) {
    errors.push(
      "All included direct quotes must be verified against their sources.",
    );
  }
  return errors;
}

/** Updating an approved draft invalidates approval until it is reviewed again. */
export function statusAfterEdit(): ArticleStatus {
  return "in_review";
}
