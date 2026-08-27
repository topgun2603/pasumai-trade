/**
 * Comparing a name against the one a bank holds.
 *
 * A penny drop proves an account exists and takes money. It does not prove the
 * account belongs to the person who typed it in — that comes from comparing the
 * `registered_name` the bank returns against the name on the account record,
 * and that comparison is the whole verification. Get it wrong in one direction
 * and money goes to a stranger; get it wrong in the other and a farmer with a
 * perfectly good account is refused.
 *
 * It cannot be an equality test. Banks hold "MURUGAN R", "R MURUGAN" and
 * "MURUGAN RAMASAMY" for the same person, print titles into the name field, and
 * store initials with and without stops. Tamil, Telugu and Malayalam names
 * transliterate inconsistently and frequently put the father's name first as an
 * initial — which is exactly the case a naive comparison fails.
 *
 * So there are three answers, not two. `exact` and `mismatch` can be acted on
 * automatically. `close` deliberately cannot: it is handed to a person, because
 * the difference between a reordered name and a different member of the same
 * family is not something this function can see.
 */

export type NameMatch =
  /** The same name, allowing for order, case, punctuation and titles. */
  | "exact"
  /**
   * Consistent, but not the same string — an initial expanded, a name part
   * present on one side only. A person decides.
   */
  | "close"
  /** No reading of these two makes them the same person. */
  | "mismatch";

/**
 * Honorifics and company suffixes, which banks put in the name field and which
 * carry no identifying information.
 *
 * `M/S` is here because a proprietorship's account is routinely registered as
 * "M/S KONGU AGRI TRADERS" while the platform holds "Kongu Agri Traders", and
 * refusing that pair would fail most of the buying side.
 */
const NOISE = new Set([
  "MR",
  "MRS",
  "MS",
  "MISS",
  "SHRI",
  "SRI",
  "SMT",
  "THIRU",
  "DR",
  "MESSRS",
  "THE",
]);

/**
 * `M/S`, before the punctuation pass can get at it.
 *
 * Stripping non-letters first would split it into "M" and "S", two tokens that
 * then look like initials and match almost anything under the single-letter
 * rule. It has to go while the slash is still there to recognise it by.
 */
const MS_PREFIX = /\bM\s*\/\s*S\b/g;

/**
 * Down to bare uppercase words.
 *
 * Everything that is not a letter or a digit becomes a space — that covers
 * stops after initials, hyphens in double-barrelled names, and the commas banks
 * leave behind when a name is stored surname-first.
 */
function tokens(value: string): string[] {
  return value
    .toUpperCase()
    .replace(MS_PREFIX, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "" && !NOISE.has(word));
}

/**
 * Whether one token can stand for another.
 *
 * Equal words match. A single letter matches any word starting with it, which
 * is what makes "R MURUGAN" and "RAMASAMY MURUGAN" the same person. That rule
 * is only ever applied to a *single* letter, so "RAM" never matches "RAMASAMY"
 * — a prefix rule would collapse genuinely different names.
 */
function tokensAgree(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 1) return b.startsWith(a);
  if (b.length === 1) return a.startsWith(b);
  return false;
}

/**
 * Greedy, and greedy is enough.
 *
 * Each token of the shorter name is matched against the first unclaimed token
 * of the longer one that agrees with it. An optimal assignment would be the
 * Hungarian algorithm over a handful of words; the cases where greedy differs
 * are names where the same initial appears twice, and there the answer is
 * `close` either way — a person is already looking.
 */
function matchAll(shorter: string[], longer: string[]): boolean {
  const claimed = new Array<boolean>(longer.length).fill(false);

  return shorter.every((token) => {
    const found = longer.findIndex(
      (candidate, i) => !claimed[i] && tokensAgree(token, candidate),
    );
    if (found === -1) return false;
    claimed[found] = true;
    return true;
  });
}

/**
 * How well the name a bank returned agrees with the one on file.
 *
 * Order-insensitive on purpose. "MURUGAN R" and "R MURUGAN" are the same
 * account holder, and which order a bank stores is not something the platform
 * or the farmer controls.
 */
export function compareNames(
  claimed: string,
  registered: string,
): NameMatch {
  const a = tokens(claimed);
  const b = tokens(registered);

  // Nothing to compare is not a match. An empty registered name is what a bank
  // returns for an account it could not resolve, and reading that as agreement
  // would verify every failed lookup.
  if (a.length === 0 || b.length === 0) return "mismatch";

  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  if (
    sortedA.length === sortedB.length &&
    sortedA.every((word, i) => word === sortedB[i])
  ) {
    return "exact";
  }

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];

  /*
    A single token on one side is not enough to go on.

    "MURUGAN" against "MURUGAN RAMASAMY" matches under the rule below, but a
    given name alone is shared by a great many people in one district and the
    platform should not treat it as evidence. Two matching parts is the floor.
  */
  if (shorter.length < 2) return "mismatch";

  return matchAll(shorter, longer) ? "close" : "mismatch";
}

/**
 * Whether this result may verify an account without a person looking.
 *
 * Only `exact`. `close` is a question, and the point of returning three answers
 * rather than a boolean is that the middle one reaches an operator instead of
 * being rounded to whichever of the other two was convenient.
 */
export function matchClearsAutomatically(match: NameMatch): boolean {
  return match === "exact";
}
