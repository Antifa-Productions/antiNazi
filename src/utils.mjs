/**
 * Shared utilities for text-to-HTML conversion and hashing.
 */

export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function basename(filepath) {
  const parts = filepath.replace(/\\/g, '/').split('/');
  const last = parts[parts.length - 1];
  return last.replace(/\.[^.]+$/, '');
}

export function normaliseHeading(line) {
  return line
    .toUpperCase()
    .replace(/[IVXLCDM]+/g, '')
    .replace(/\d+/g, '')
    .replace(/[.:;\-—"\'!?,.()]/g, '')
    .trim();
}

export function isChapterHeading(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;

  const patterns = [
    /^CHAPTER\s+[IVXLCDM]+\b/i,
    /^CHAPTER\s+\d+\b/i,
    /^CHAPTER\s+(?:THE\s+)?(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH)/i,
    /^PART\s+[IVXLCDM]+\b/i,
    /^PART\s+\d+\b/i,
    /^PART\s+(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\b/i,
    /^ACT\s+[IVXLCDM]+\b/i,
    /^ACT\s+\d+\b/i,
  ];

  return patterns.some(re => re.test(trimmed));
}

export function isCapsHeading(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 100 || trimmed.length < 3) return false;
  const letters = trimmed.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 3) return false;
  const upper = trimmed.replace(/[^A-Z]/g, '');
  return upper.length / letters.length > 0.6;
}
