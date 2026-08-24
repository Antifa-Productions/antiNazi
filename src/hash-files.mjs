import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const PUBLIC_DIR = join(process.cwd(), 'public');
const OUTPUT_FILE = join(PUBLIC_DIR, 'precache-manifest.json');

const PATHS = [
  '',           // Root of public/ — captures *.png, *.svg, *.ico, etc.
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

// Files in the root directory that shouldn't be hashed or cached
const SKIP_ROOT_FILES = new Set([
  '_headers',
  'wrangler.toml',
  '.htaccess',
  'CNAME',
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
      const absPath = subPath === '' ? PUBLIC_DIR : join(PUBLIC_DIR, subPath);
      const label = subPath === '' ? '(root)' : subPath;
      console.log(`Scanning: ${label}/`);
      
      const files = await walkDir(absPath);

      for (const file of files) {
        const rel = relative(PUBLIC_DIR, file).split(sep).join('/');
        const basename = rel.split('/').pop();

        // Skip excluded root files
        if (subPath === '' && SKIP_ROOT_FILES.has(basename)) {
          continue;
        }

        const url = '/' + rel;
        const revision = await sha1File(file);
        manifest.push({ url, revision });
      }

      console.log(`  → Found ${files.length} file(s)`);
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
