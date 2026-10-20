import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The worker file was identical on every deploy, so the browser fetched it, compared the bytes,
 * found no change and never installed a new one. controllerchange never fired, the reload in
 * main.tsx never ran, and a phone kept serving an old build until someone navigated to it by
 * hand. Stamp the build into it so there is something for the browser to notice.
 *
 * The stamp is the content hashes of what was emitted, not a timestamp, so redeploying the same
 * code does not shove a pointless reload at anyone mid-round.
 */
function versionServiceWorker(): Plugin {
  let stamp = 'dev';
  return {
    name: 'version-service-worker',
    generateBundle(_options, bundle) {
      stamp = createHash('sha256').update(Object.keys(bundle).sort().join('|')).digest('hex').slice(0, 12);
    },
    closeBundle() {
      const file = resolve(process.cwd(), 'dist/sw.js');
      const text = readFileSync(file, 'utf8');
      if (!text.includes('__BUILD__')) throw new Error('sw.js lost its __BUILD__ placeholder.');
      writeFileSync(file, text.replace('__BUILD__', stamp));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), versionServiceWorker()],
  server: { port: 5183 },
});
