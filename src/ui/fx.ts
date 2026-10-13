import { reducedMotion } from './dom.ts';

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

const CONFETTI = ['#ffc23d', '#58cc02', '#1cb0f6', '#ff7a45', '#ce82ff', '#ff4b6e'];

/** Paper confetti bursting from a point and fluttering down. */
export function confetti(x: number, y: number, amount = 46): void {
  if (reducedMotion()) return;
  for (let i = 0; i < amount; i++) {
    const s = document.createElement('i');
    s.className = 'confetti';
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.background = CONFETTI[i % CONFETTI.length];
    if (i % 3 === 0) s.style.borderRadius = '50%';
    document.body.append(s);
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const dist = 140 + Math.random() * 220;
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
