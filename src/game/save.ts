/**
 * Local persistence (per browser). Only restored paintings are kept: a level is either new or done.
 * Words found in an unfinished level live in memory while it's open.
 */

/** A level being played: the words found so far, by text. */
export interface LevelProgress {
  found: string[];
  done: boolean;
  /** Traces that weren't a word. */
  misses: number;
}

export interface SaveData {
  version: 1;
  /** Restored paintings, by level id. */
  levels: Record<string, { done: true }>;
  settings: { sound: boolean };
}

const KEY = 'behind-the-words:v1';

const defaults = (): SaveData => ({ version: 1, levels: {}, settings: { sound: true } });

export const emptyProgress = (): LevelProgress => ({ found: [], done: false, misses: 0 });

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== 1) return defaults();
    const levels: SaveData['levels'] = {};
    for (const [id, p] of Object.entries(data.levels ?? {})) if (p?.done) levels[id] = { done: true };
    return { version: 1, levels, settings: { ...defaults().settings, ...data.settings } };
  } catch {
    return defaults();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode, quota): the game still works for this session.
  }
}
