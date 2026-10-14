import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fit } from '../src/core/generate.ts';
import { validateLevel } from '../src/core/puzzle.ts';
import type { LevelDef } from '../src/core/types.ts';

const dir = join(import.meta.dirname, '..', 'src', 'levels');
const levels: LevelDef[] = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

describe('levels', () => {
  it('exist', () => expect(levels.length).toBeGreaterThan(0));
  for (const level of levels) {
    it(`${level.id} is a valid board`, () => expect(validateLevel(level)).toEqual([]));
    it(`${level.id}: every word lies over the thing it names`, () => {
      for (const w of level.words) expect({ word: w.text, over: !!w.at && fit(w.path, level.cols, w.at) > 0 }).toEqual({ word: w.text, over: true });
    });
    it(`${level.id} has its painting in public/art`, () => expect(existsSync(join(dir, '..', '..', 'public', 'art', `${level.art.slug}.jpg`))).toBe(true));
  }
});
