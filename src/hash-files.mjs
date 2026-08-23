import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const PUBLIC_DIR = join(process.cwd(), 'public');
const OUTPUT_FILE = join(PUBLIC_DIR, 'precache-manifest.json');

const PATHS = [
  'Archive',
  'css',
  'js',
  'lib',
  'literature',
  'images',
];

const SKIP_EXTENSIONS = new Set([
  '.md', '.gitkeep', '.DS_Store', '.map',
]);

async function walkDir(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walkDir(fullPath));
    } else if (entry.isFile()) {
      const ext = '.' + entry.name.split('.').pop().toLowerCase();
      if (!SKIP_EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

async function sha1File(filePath) {
  const data = await readFile(filePath);
  return createHash('sha1').update(data).digest('hex');
}

(async () => {
  try {
    const manifest = [];

    for (const subPath of PATHS) {
      const absPath = join(PUBLIC_DIR, subPath);
      console.log(`Scanning: ${subPath}/`);
      const files = await walkDir(absPath);

      for (const file of files) {
        const rel = relative(PUBLIC_DIR, file).split(sep).join('/');
        const url = '/' + rel;
        const revision = await sha1File(file);
        manifest.push({ url, revision });
      }

      console.log(`  → Found ${files.length} file(s)`);
    }

    const rootFiles = ['index.html', 'manifest.webmanifest', 'sw.js', 'sw-register.js', '_headers'];
    for (const name of rootFiles) {
      const filePath = join(PUBLIC_DIR, name);
      try {
        const revision = await sha1File(filePath);
        manifest.push({ url: '/' + name, revision });
      } catch {}
    }

    manifest.sort((a, b) => a.url.localeCompare(b.url));

    const json = JSON.stringify(manifest, null, 2);
    await writeFile(OUTPUT_FILE, json, 'utf-8');

    console.log(`\n✅ Precache manifest written: ${OUTPUT_FILE}`);
    console.log(`   ${manifest.length} entries total.`);
  } catch (err) {
    console.error('❌ Hashing failed:', err);
    process.exit(1);
  }
})();
