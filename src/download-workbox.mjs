/**
 * Downloads Workbox v7 production files from Google's CDN
 * and saves them to public/lib/workbox/ for self-hosting.
 *
 * Self-hosting avoids CDN dependencies, CORS issues, and
 * ES module loading problems on iOS Safari.
 *
 * Usage: node src/download-workbox.mjs
 */

import { writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';

const WORKBOX_VERSION = '7.0.0';
const CDN_BASE = `https://storage.googleapis.com/workbox-cdn/releases/${WORKBOX_VERSION}`;
const OUTPUT_DIR = join(process.cwd(), 'public', 'lib', 'workbox');

const FILES = [
  'workbox-sw.js',
  'workbox-core.prod.js',
  'workbox-routing.prod.js',
  'workbox-strategies.prod.js',
  'workbox-precaching.prod.js',
  'workbox-cacheable-response.prod.js',
  'workbox-expiration.prod.js',
];

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

(async () => {
  console.log(`Downloading Workbox v${WORKBOX_VERSION}...`);

  await mkdir(OUTPUT_DIR, { recursive: true });

  let success = 0;
  let failed = 0;

  for (const file of FILES) {
    const url = `${CDN_BASE}/${file}`;
    const outputPath = join(OUTPUT_DIR, file);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const content = await response.text();
      await writeFile(outputPath, content, 'utf-8');
      console.log(`  ✓ ${file} (${(content.length / 1024).toFixed(1)} KB)`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${file} — ${err.message}`);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\n❌ ${failed} file(s) failed. ${success} succeeded.`);
    console.error(`   Check that Workbox v${WORKBOX_VERSION} exists.`);
    console.error(`   Try a different version by editing WORKBOX_VERSION in this script.`);
    process.exit(1);
  }

  console.log(`\n✅ Downloaded ${success} Workbox files to ${OUTPUT_DIR}`);
})().catch(err => {
  console.error('❌ Download failed:', err);
  process.exit(1);
});
