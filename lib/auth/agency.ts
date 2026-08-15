import "server-only";

import { notFound } from "next/navigation";

import { offers, type Agency, type AgencyService } from "@/lib/domain/admin";
import { agencies } from "@/lib/mock/admin";

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
export interface AgencySession {
  readonly agency: Agency;
  readonly email?: string;
}

export async function requireAgency(): Promise<AgencySession> {
  const session = await requireConsole(["agency"]);

  const agency = agencies(new Date()).find(
    (a) => a.id === session.claims.accountId,
  );

  // A claim pointing at no agency. Treated as not found rather than as an
  // empty console, because the console would otherwise look like a working
  // account that simply has nothing in it.
  if (!agency) notFound();

  return { agency, email: session.email };
}

export async function requireService(
  service: AgencyService,
): Promise<AgencySession> {
  const session = await requireAgency();
  if (!offers(session.agency, service)) notFound();
  return session;
}
