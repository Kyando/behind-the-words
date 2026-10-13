import { artUrl } from '../core/levels.ts';
import type { LevelDef } from '../core/types.ts';
import { h } from './dom.ts';

export interface StoryOptions {
  level: LevelDef;
  onContinue(): void;
}

/**
 * After the restoration: the painting hangs in its gold frame, with its museum label, its story and
 * the words the player found. One button goes on.
 */
export class StoryScreen {
  readonly el: HTMLElement;

  constructor({ level, onContinue }: StoryOptions) {
    const art = level.art;
    // Found words that the story mentions show up in it, in the word chips' colour.
    const marked = new Set(level.words.map((w) => w.text));
    const story = h('p', { class: 'story-text' });
    for (const part of art.story.split(/(\b[\p{L}-]+\b)/u)) {
      const key = part.toUpperCase().replace(/S$/, '');
      if (marked.has(part.toUpperCase()) || marked.has(key) || marked.has(`${key}S`)) story.append(h('mark', {}, part));
      else story.append(part);
    }
    this.el = h(
      'main',
      { class: 'screen story' },
      h(
        'div',
        { class: 'story-scroll' },
        h('p', { class: 'story-ribbon' }, 'Restored'),
        h('figure', { class: 'frame' }, h('img', { src: artUrl(art.slug), alt: art.title })),
        h(
          'section',
          { class: 'museum-label' },
          h('h1', {}, art.title),
          h('p', { class: 'label-artist' }, `${art.artist}, ${art.year}`),
          h('p', { class: 'label-holder' }, art.holder),
          story,
          h('ul', { class: 'word-list is-found-list' }, ...[...level.words].sort((a, b) => a.text.localeCompare(b.text)).map((w) => h('li', { class: 'word-chip is-found' }, h('span', {}, w.text)))),
          h('p', { class: 'label-credit' }, art.credit),
        ),
      ),
      h('footer', { class: 'story-footer' }, h('button', { type: 'button', class: 'btn btn-green btn-block', onclick: onContinue }, 'Continue')),
    );
  }
}
