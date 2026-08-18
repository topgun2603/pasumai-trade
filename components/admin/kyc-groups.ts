import type { Role } from "@/lib/auth/claims";

/**
 * The three kinds of account, in the order operations meet them.
 *
 * Shared by the queue and the history so the two read alike. Operations do not
 * review a farmer and a transport agency the same way — a farmer clears two
 * checks and an agency five — and an undifferentiated list means holding that
 * difference in your head on every row.
 *
 * Transport and manpower are one section because they are one record: an agency
 * document carries no role, and the two are told apart only by the claim on the
 * person signing in.
 */
export const ACCOUNT_GROUPS: Array<{ key: string; title: string; roles: Role[] }> = [
  { key: "farmers", title: "Farmers", roles: ["farmer"] },
  { key: "buyers", title: "Buyers and franchises", roles: ["buyer", "franchise"] },
  { key: "agencies", title: "Transport and manpower", roles: ["transport", "manpower"] },
];
