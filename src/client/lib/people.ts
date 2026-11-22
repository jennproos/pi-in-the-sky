import type { Person } from '../../shared/types';

/**
 * Short labels for assignee badges: first letter, or more letters when two people
 * share an initial ("Ca", "Co").
 */
export function initials(people: Person[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of people) {
    const others = people.filter((o) => o !== p).map((o) => o.name.toUpperCase());
    let n = 1;
    while (n < p.name.length && others.some((o) => o.startsWith(p.name.slice(0, n).toUpperCase()))) n++;
    const label = p.name.slice(0, n);
    out.set(p.name, label.charAt(0).toUpperCase() + label.slice(1).toLowerCase());
  }
  return out;
}

/** Items shown under a person's filter: theirs plus anything unassigned. */
export function visibleFor(person: string | null, assignees: string[]): boolean {
  return person === null || assignees.length === 0 || assignees.includes(person);
}
