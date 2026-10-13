import { reducedMotion, unit } from './dom.ts';

/** Restarts a CSS animation class. */
export function replay(el: Element, className: string): void {
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(className);
}

/** A short vibration where the device has one. */
export function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // No vibration.
  }
}

const DEFAULT_CONFETTI = ['#ffc23d', '#58cc02', '#1cb0f6', '#ff7a45', '#ce82ff', '#ff4b6e'];

/** The palette's confetti colours (--confetti, a comma list), or the default set. */
function confettiColours(): string[] {
  const own = getComputedStyle(document.documentElement).getPropertyValue('--confetti').trim();
  return own ? own.split(',').map((c) => c.trim()) : DEFAULT_CONFETTI;
}

/** Paper confetti bursting from a point and fluttering down. */
export function confetti(x: number, y: number, amount = 46): void {
  if (reducedMotion()) return;
  const CONFETTI = confettiColours();
  for (let i = 0; i < amount; i++) {
    const s = document.createElement('i');
    s.className = 'confetti';
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.background = CONFETTI[i % CONFETTI.length];
    if (i % 3 === 0) s.style.borderRadius = '50%';
    document.body.append(s);
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const dist = (140 + Math.random() * 220) * unit();
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const rot = (Math.random() - 0.5) * 900;
    s.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot * 0.5}deg) scale(1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx * 1.2}px), calc(-50% + ${dy + 420}px)) rotate(${rot}deg) scale(0.9)`, opacity: 0 },
      ],
      { duration: 1500 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.4,1)' },
    ).onfinish = () => s.remove();
  }
}

const STAR = 'M12 1.5c.9 5.4 2.8 8.4 10.5 10.5-7.7 2.1-9.6 5.1-10.5 10.5C11.1 17.1 9.2 14.1 1.5 12 9.2 9.9 11.1 6.9 12 1.5z';

/** A burst of little four-point stars around a point, twinkling out. */
export function sparkles(x: number, y: number, amount = 9, spread = 54): void {
  if (reducedMotion()) return;
  const u = unit();
  spread *= u;
  const colours = confettiColours();
  for (let i = 0; i < amount; i++) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'sparkle');
    const size = (12 + Math.random() * 12) * u;
    Object.assign(s.style, { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px` });
    s.innerHTML = `<path d="${STAR}" fill="${colours[i % colours.length]}" stroke-width="1.6" stroke-linejoin="round"/>`;
    document.body.append(s);
    const angle = (i / amount) * Math.PI * 2 + Math.random() * 0.6;
    const dist = spread * (0.55 + Math.random() * 0.6);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const spin = (Math.random() - 0.5) * 220;
    s.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.8}px), calc(-50% + ${dy * 0.8}px)) scale(1.1) rotate(${spin * 0.6}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 10}px)) scale(0) rotate(${spin}deg)`, opacity: 0.6 },
      ],
      { duration: 650 + Math.random() * 350, delay: Math.random() * 90, easing: 'cubic-bezier(.2,.8,.4,1)', fill: 'backwards' },
    ).onfinish = () => s.remove();
  }
}

/** The centre of an element on screen. */
export function centreOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
