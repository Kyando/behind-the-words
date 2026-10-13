/** The game's icons: chunky strokes, rounded ends, drawn in currentColor. */
const icon = (body: string, fill = 'none') =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="${fill}" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  close: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  lock: icon('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  star: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z"/></svg>`,
  palette: icon('<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.9-.8 1.9-1.8 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.3" fill="currentColor"/><circle cx="10.5" cy="7" r="1.3" fill="currentColor"/><circle cx="15" cy="7.5" r="1.3" fill="currentColor"/>'),
  sound: icon('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  mute: icon('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
};
