import { defineConfig } from 'astro/config';

// Static output — deployed to GitHub Pages via the workflow in .github/workflows/deploy.yml
export default defineConfig({
  site: 'https://justicethinker.github.io',
  base: '/',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      assetsInlineLimit: 2048,
    },
  },
});
