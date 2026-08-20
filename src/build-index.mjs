import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const LITERATURE_DIR = join(process.cwd(), 'public', 'literature');
const OUTPUT_FILE = join(LITERATURE_DIR, 'index.json');

async function walkDirs(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const indexPath = join(dir, entry.name, 'index.html');
      if (existsSync(indexPath)) {
        results.push({ dirName: entry.name, indexPath });
      }
    }
  }

  return results;
}

function extractMetadata(html) {
  const titleMatch = html.match(/<title>(.+?)\s*—\s*(.+?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
  const author = titleMatch ? titleMatch[2].trim() : 'Unknown';

  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const description = descMatch ? descMatch[1].trim() : '';

  const dateMatch = html.match(/<time\s+datetime="([^"]+)"/i);
  const datePublished = dateMatch ? dateMatch[1].trim() : '';

  return { title, author, description, datePublished };
}

(async () => {
  try {
    if (!existsSync(LITERATURE_DIR)) {
      console.log('No literature directory found. Skipping index generation.');
      process.exit(0);
    }

    const dirs = await walkDirs(LITERATURE_DIR);
    const books = [];

    for (const { dirName, indexPath } of dirs) {
      const html = await readFile(indexPath, 'utf-8');
      const meta = extractMetadata(html);
      books.push({
        title: meta.title,
        author: meta.author,
        description: meta.description,
        datePublished: meta.datePublished,
        url: `/literature/${dirName}/`,
      });
    }

    books.sort((a, b) => a.title.localeCompare(b.title));

    await writeFile(OUTPUT_FILE, JSON.stringify(books, null, 2), 'utf-8');
    console.log(`✅ Built literature index: ${books.length} book(s) → ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('❌ Index generation failed:', err);
    process.exit(1);
  }
})();
