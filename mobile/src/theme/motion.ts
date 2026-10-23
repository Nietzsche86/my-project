/**
 * Design Tokens: Motion
 * Standard durations for consistent platform transitions and feedback
 */
export const motion = {
  fast: 150, // touch feedback, toggle
  base: 250, // list item enters, modals
  slow: 400, // full screen transitions, sheets
} as const;

export type Motion = typeof motion;
