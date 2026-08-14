/**
 * Time formatting.
 *
 * Every function takes an explicit `now` rather than reading the clock. The
 * server renders these strings and the client re-renders them on hydration; if
 * the two read different clocks React reports a mismatch. Passing `now` down
 * from the server component keeps both renders identical.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** `42m ago`, `6h ago`, `2d ago`. */
export function relativeTime(then: Date, now: number): string {
  const elapsed = now - then.getTime();
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  return `${Math.floor(elapsed / DAY)}d ago`;
}

/**
 * `47m left`, `5h 20m left`, or `expired`.
 *
 * Offers carry a countdown and a farmer acts on it, so this stays coarse on
 * purpose — a ticking seconds display invites refreshing rather than deciding.
 */
export function countdown(until: Date, now: number): string {
  const left = until.getTime() - now;
  if (left <= 0) return "expired";
  if (left < HOUR) return `${Math.ceil(left / MINUTE)}m left`;
  const hours = Math.floor(left / HOUR);
  const minutes = Math.floor((left % HOUR) / MINUTE);
  return minutes > 0 ? `${hours}h ${minutes}m left` : `${hours}h left`;
}

/** `13 Aug`, for a mandi rate's as-of date. */
export function shortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(date);
}

/** `1,180.5` — Indian grouping, up to one decimal. Quantities are fractional. */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(value);
}
