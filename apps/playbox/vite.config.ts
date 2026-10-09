import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@minds/inspector': fileURLToPath(new URL('../../packages/inspector/src/index.ts', import.meta.url)) } },
  server: { port: Number(process.env.PLAYBOX_WEB_PORT ?? 5183), strictPort: true, proxy: { '/api': `http://127.0.0.1:${process.env.PLAYBOX_API_PORT ?? 5184}` } },
});
