// Build the translated pages from the authored English ones.
//
// The English pages in dist/ stay the source. Every piece of visible text in them is
// a "unit", identified by a hash of its English wording; i18n/<language>.json maps
// those hashes to translations, and i18n/en.json lists the English for reference.
// Inline markup inside a unit is written as numbered tags (<1>…</1>, <2/>), so a
// translation can move a link or bold phrase without retyping its attributes.
//
//   node build-i18n.mjs            write dist/<language>/…, the language menus and the sitemap
//   node build-i18n.mjs --extract  only refresh i18n/en.json
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const SITE = 'https://twinprice.com/';
const PAGES = ['', 'guide/', 'about/', 'privacy/', 'goodbye/'];
// Each language's own name, the menu's accessible label, and the store locales.
const LANGUAGES = {
  en: { name: 'English', label: 'Language' },
  de: { name: 'Deutsch', label: 'Sprache' },
  es: { name: 'Español', label: 'Idioma', amo: 'es-ES' },
  fr: { name: 'Français', label: 'Langue' },
  it: { name: 'Italiano', label: 'Lingua' },
  nl: { name: 'Nederlands', label: 'Taal' },
  pl: { name: 'Polski', label: 'Język' },
  'pt-BR': { name: 'Português (Brasil)', label: 'Idioma', short: 'PT' },
  tr: { name: 'Türkçe', label: 'Dil' },
  uk: { name: 'Українська', label: 'Мова' },
};
// Translated pages first appeared on this date; the sitemap never reports an earlier one.
const TRANSLATED_SINCE = '2026-10-13';

const VOID = new Set(['meta', 'link', 'img', 'br', 'input', 'hr']);
const TEXT_ATTRIBUTES = new Set(['alt', 'aria-label', 'title', 'placeholder']);
const META_CONTENT = new Set(['description', 'og:title', 'og:description', 'og:image:alt']);
const GLOBE = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13M8 1.5c2 2 2 11 0 13M8 1.5c-2 2-2 11 0 13"/></svg>';

const file = path => new URL(path, import.meta.url);
const hashOf = text => createHash('sha1').update(text).digest('hex').slice(0, 6);
const squeeze = text => text.replace(/\s+/g, ' ').trim();
const hasLetters = text => /\p{L}/u.test(text);

// A small parser for the site's own well-formed markup; not a general HTML parser.
function parse(html) {
  const root = { tag: '#root', children: [] };
  const stack = [root];
  const tokens = html.match(/<!--[\s\S]*?-->|<!doctype[^>]*>|<(script|style)\b[\s\S]*?<\/\1>|<\/?[a-zA-Z][^>]*>|[^<]+/gi);
  for (const token of tokens) {
    const parent = stack[stack.length - 1];
    if (/^<(script|style)\b/i.test(token)) {
      parent.children.push({ raw: token, script: true });
    } else if (token.startsWith('<!')) {
      parent.children.push({ raw: token });
    } else if (token.startsWith('</')) {
      const tag = token.slice(2, -1).trim().toLowerCase();
      if (stack.length < 2 || parent.tag !== tag) throw new Error(`Unbalanced </${tag}> inside <${parent.tag}>`);
      stack.pop();
    } else if (token.startsWith('<')) {
      const tag = /^<([a-zA-Z0-9]+)/.exec(token)[1].toLowerCase();
      const node = { tag, open: token, attributes: readAttributes(token), children: [] };
      parent.children.push(node);
      if (!VOID.has(tag) && !token.endsWith('/>')) stack.push(node);
      else node.closed = true;
    } else {
      parent.children.push({ text: token });
    }
  }
  if (stack.length !== 1) throw new Error(`Unclosed <${stack[stack.length - 1].tag}>`);
  return root;
}

function readAttributes(open) {
  const attributes = {};
  for (const [, name, value] of open.matchAll(/\s([a-zA-Z_:][-\w:.]*)(?:="([^"]*)")?/g)) attributes[name.toLowerCase()] = value ?? '';
  return attributes;
}

const isCurrencyOption = node => node.tag === 'option' && /^[A-Z]{3}$/.test(node.attributes.value || '');
const subtreeText = node => node.text ?? (node.children || []).map(subtreeText).join('');
const translatableAttributes = node => Object.entries(node.attributes).filter(([name, value]) => value.trim() && (
  TEXT_ATTRIBUTES.has(name) || name.startsWith('data-text-')
  || (name === 'content' && node.tag === 'meta' && META_CONTENT.has(node.attributes.name || node.attributes.property))));

// A unit is the content of the innermost element that holds text directly.
const holdsText = node => node.children.some(child => child.text && child.text.trim());

function unitSource(node, parts) {
  let source = '';
  for (const child of node.children) {
    if (child.text !== undefined) source += child.text;
    else if (child.raw !== undefined) source += child.raw;
    else if (child.tag === 'br') source += '<br>';
    else {
      const id = parts.push(child);
      const atomic = child.closed || (!hasLetters(subtreeText(child)) && !hasAttributeText(child));
      source += atomic ? `<${id}/>` : `<${id}>${unitSource(child, parts)}</${id}>`;
      child.atomic = atomic;
    }
  }
  return source;
}

const hasAttributeText = node => translatableAttributes(node).length > 0 || (node.children || []).some(child => child.tag && hasAttributeText(child));

function createTranslator(language, table, keep, report) {
  const catalog = new Map();
  const lookup = english => {
    const key = hashOf(english);
    if (catalog.has(key) && catalog.get(key) !== english) throw new Error(`Two units share the key ${key}; lengthen the hash.`);
    catalog.set(key, english);
    if (language === 'en' || keep.has(english)) return english;
    if (table[key] === undefined) { report.missing.set(key, english); return english; }
    report.used.add(key);
    return table[key];
  };
  return { catalog, lookup };
}

function render(node, context) {
  if (node.text !== undefined) return node.text;
  if (node.raw !== undefined) return node.script ? context.script(node.raw) : node.raw;
  const open = context.openTag(node);
  if (node.closed) return open;
  const close = `</${node.tag}>`;
  if (node.attributes.translate === 'no') return context.openTag(node, false) + node.children.map(child => renderPlain(child, context, false)).join('') + close;
  if (isCurrencyOption(node)) return open + context.currencyOption(node) + close;
  if (!holdsText(node)) return open + node.children.map(child => render(child, context)).join('') + close;

  const parts = [];
  const raw = unitSource(node, parts);
  const [, lead, body, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
  const english = squeeze(body);
  if (!hasLetters(english.replace(/<[^>]*>/g, ''))) return open + node.children.map(child => renderPlain(child, context)).join('') + close;
  const translated = context.lookup(english);
  const tagsOf = text => (text.match(/<\/?\d+\/?>|<br>/g) || []).sort().join(' ');
  if (tagsOf(translated) !== tagsOf(english)) throw new Error(`${context.language}: markup differs from the English in ${hashOf(english)}: ${translated}`);
  const filled = translated.replace(/<(\/?)(\d+)(\/?)>/g, (match, closing, id, atomic) => {
    const part = parts[id - 1];
    if (atomic) return part.closed ? context.openTag(part) : renderPlain(part, context);
    return closing ? `</${part.tag}>` : context.openTag(part);
  });
  return open + lead + filled + trail + close;
}

// Markup that is passed through untranslated still needs its links and attributes adjusted.
function renderPlain(node, context, translate = true) {
  if (node.text !== undefined) return node.text;
  if (node.raw !== undefined) return node.raw;
  const open = context.openTag(node, translate);
  return node.closed ? open : open + node.children.map(child => renderPlain(child, context, translate)).join('') + `</${node.tag}>`;
}

function buildPage(english, page, language, context) {
  const depth = page ? page.split('/').length - 1 : 0;
  const up = '../'.repeat(depth + (language === 'en' ? 0 : 1));
  const address = code => SITE + (code === 'en' ? '' : code + '/') + page;
  const store = LANGUAGES[language];

  const alternates = [...Object.keys(LANGUAGES).map(code => `<link rel="alternate" hreflang="${code}" href="${address(code)}">`),
    `<link rel="alternate" hreflang="x-default" href="${address('en')}">`].join('');
  const links = Object.entries(LANGUAGES).map(([code, { name }]) =>
    `<li><a href="${up + (code === 'en' ? '' : code + '/') + page || './'}" hreflang="${code}" lang="${code}"${code === language ? ' aria-current="true"' : ''}>${name}</a></li>`).join('');
  const menu = `<details class="language-menu" translate="no"><summary aria-label="${store.label}: ${store.name}">${GLOBE}<span>${store.short || language.toUpperCase()}</span></summary><ul>${links}</ul></details>`;
  const html = english
    .replace(/(<!-- i18n:alternates -->)[\s\S]*?(<!-- \/i18n:alternates -->)/, `$1${alternates}$2`)
    .replace(/(<!-- i18n:languages -->)[\s\S]*?(<!-- \/i18n:languages -->)/, `$1${menu}$2`);
  if (language === 'en') return html;

  const currencyNames = new Intl.DisplayNames([language], { type: 'currency' });
  const localize = url => url.startsWith(SITE) && !/\.\w+$/.test(url.split(/[?#]/)[0]) ? SITE + language + '/' + url.slice(SITE.length) : url;
  const pageContext = {
    ...context,
    language,
    currencyOption: node => `${node.attributes.value} · ${currencyNames.of(node.attributes.value)}`,
    openTag(node, translate = true) {
      if (node.tag === 'html') return `<html lang="${language}">`;
      const values = new Map();
      for (const [name, value] of translatableAttributes(node)) {
        if (translate) values.set(name, context.lookup(squeeze(value)));
      }
      const inMenu = node.attributes.hreflang !== undefined;
      for (const name of ['href', 'src']) {
        const value = node.attributes[name];
        if (value === undefined || inMenu) continue;
        if (/^(https?:|#|mailto:|data:)/.test(value)) {
          if (node.tag === 'a' && value.includes('addons.mozilla.org/en-US/')) values.set(name, value.replace('/en-US/', `/${store.amo || language}/`));
          else if (node.tag === 'a' && value.includes('chromewebstore.google.com/')) values.set(name, `${value}?hl=${language}`);
          else if (node.tag === 'link' && node.attributes.rel === 'canonical') values.set(name, localize(value));
        } else if (/\.\w+$/.test(value.split(/[?#]/)[0])) {
          values.set(name, '../' + value); // Shared styles, scripts and images live one level up.
        }
      }
      if (node.tag === 'meta' && node.attributes.property === 'og:url') values.set('content', localize(node.attributes.content));
      let open = node.open;
      for (const [name, value] of values) open = open.replace(new RegExp(`(\\s${name}=")[^"]*(")`, 'i'), (match, before, after) => before + value + after);
      return open;
    },
    // Structured data: pages describe themselves in their own language; the site and product keep one identity.
    script(raw) {
      if (!raw.includes('application/ld+json')) return raw.replace(/(\ssrc=")([^"]+)(")/, '$1../$2$3');
      const [, open, json, close] = /^(<script[^>]*>)([\s\S]*)(<\/script>)$/.exec(raw);
      const visit = value => {
        if (Array.isArray(value)) return value.map(visit);
        if (!value || typeof value !== 'object') return value;
        if (value['@type'] === 'WebSite') return value;
        const isPage = /Page$/.test(value['@type'] || '');
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
          if (isPage && (key === '@id' || key === 'url')) return [key, localize(entry)];
          if (isPage && key === 'inLanguage') return [key, language];
          if (['name', 'description'].includes(key) && typeof entry === 'string' && entry !== 'Twinprice') return [key, context.lookup(entry)];
          if (key === 'featureList') return [key, entry.map(context.lookup)];
          return [key, visit(entry)];
        }));
      };
      return `${open}\n${JSON.stringify(visit(JSON.parse(json)), null, 2)}\n  ${close}`;
    },
  };
  return parse(html).children.map(node => render(node, pageContext)).join('');
}

const readJson = async path => JSON.parse(await readFile(file(path), 'utf8').catch(() => 'null'));
const keep = new Set(await readJson('./i18n/keep.json') || []);
const sources = Object.fromEntries(await Promise.all(PAGES.map(async page => [page, await readFile(file(`./dist/${page}index.html`), 'utf8')])));
const extractOnly = process.argv.includes('--extract');
let failed = false;

for (const language of Object.keys(LANGUAGES)) {
  const table = language === 'en' ? {} : await readJson(`./i18n/${language}.json`) || {};
  const report = { missing: new Map(), used: new Set() };
  const translator = createTranslator(language, table, keep, report);
  for (const page of PAGES) {
    const output = buildPage(sources[page], page, language, { lookup: translator.lookup });
    if (language === 'en') {
      // Collect the catalog by reading the page the way a translation would.
      const probe = createTranslator('probe', {}, new Set(), { missing: new Map(), used: new Set() });
      const noop = { lookup: probe.lookup, language: 'en', openTag: (node, translate = true) => { if (translate) translatableAttributes(node).forEach(([, value]) => probe.lookup(squeeze(value))); return node.open; }, currencyOption: subtreeText, script: raw => {
        if (raw.includes('application/ld+json')) JSON.stringify(JSON.parse(raw.replace(/^<script[^>]*>|<\/script>$/g, '')), (key, value) => {
          if (value && value['@type'] === 'WebSite') return undefined;
          if (['name', 'description'].includes(key) && typeof value === 'string' && value !== 'Twinprice') probe.lookup(value);
          if (key === 'featureList') value.forEach(probe.lookup);
          return value;
        });
        return raw;
      } };
      parse(output).children.forEach(node => render(node, noop));
      for (const [key, text] of probe.catalog) translator.catalog.set(key, text);
      if (!extractOnly) await writeFile(file(`./dist/${page}index.html`), output);
    } else if (!extractOnly) {
      await mkdir(file(`./dist/${language}/${page}`), { recursive: true });
      await writeFile(file(`./dist/${language}/${page}index.html`), output);
    }
  }
  if (language === 'en') {
    const catalog = [...translator.catalog].filter(([, text]) => !keep.has(text));
    await mkdir(file('./i18n/'), { recursive: true });
    // Written line by line because JSON.stringify would move all-digit keys to the front.
    await writeFile(file('./i18n/en.json'), `{\n${catalog.map(([key, text]) => `  "${key}": ${JSON.stringify(text)}`).join(',\n')}\n}\n`);
    console.log(`en: ${catalog.length} units in i18n/en.json`);
    if (extractOnly) break;
    continue;
  }
  const unused = Object.keys(table).filter(key => !report.used.has(key));
  console.log(`${language}: ${report.used.size} translated, ${report.missing.size} missing, ${unused.length} unused`);
  for (const [key, text] of report.missing) console.log(`  missing ${key}: ${text}`);
  for (const key of unused) console.log(`  unused ${key}: ${table[key]}`);
  if (report.missing.size || unused.length) failed = true;
}

if (!extractOnly) {
  // The sitemap lists every indexable page in every language; goodbye/ is noindex.
  const sitemap = await readFile(file('./dist/sitemap.xml'), 'utf8');
  const entries = [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod><\/url>/g)]
    .filter(([, address]) => PAGES.includes(address.slice(SITE.length)));
  const lines = entries.flatMap(([, address, modified]) => Object.keys(LANGUAGES).map(language => language === 'en'
    ? `  <url><loc>${address}</loc><lastmod>${modified}</lastmod></url>`
    : `  <url><loc>${SITE}${language}/${address.slice(SITE.length)}</loc><lastmod>${modified > TRANSLATED_SINCE ? modified : TRANSLATED_SINCE}</lastmod></url>`));
  await writeFile(file('./dist/sitemap.xml'), sitemap.replace(/(<urlset[^>]*>)[\s\S]*(<\/urlset>)/, `$1\n${lines.join('\n')}\n$2`));
}
if (failed) { console.error('Translations are incomplete or out of date.'); process.exit(1); }
