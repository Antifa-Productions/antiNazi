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
          subsections: [],
        };
        chapters.push(currentChapter);
      }
      currentChapter.subsections.push({ type: 'paragraph', content: paraText });
    }
    currentParagraph = [];
  }

  function startChapter(heading) {
    flushParagraph();
    const id = slugify(heading) || `section-${chapters.length + 1}`;
    currentChapter = { heading, id, subsections: [] };
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
      const id = slugify(trimmed) || `subsection-${chapters.length}-${currentChapter ? currentChapter.subsections.length : 0}`;
      if (currentChapter) {
        currentChapter.subsections.push({ type: 'heading', id, content: trimmed });
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
    for (const sub of ch.subsections) {
      if (sub.type === 'paragraph') {
        allParagraphs.push(sub.content);
      }
    }
  }
  const { footnotes } = extractFootnotes(allParagraphs);

  for (const ch of chapters) {
    const processed = [];
    for (const sub of ch.subsections) {
      if (sub.type === 'paragraph') {
        const { paragraphs } = extractFootnotes([sub.content]);
        processed.push({ ...sub, content: paragraphs[0] || sub.content });
      } else {
        processed.push(sub);
      }
    }
    ch.subsections = processed;
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

  const outputDir = join(OUTPUT_DIR, book.fileName);
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  const siteUrl = process.env.SITE_URL || 'https://dev.antinazi.org';
  const outputFile = join(outputDir, 'index.html');
  const html = buildHtml(book, '/css/style.css', siteUrl);
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
