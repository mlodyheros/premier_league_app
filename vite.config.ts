/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base so the same build works at a domain root (Vercel) and under a
// repository path (GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [preact()],
  test: { environment: 'node' },
});
