/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

interface SharePage {
  path: string;
  pl: [string, string];
  en: [string, string];
}

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * A small page per game at g/<path>/, for share links: link previews read its
 * own title, description and image (public/og/<path>.png), then it forwards
 * to the game (#/<path>), keeping any query (?add=… for the friends league).
 * Hash routes alone cannot do this: crawlers never see the part after #.
 */
function sharePages(site: string): Plugin {
  const pages: SharePage[] = JSON.parse(readFileSync('pipeline/share-pages.json', 'utf8'));
  return {
    name: 'share-pages',
    apply: 'build',
    generateBundle() {
      for (const { path, pl, en } of pages) {
        const target = `../../#/${path}`;
        const title = `${pl[0]} · ${en[0]} · PL Games`;
        const html = `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <script>location.replace(${JSON.stringify(target)} + location.search);</script>
    <meta http-equiv="refresh" content="0; url=${target}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(pl[1])}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="PL Games" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(`${pl[1]} ${en[1]}`)}" />
    <meta property="og:url" content="${site}g/${path}/" />
    <meta property="og:image" content="${site}og/${path}.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${site}og/${path}.png" />
    <link rel="canonical" href="${site}#/${path}" />
    <style>body{background:#16081d;color:#f6eff8;font-family:system-ui,sans-serif;padding:24px}a{color:#04f5ff}</style>
  </head>
  <body>
    <a href="${target}">${esc(pl[0])} · PL Games</a>
  </body>
</html>
`;
        this.emitFile({ type: 'asset', fileName: `g/${path}/index.html`, source: html });
      }
    },
  };
}

/**
 * A Content-Security-Policy for the built page: only this site's own scripts
 * (plus the one inline theme script, allowed by its hash, and GoatCounter when
 * it is on), no plugins, no frames, no forms. If an injection bug ever slipped
 * in, a foreign script still would not run.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`,
        );
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${hashes.join(' ')} https://gc.zgo.at`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self' https://*.goatcounter.com",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'none'",
        ].join('; ');
        return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
      },
    },
  };
}

// Relative base so the same build works at a domain root (Vercel) and under a
// repository path (GitHub Pages).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: './',
    plugins: [preact(), sharePages(env.VITE_SITE_URL ?? ''), contentSecurityPolicy()],
    // Unit tests only; e2e/ is Playwright's.
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
