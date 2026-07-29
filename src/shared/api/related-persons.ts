import type { RelatedPerson } from "@/shared/types/domain";
import { ApiClientError, parseApiResponse } from "./http-client";

export { ApiClientError };

/** Selector de persona/entidad para deudas y prestamos (`26` §4.3). */
export async function listRelatedPersons(): Promise<RelatedPerson[]> {
  const response = await fetch("/api/v1/related-persons", { credentials: "same-origin" });
  const data = await parseApiResponse<{ related_people: RelatedPerson[] }>(response);
  return data.related_people;
}

export async function createRelatedPerson(displayName: string): Promise<RelatedPerson> {
  const response = await fetch("/api/v1/related-persons", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName, kind: "person" }),
  });
  const data = await parseApiResponse<{ related_person: RelatedPerson }>(response);
  return data.related_person;
}
