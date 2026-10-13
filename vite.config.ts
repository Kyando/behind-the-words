import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works from any folder (an app's WebView, GitHub Pages).
  base: './',
  // index.html at the root is the game; the old review page for art lives at art/contact-sheet.html.
  test: { include: ['tests/**/*.test.ts'] },
});
