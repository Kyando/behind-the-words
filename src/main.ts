import './fonts.ts';
import './styles/game.css';
import './styles/themes.css';
import './styles/theme-desk.css';
import './styles/trail.css';
import './styles/wide.css';
import { App } from './ui/app.ts';
import { unit } from './ui/dom.ts';

// Palette preview: ?theme=gallery|starry|lilies|woodblock|terracotta|mix (see themes.css).
const theme = new URLSearchParams(location.search).get('theme') ?? 'lttl';
if (theme) {
  document.documentElement.dataset.theme = theme;
  // The hand-drawn wobble some palettes put on their outlines (filter: url(#wobble)).
  document.body.insertAdjacentHTML(
    'beforeend',
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="wobble"><feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="1" seed="7"/><feDisplacementMap in="SourceGraphic" scale="3.4"/></filter></svg>',
  );
  // Line boil: the wobble is redrawn a few times a second, so the outlines look hand-drawn frame by
  // frame and nothing on screen is ever quite still. Softly: three drawings, a slow cycle.
  const noise = document.querySelector('#wobble feTurbulence');
  if (noise && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const seeds = [7, 23, 41];
    let i = 0;
    setInterval(() => {
      if (document.hidden) return;
      i = (i + 1) % seeds.length;
      noise.setAttribute('seed', String(seeds[i]));
    }, 240);
  }
  // The wobble keeps its proportions as the layout scales up. On a low-density screen (most
  // desktops) a bent 3px line breaks into 1px steps and notches, so there the lines stay straight
  // and the boil is a tiny shift of each outline instead (data-boil=shift, see theme-desk.css).
  const map = document.querySelector('#wobble feDisplacementMap');
  const fit = () => {
    const u = unit();
    noise?.setAttribute('baseFrequency', String(0.016 / u));
    map?.setAttribute('scale', String(3.4 * u));
    document.documentElement.dataset.boil = devicePixelRatio < 1.5 ? 'shift' : 'warp';
  };
  fit();
  addEventListener('resize', fit);
}
// Surface effects on top of a palette: ?fx=grain,mount,pattern,backdrop,print (see themes.css).
const fx = new URLSearchParams(location.search).get('fx');
if (fx) document.documentElement.dataset.fx = fx.split(',').join(' ');

new App(document.getElementById('app')!);
