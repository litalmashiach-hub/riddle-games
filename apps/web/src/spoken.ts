/**
 * What VoiceOver says for the parts of the screen whose look alone carries the meaning: a level card's badge,
 * the star total. Plain functions, so the unit tests can hold the words. See docs/voiceover.md.
 */

/** The star total as it is spoken: "5 of 90 stars". */
export const starTotal = (stars: number, most: number) => `${stars} of ${most} ${most === 1 ? 'star' : 'stars'}`;

/**
 * A level card's spoken name: its number and title, then what the card shows for it, so a player who
 * can't see the badge hears it: "Level 7: Three Jealous Couples, 2 of 3 stars", "…, not solved yet", "…, locked".
 */
export function levelCardName(entry: { number: number; title: string; load?: unknown }, stars: number, unlocked: boolean) {
  const state = !entry.load ? 'coming soon' : !unlocked ? 'locked' : stars > 0 ? `${stars} of 3 stars` : 'not solved yet';
  return `Level ${entry.number}: ${entry.title}, ${state}`;
}
