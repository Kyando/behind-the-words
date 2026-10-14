/** A word laid on the grid. `path` lists cell indices (row * cols + col) from the first letter to the last. */
export interface WordDef {
  text: string;
  path: number[];
  /** Where the thing it names is in the painting, as board cells [top row, left col, bottom row,
   *  right col]: the word is laid over it, so finding it uncovers that thing. */
  at?: Area;
}

/** A block of board cells: [top row, left col, bottom row, right col], inclusive. */
export type Area = [number, number, number, number];

/** The painting behind a level, and what the player reads once it is restored. */
export interface ArtDef {
  /** Key into art/pieces.json (and the image's file name under public/art/). */
  slug: string;
  title: string;
  artist: string;
  year: string;
  /** Where the work hangs today. */
  holder: string;
  /** Image licence / source line, for the credits. */
  credit: string;
  /** The level's short story about the work: our own text, shown once it is restored. */
  story: string;
  /** Part of the image to use, as [left, top, right, bottom] fractions (default: all of it). */
  crop?: [number, number, number, number];
}

export interface LevelDef {
  id: string;
  /** Key into ROOMS. */
  room: string;
  rows: number;
  cols: number;
  /** One string per row, for readability; must match the word paths. '.' is an empty cell. */
  grid: string[];
  words: WordDef[];
  art: ArtDef;
}
