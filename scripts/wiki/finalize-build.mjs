import {copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const outputDirectory = join(root, 'docs');
const metadata = JSON.parse(readFileSync(join(root, '.angular', 'wiki-pages.json'), 'utf8'));
const siteUrl = 'https://rchimisso.github.io/game-of-life-tribes';
const errorDocument = join(outputDirectory, '404', 'index.html');
const customErrorDocument = join(outputDirectory, '404.html');
const clientIndexDocument = join(outputDirectory, 'index.csr.html');
const rootIndexDocument = join(outputDirectory, 'index.html');

if (!existsSync(errorDocument)) {
  throw new Error('The prerendered Angular 404 document is missing.');
}
if (!existsSync(clientIndexDocument)) {
  throw new Error('The client-rendered Angular entry document is missing.');
}

copyFileSync(clientIndexDocument, rootIndexDocument);
copyFileSync(errorDocument, customErrorDocument);
let errorHtml = readFileSync(customErrorDocument, 'utf8');
if (!/<meta[^>]+name=["']robots["']/i.test(errorHtml)) {
  errorHtml = errorHtml.replace('</head>', '<meta name="robots" content="noindex">\n</head>');
}
writeFileSync(customErrorDocument, errorHtml, 'utf8');

const wikiUrls = metadata.slugs.map(slug => `${siteUrl}/wiki/${slug === 'home' ? '' : `${slug}/`}`);
const urls = [`${siteUrl}/`, ...wikiUrls];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`;
writeFileSync(join(outputDirectory, 'sitemap.xml'), sitemap, 'utf8');
writeFileSync(join(outputDirectory, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`, 'utf8');

const forbiddenExtensions = new Set(['.md', '.mp4', '.png']);
const pendingDirectories = [outputDirectory];
const forbiddenFiles = [];
while (pendingDirectories.length > 0) {
  const directory = pendingDirectories.pop();
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      pendingDirectories.push(entryPath);
    } else if (forbiddenExtensions.has(extname(entry.name).toLowerCase()) && !entryPath.includes(`${join(outputDirectory, 'favicon')}`)) {
      forbiddenFiles.push(entryPath);
    }
  }
}
if (forbiddenFiles.length > 0) {
  throw new Error(`Unexpected Wiki media or Markdown in the Pages build:\n${forbiddenFiles.join('\n')}`);
}
console.info(`[GOLT] Finalized the homepage, ${wikiUrls.length} indexable Wiki routes, and the custom 404 document.`);
