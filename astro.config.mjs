import { defineConfig } from 'astro/config';

// Static output, deployed to GitHub Pages by .github/workflows/deploy.yml.
export default defineConfig({
  site: 'https://justicethinker.com',
  base: '/',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  // The old Tech page now lives at /work.
  redirects: { '/tech': '/work/' },
});
