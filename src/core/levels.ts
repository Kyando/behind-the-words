import type { LevelDef } from './types.ts';

/** Every level, in trail order (src/levels/NNN-<id>.json, written by npm run levels:generate). */
const files = import.meta.glob<LevelDef>('../levels/*.json', { eager: true, import: 'default' });
export const LEVELS: LevelDef[] = Object.keys(files).sort().map((k) => files[k]);

/** A room of the trail: a label, a colour and a line, with no art of its own. */
export interface Room {
  id: string;
  name: string;
  tagline: string;
  /** The room's colour and its darker edge (banner, next node). */
  color: string;
  edge: string;
  /** Stars needed to open the room. */
  gate: number;
  /** Paintings planned for it, shown as locked frames until their levels exist. */
  planned: number;
}

export const ROOMS: Room[] = [
  { id: 'icons', name: 'Icons', tagline: 'The paintings everyone knows', color: '#ffb020', edge: '#d98a00', gate: 0, planned: 10 },
  { id: 'light', name: 'Light and Leisure', tagline: 'The Impressionists paint a Sunday afternoon', color: '#1cb0f6', edge: '#1186c2', gate: 10, planned: 10 },
  { id: 'golden-age', name: 'The Golden Age', tagline: 'Amsterdam, 1650: candles, canals and milk', color: '#ff7a45', edge: '#d9541f', gate: 20, planned: 10 },
  { id: 'woodblocks', name: 'Waves and Woodblocks', tagline: 'Hokusai, Hiroshige and the floating world', color: '#2bc4a4', edge: '#159a80', gate: 36, planned: 10 },
];

/** The painting's image, served from public/art/. */
export const artUrl = (slug: string): string => `${import.meta.env.BASE_URL}art/${slug}.jpg`;
