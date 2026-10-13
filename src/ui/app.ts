import { LEVELS } from '../core/levels.ts';
import { buildPuzzle } from '../core/puzzle.ts';
import type { LevelDef } from '../core/types.ts';
import { emptyProgress, loadSave, writeSave, type SaveData } from '../game/save.ts';
import { Session } from '../game/session.ts';
import { reducedMotion } from './dom.ts';
import { LevelView } from './level-view.ts';
import { Sfx } from './sfx.ts';
import { StoryScreen } from './story.ts';
import { Trail } from './trail.ts';

type Screen = { el: HTMLElement; shown?(): void; destroy?(): void };

/** Screens and the save: trail → level → story → trail. */
export class App {
  private readonly root: HTMLElement;
  private readonly save: SaveData = loadSave();
  private readonly sfx = new Sfx(this.save.settings.sound);
  private screen: Screen | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.showTrail();
  }

  private get stars(): number {
    return LEVELS.filter((l) => this.save.levels[l.id]).length;
  }

  private show(next: Screen): void {
    const swap = () => {
      this.screen?.destroy?.();
      this.screen?.el.remove();
      this.screen = next;
      this.root.append(next.el);
      next.shown?.();
    };
    const first = !this.screen;
    if (!first && document.startViewTransition && !reducedMotion()) {
      document.startViewTransition(swap);
      return;
    }
    swap();
    if (!first || !reducedMotion()) next.el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
  }

  private showTrail(justDone?: string): void {
    this.show(
      new Trail({
        isDone: (id) => !!this.save.levels[id],
        stars: this.stars,
        sound: this.sfx.enabled,
        justDone,
        onPlay: (level) => this.play(level),
        onToggleSound: () => {
          this.sfx.enabled = !this.sfx.enabled;
          this.save.settings.sound = this.sfx.enabled;
          writeSave(this.save);
          return this.sfx.enabled;
        },
      }),
    );
  }

  private play(level: LevelDef): void {
    // A restored painting is played again from scratch; only finished levels are saved.
    const progress = emptyProgress();
    const session = new Session(buildPuzzle(level), progress, () => {
      if (progress.done && !this.save.levels[level.id]) {
        this.save.levels[level.id] = { done: true };
        writeSave(this.save);
      }
    });
    this.show(
      new LevelView({
        session,
        sfx: this.sfx,
        intro: true,
        onClose: () => this.showTrail(),
        onContinue: () => this.show(new StoryScreen({ level, onContinue: () => this.showTrail(level.id) })),
      }),
    );
  }
}
