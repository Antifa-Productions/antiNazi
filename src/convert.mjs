import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { execSync } from 'node:child_process';
import { escapeHtml, slugify, isChapterHeading, isCapsHeading } from './utils.mjs';
import { buildHtml } from './template.mjs';

const TEXT_DIR = join(process.cwd(), 'public', 'text');
const OUTPUT_DIR = join(process.cwd(), 'public', 'literature');

function processInlineFormatting(raw) {
  let text = escapeHtml(raw);
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return text;
}

function extractFootnotes(paragraphs) {
  const footnotes = [];
  const footnotePattern = /^\[(\d+)\]\s*(.+)$/;

  const contentParagraphs = [];
  for (const p of paragraphs) {
    const match = p.match(footnotePattern);
    if (match) {
      footnotes.push({
        id: `fn-${match[1]}`,
        num: match[1],
        text: processInlineFormatting(match[2]),
      });
    } else {
      contentParagraphs.push(p);
    }
  }

  const processedParagraphs = contentParagraphs.map(p => {
    return processInlineFormatting(
      p.replace(/\[(\d+)\]/g, (_, num) => {
        return `<sup><a href="#fn-${num}" id="ref-${num}" aria-label="Footnote ${num}">[${num}]</a></sup>`;
      })
    );
  });

  return { paragraphs: processedParagraphs, footnotes };
}

async function parseTextFile(filePath) {
  const raw = await readFile(filePath, 'utf-8');
  const lines = raw.replace(/\r\n/g, '\n').split('\n');

  const metadata = {};
  let contentStart = 0;

  const startMarkerIdx = lines.findIndex(l => /\*\*\*\s*START OF/i.test(l));

  if (startMarkerIdx !== -1) {
    for (let i = 0; i < startMarkerIdx; i++) {
      const m = lines[i].match(/^(Title|Author|Release Date|Language|Posting Date|Produced by):\s*(.+)$/i);
      if (m) {
        const key = m[1].toLowerCase().replace(/\s+/g, '_');
        metadata[key] = m[2].trim();
      }
    }
    contentStart = startMarkerIdx + 1;
  }

  const allLines = lines.slice(contentStart);
  const endMarkerIdx = allLines.findIndex(l => /\*\*\*\s*END OF/i.test(l));
  const contentLines = endMarkerIdx !== -1
    ? allLines.slice(0, endMarkerIdx)
    : allLines;

  const title = metadata.title || slugify(basename(filePath)).replace(/-/g, ' ');
  const author = metadata.author || 'Unknown';
  const language = metadata.language || 'en';

  let datePublished = '';
  if (metadata.release_date) {
    const yearMatch = metadata.release_date.match(/\d{4}/);
    if (yearMatch) datePublished = yearMatch[0];
  }

  const chapters = [];
  let currentChapter = null;
  let currentParagraph = [];

  function flushParagraph() {
    if (currentParagraph.length === 0) return;
    const paraText = currentParagraph.join(' ').trim();
    if (paraText) {
      if (!currentChapter) {
        currentChapter = {
          heading: 'Introduction',
          id: 'introduction',
          paragraphs: [],
        };
        chapters.push(currentChapter);
      }
      currentChapter.paragraphs.push(paraText);
    }
    currentParagraph = [];
  }

  function startChapter(heading) {
    flushParagraph();
    const id = slugify(heading) || `section-${chapters.length + 1}`;
    currentChapter = { heading, id, paragraphs: [] };
    chapters.push(currentChapter);
  }

  for (const line of contentLines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (isChapterHeading(trimmed)) {
      startChapter(trimmed);
      continue;
    }

    if (isCapsHeading(trimmed) && currentParagraph.length === 0) {
      flushParagraph();
      const id = slugify(trimmed) || `subsection-${chapters.length}-${currentChapter ? currentChapter.paragraphs.length : 0}`;
      if (currentChapter) {
        currentChapter.paragraphs.push(`<h3 id="${id}">${escapeHtml(trimmed)}</h3>`);
      } else {
        startChapter(trimmed);
      }
      continue;
    }

    currentParagraph.push(trimmed);
  }
  flushParagraph();

  const allParagraphs = [];
  for (const ch of chapters) {
    allParagraphs.push(...ch.paragraphs);
  }
  const { footnotes } = extractFootnotes(allParagraphs);

  for (const ch of chapters) {
    const { paragraphs } = extractFootnotes(ch.paragraphs);
    ch.paragraphs = paragraphs;
  }

  const seenFn = new Set();
  const dedupedFootnotes = footnotes.filter(fn => {
    if (seenFn.has(fn.num)) return false;
    seenFn.add(fn.num);
    return true;
  }).sort((a, b) => Number(a.num) - Number(b.num));

  return {
    title,
    author,
    language,
    datePublished,
    description: `${title} by ${author}. Public domain literature.`,
    fileName: slugify(title),
    chapters,
    footnotes: dedupedFootnotes,
  };
}

async function convertFile(inputPath) {
  console.log(`Converting: ${inputPath}`);
  const book = await parseTextFile(inputPath);

  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  const outputFile = join(OUTPUT_DIR, `${book.fileName}.html`);
  const html = buildHtml(book);
  await writeFile(outputFile, html, 'utf-8');
  console.log(`  → Written: ${outputFile}`);
}

async function getFilesToConvert() {
  const args = process.argv.slice(2);

  if (args.length > 0 && !args[0].startsWith('--')) {
    return [join(process.cwd(), args[0])];
  }

  if (args.includes('--all')) {
    const files = await readdir(TEXT_DIR);
    return files
      .filter(f => extname(f) === '.txt')
      .map(f => join(TEXT_DIR, f));
  }

  try {
    const diff = execSync(
      'git diff --name-only --diff-filter=A HEAD~1 HEAD -- "public/text/*.txt"',
      { encoding: 'utf-8', cwd: process.cwd() }
    ).trim();
    if (diff) {
      return diff.split('\n').map(f => join(process.cwd(), f));
    }
  } catch {
    try {
      const diff = execSync(
        'git diff --name-only HEAD -- "public/text/*.txt"',
        { encoding: 'utf-8', cwd: process.cwd() }
      ).trim();
      if (diff) {
        return diff.split('\n').map(f => join(process.cwd(), f));
      }
    } catch {}
  }

  if (!existsSync(TEXT_DIR)) return [];
  const files = await readdir(TEXT_DIR);
  return files
    .filter(f => extname(f) === '.txt')
    .map(f => join(TEXT_DIR, f));
}

(async () => {
  try {
    const files = await getFilesToConvert();

    if (files.length === 0) {
      console.log('No text files to convert.');
      process.exit(0);
    }

    for (const file of files) {
      await convertFile(file);
    }

    console.log(`✅ Converted ${files.length} file(s).`);
  } catch (err) {
    console.error('❌ Conversion failed:', err);
    process.exit(1);
  }
})();