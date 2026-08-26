import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildHomepageHtml } from './template.mjs';

const PUBLIC_DIR = join(process.cwd(), 'public');
const siteUrl = process.env.SITE_URL || 'https://dev.antinazi.org';

(async () => {
    try {
        const html = buildHomepageHtml(siteUrl, '/css/style.css');
        const outputPath = join(PUBLIC_DIR, 'index.html');
        await writeFile(outputPath, html, 'utf-8');
        console.log(`✅ Homepage written: ${outputPath}`);
    } catch (err) {
        console.error('❌ Homepage build failed:', err);
        process.exit(1);
    }
})();
