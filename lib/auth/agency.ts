import "server-only";

import { notFound } from "next/navigation";

import { offers, type Agency, type AgencyService } from "@/lib/domain/admin";
import { agencies } from "@/lib/mock/admin";

import { AGENCY_ROLES } from "./claims";
import { requireConsole } from "./require";

/**
 * The signed-in agency, and the tenant boundary around it.
 *
 * Everything an agency console renders is filtered by the id in its session —
 * never by an id in the URL or a query parameter. That is the whole isolation
 * story: an agency cannot ask for another agency's workers because there is
 * nowhere to put the request.
 *
 * `requireService` refuses a section the agency is not contracted for. A labour
 * contractor with no transport contract has no fleet, and showing them an empty
 * fleet page would read as "you have no vehicles" rather than "this is not
 * yours to see".
 */
/** What each agency role is signed in to do. */
export const SERVICE_FOR_ROLE: Record<"transport" | "manpower", AgencyService> = {
  transport: "transport",
  manpower: "manpower",
};

export interface AgencySession {
  readonly agency: Agency;
  readonly email?: string;
  /** Which of the two agency roles this session holds. */
  readonly service: AgencyService;
}

export async function requireAgency(): Promise<AgencySession> {
  const session = await requireConsole([...AGENCY_ROLES]);

  const agency = agencies(new Date()).find(
    (a) => a.id === session.claims.accountId,
  );

  // A claim pointing at no agency. Treated as not found rather than as an
  // empty console, because the console would otherwise look like a working
  // account that simply has nothing in it.
  if (!agency) notFound();

  const service = SERVICE_FOR_ROLE[session.claims.role as "transport" | "manpower"];

  // The role says what they signed in as; the agency record says what the firm
  // is contracted for. A transport login at a manpower-only firm is a claim
  // that no longer matches the contract, and it is not this console's job to
  // paper over that.
  if (!offers(agency, service)) notFound();

  return { agency, email: session.email, service };
}

/**
 * A section belonging to one agency role.
 *
 * Refuses when the signed-in role is not the one this section is for — a
 * manpower login has no fleet, and an empty fleet page would read as "you have
 * no vehicles" rather than "this is not yours to see".
 */
export async function requireService(
  service: AgencyService,
): Promise<AgencySession> {
  const session = await requireAgency();
  if (session.service !== service) notFound();
  return session;
}
