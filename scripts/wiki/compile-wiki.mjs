import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {basename, extname, isAbsolute, join, relative, resolve} from 'node:path';

import GithubSlugger from 'github-slugger';
import hljs from 'highlight.js';
import {marked, Renderer} from 'marked';
import markedKatex from 'marked-katex-extension';
import sanitizeHtml from 'sanitize-html';

const root = resolve(import.meta.dirname, '..', '..');
const wikiDirectory = join(root, 'wiki');
const generatedFile = join(root, 'src', 'app', 'feature', 'wiki', 'model', 'wiki-content.generated.json');
const buildMetadataFile = join(root, '.angular', 'wiki-pages.json');
const siteBase = '/game-of-life-tribes';
const rawBase = 'https://raw.githubusercontent.com/rChimisso/game-of-life-tribes/main/';

marked.use(markedKatex({nonStandard: true, strict: false, throwOnError: false}));

/**
 * Converts a Wiki filename or title to its canonical route slug.
 *
 * @param {string} value source value.
 * @returns {string} canonical slug.
 */
function slugifyPage(value) {
  return decodeURIComponent(value).replace(/\.md$/i, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Escapes a value for use in an HTML attribute.
 *
 * @param {string} value source value.
 * @returns {string} escaped value.
 */
function escapeAttribute(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Extracts readable text from basic Markdown.
 *
 * @param {string} value Markdown value.
 * @returns {string} plain text.
 */
function plainText(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~$]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\[,{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a concise description from page prose.
 *
 * @param {string} markdown page Markdown.
 * @returns {string} page description.
 */
function extractDescription(markdown) {
  const blocks = markdown.split(/\r?\n\r?\n/);
  let description = '';
  for (const block of blocks) {
    const candidate = block.trim();
    if (description.length === 0 && candidate.length > 0 && !/^(#|[-*+] |\d+\. |\||```|<)/.test(candidate)) {
      description = plainText(candidate);
    }
  }
  if (description.length > 160) {
    description = `${description.slice(0, 157).trimEnd()}...`;
  }
  return description;
}

/**
 * Resolves a repository media reference to its raw public URL.
 *
 * @param {string} href source media reference.
 * @returns {string} public URL.
 */
function resolveMedia(href) {
  let resolved = href;
  if (href.startsWith(rawBase)) {
    const repositoryPath = href.slice(rawBase.length);
    if (!existsSync(join(root, repositoryPath))) {
      throw new Error(`Raw repository media is missing: ${repositoryPath}`);
    }
    resolved = href;
  } else if (!/^(https?:|data:)/.test(href)) {
    const mediaPath = resolve(wikiDirectory, href);
    const repositoryPath = relative(root, mediaPath);
    if (repositoryPath.startsWith('..') || isAbsolute(repositoryPath)) {
      throw new Error(`Wiki media resolves outside the repository: ${href}`);
    }
    if (!existsSync(mediaPath)) {
      throw new Error(`Wiki media is missing: ${repositoryPath}`);
    }
    resolved = `${rawBase}${repositoryPath.replaceAll('\\', '/')}`;
  }
  return resolved;
}

/**
 * Resolves a Markdown link and records internal link validation data.
 *
 * @param {string} href source link.
 * @param {string} currentSlug current page slug.
 * @param {Set<string>} knownSlugs known page slugs.
 * @param {Array<object>} linkReferences collected internal links.
 * @returns {{href: string, external: boolean}} resolved link.
 */
function resolveLink(href, currentSlug, knownSlugs, linkReferences) {
  let resolvedHref = href;
  let external = /^(https?:|mailto:)/.test(href);
  if (!external) {
    const [pagePart, fragment = ''] = href.split('#', 2);
    const targetSlug = pagePart.length > 0 ? slugifyPage(pagePart) : currentSlug;
    if (!knownSlugs.has(targetSlug)) {
      throw new Error(`Broken Wiki link from ${currentSlug}: ${href}`);
    }
    linkReferences.push({source: currentSlug, target: targetSlug, fragment});
    resolvedHref = `${siteBase}/wiki/${targetSlug === 'home' ? '' : `${targetSlug}/`}${fragment.length > 0 ? `#${fragment}` : ''}`;
  }
  return {href: resolvedHref, external};
}

/**
 * Rewrites raw HTML media sources before Markdown rendering.
 *
 * @param {string} markdown page Markdown.
 * @returns {string} rewritten Markdown.
 */
function rewriteRawMedia(markdown) {
  return markdown.replace(/(src=["'])([^"']+)(["'])/g, (match, prefix, href, suffix) => `${prefix}${resolveMedia(href)}${suffix}`);
}

/**
 * Creates the renderer for one Wiki page.
 *
 * @param {string} currentSlug current page slug.
 * @param {Set<string>} knownSlugs known page slugs.
 * @param {Set<string>} headingIds collected heading IDs.
 * @param {Array<object>} linkReferences collected link references.
 * @returns {import('marked').RendererObject} Marked renderer.
 */
function createRenderer(currentSlug, knownSlugs, headingIds, linkReferences) {
  const slugger = new GithubSlugger();
  const renderer = new Renderer();
  renderer.heading = function({tokens, depth}) {
      const text = this.parser.parseInline(tokens);
      const id = slugger.slug(plainText(text));
      headingIds.add(id);
      const anchor = `${siteBase}/wiki/${currentSlug === 'home' ? '' : currentSlug}#${id}`;
      return `<h${depth} id="${escapeAttribute(id)}"><a class="heading-anchor" href="${escapeAttribute(anchor)}" aria-label="Link to this section">#</a>${text}</h${depth}>\n`;
  };
  renderer.code = function({text, lang}) {
      const language = lang?.trim().split(/\s+/)[0] ?? 'plaintext';
      const supportedLanguage = hljs.getLanguage(language) ? language : 'plaintext';
      const highlighted = hljs.highlight(text, {language: supportedLanguage}).value;
      return `<pre><code class="hljs language-${escapeAttribute(supportedLanguage)}">${highlighted}</code></pre>\n`;
  };
  renderer.link = function({href, title, tokens}) {
      const resolved = resolveLink(href, currentSlug, knownSlugs, linkReferences);
      const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : '';
      const externalAttributes = resolved.external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${escapeAttribute(resolved.href)}"${titleAttribute}${externalAttributes}>${this.parser.parseInline(tokens)}</a>`;
  };
  renderer.image = function({href, title, text}) {
      if (text.trim().length === 0) {
        throw new Error(`Image without alt text on ${currentSlug}: ${href}`);
      }
      const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : '';
      return `<img src="${escapeAttribute(resolveMedia(href))}" alt="${escapeAttribute(text)}"${titleAttribute} loading="lazy" decoding="async">`;
  };
  return renderer;
}

const mathTags = ['math', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'msubsup', 'mfrac', 'mtext', 'mspace', 'munderover', 'mover', 'munder', 'mtable', 'mtr', 'mtd', 'menclose', 'msqrt', 'mroot', 'mpadded', 'mphantom'];

/**
 * Sanitizes build-generated Wiki HTML.
 *
 * @param {string} html generated HTML.
 * @returns {string} sanitized HTML.
 */
function sanitizeWikiHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'video', 'source', 'details', 'summary', 'kbd', 'span', 'div', ...mathTags],
    allowedAttributes: {
      '*': ['class', 'id', 'title', 'aria-hidden', 'aria-label', 'style'],
      a: ['href', 'target', 'rel', 'title', 'class', 'aria-label'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding', 'align'],
      video: ['controls', 'muted', 'playsinline', 'preload', 'width'],
      source: ['src', 'type'],
      td: ['align'],
      th: ['align'],
      annotation: ['encoding']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false
  });
}

/**
 * Parses the GitHub Wiki sidebar into navigation sections.
 *
 * @param {string} markdown sidebar Markdown.
 * @param {Set<string>} knownSlugs known page slugs.
 * @returns {Array<object>} navigation sections.
 */
function parseNavigation(markdown, knownSlugs) {
  const sections = [];
  let section = null;
  for (const line of markdown.split(/\r?\n/)) {
    const headingMatch = /^## \[([^\]]+)]\(([^)]+)\)$/.exec(line.trim());
    const itemMatch = /^\[([^\]]+)]\(([^)]+)\)$/.exec(line.trim());
    if (headingMatch) {
      const slug = slugifyPage(headingMatch[2]);
      section = {landing: {label: headingMatch[1], slug}, items: []};
      sections.push(section);
    } else if (itemMatch && section) {
      section.items.push({label: itemMatch[1], slug: slugifyPage(itemMatch[2])});
    }
  }
  for (const navigationSection of sections) {
    for (const item of [navigationSection.landing, ...navigationSection.items]) {
      if (!knownSlugs.has(item.slug)) {
        throw new Error(`Sidebar references missing Wiki page: ${item.slug}`);
      }
    }
  }
  return sections;
}

const sourceFiles = readdirSync(wikiDirectory)
  .filter(filename => extname(filename).toLowerCase() === '.md' && !filename.startsWith('_'))
  .sort((left, right) => left.localeCompare(right));
const sourceBySlug = new Map(sourceFiles.map(filename => [slugifyPage(basename(filename, '.md')), filename]));
const knownSlugs = new Set(sourceBySlug.keys());
if (sourceBySlug.size !== sourceFiles.length) {
  throw new Error('Wiki filenames produce duplicate canonical slugs.');
}

const pages = {};
const headingsByPage = new Map();
const linkReferences = [];
for (const [slug, filename] of sourceBySlug) {
  const markdown = readFileSync(join(wikiDirectory, filename), 'utf8').replace(/^\uFEFF/, '');
  if (/<img\b(?![^>]*\balt=["'][^"']+["'])[^>]*>/i.test(markdown) || /!\[\]\(/.test(markdown)) {
    throw new Error(`Wiki page contains an image without alt text: ${filename}`);
  }
  const titleMatch = /^#\s+(.+)$/m.exec(markdown);
  if (!titleMatch) {
    throw new Error(`Wiki page has no level-one heading: ${filename}`);
  }
  const headingIds = new Set();
  const renderer = createRenderer(slug, knownSlugs, headingIds, linkReferences);
  const rendered = marked.parse(rewriteRawMedia(markdown), {gfm: true, renderer});
  pages[slug] = {
    slug,
    title: plainText(titleMatch[1]),
    description: extractDescription(markdown),
    html: sanitizeWikiHtml(rendered)
  };
  headingsByPage.set(slug, headingIds);
}

for (const reference of linkReferences) {
  if (reference.fragment.length > 0 && !headingsByPage.get(reference.target)?.has(reference.fragment)) {
    throw new Error(`Broken Wiki fragment from ${reference.source}: ${reference.target}#${reference.fragment}`);
  }
}

const navigation = parseNavigation(readFileSync(join(wikiDirectory, '_Sidebar.md'), 'utf8'), knownSlugs);
const orderedSlugs = ['home', ...sourceFiles.map(filename => slugifyPage(basename(filename, '.md'))).filter(slug => slug !== 'home')];
const content = {pages, navigation, slugs: orderedSlugs};
mkdirSync(join(root, 'src', 'app', 'feature', 'wiki', 'model'), {recursive: true});
mkdirSync(join(root, '.angular'), {recursive: true});
writeFileSync(generatedFile, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
writeFileSync(buildMetadataFile, JSON.stringify({slugs: orderedSlugs}, null, 2), 'utf8');
console.info(`[GOLT] Compiled ${sourceFiles.length} Wiki pages.`);
