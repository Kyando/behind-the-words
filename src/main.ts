import './fonts.ts';
import './styles/game.css';
import './styles/themes.css';
import './styles/theme-desk.css';
import { App } from './ui/app.ts';

// Palette preview: ?theme=gallery|starry|lilies|woodblock|terracotta|mix (see themes.css).
const theme = new URLSearchParams(location.search).get('theme') ?? 'lttl';
if (theme) {
  document.documentElement.dataset.theme = theme;
  // The hand-drawn wobble some palettes put on their outlines (filter: url(#wobble)).
  document.body.insertAdjacentHTML(
    'beforeend',
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="wobble"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="3.2"/></filter></svg>',
  );
}
// Surface effects on top of a palette: ?fx=grain,mount,pattern,backdrop,print (see themes.css).
const fx = new URLSearchParams(location.search).get('fx');
if (fx) document.documentElement.dataset.fx = fx.split(',').join(' ');

new App(document.getElementById('app')!);
