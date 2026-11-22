import { describe, expect, it } from 'vitest';
import { initials, visibleFor } from '../src/client/lib/people.js';

describe('people helpers', () => {
  it('uses single initials unless two people share one', () => {
    const p = (name: string) => ({ name, color: '#000000' });
    expect([...initials([p('Jordan'), p('Cole')]).values()]).toEqual(['J', 'C']);
    expect([...initials([p('Cole'), p('Cam')]).values()]).toEqual(['Co', 'Ca']);
  });

  it('shows a person their items plus unassigned ones', () => {
    expect(visibleFor('Cole', ['Cole'])).toBe(true);
    expect(visibleFor('Cole', [])).toBe(true);
    expect(visibleFor('Cole', ['Jordan'])).toBe(false);
    expect(visibleFor(null, ['Jordan'])).toBe(true);
  });
});
