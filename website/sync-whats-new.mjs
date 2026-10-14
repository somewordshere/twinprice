// Rebuild the public What's new page from the repository's user changelog (WHATS-NEW.md).
// The release notes stay in English on every language version, like the privacy policy;
// the surrounding page is translated by build-i18n.mjs.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const source = await readFile(new URL('../WHATS-NEW.md', import.meta.url), 'utf8');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const inline = value => escape(value)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
  .replace(/(^|[\s(])(https:\/\/[^\s)<]+?)(?=[.,]?(?:\s|$))/g, '$1<a href="$2">$2</a>');
// The file's own title and introduction are written for the repository; the page has its own.
const releases = source.replace(/\r\n/g, '\n').split(/^## /m).slice(1);
if (!releases.length) throw new Error('WHATS-NEW.md has no release sections.');
const rendered = releases.map(section => {
  const [heading, ...rest] = section.trim().split('\n');
  const version = heading.split(' · ')[0].trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Unexpected release heading: ${heading}`);
  const items = rest.join('\n').trim().split(/\n(?=- )/).map(item => {
    if (!item.startsWith('- ')) throw new Error(`Release ${version} has text outside a list item: ${item}`);
    return `<li>${inline(item.slice(2).replace(/\n\s*/g, ' '))}</li>`;
  });
  return `<section class="release" id="v${version.replaceAll('.', '-')}"><h2>${escape(heading.trim())}</h2><ul>${items.join('')}</ul></section>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#245bea"><title>What's new — twinprice.com</title><meta name="description" content="Every Twinprice release, newest first: new features, fixes and changes you can see in the extension."><link rel="canonical" href="https://twinprice.com/whats-new/"><!-- i18n:alternates --><!-- /i18n:alternates --><meta property="og:title" content="What's new in Twinprice"><meta property="og:description" content="Every Twinprice release, newest first."><meta property="og:type" content="website"><meta property="og:url" content="https://twinprice.com/whats-new/">
  <meta property="og:site_name" content="Twinprice">
  <meta property="og:image" content="https://twinprice.com/assets/social-preview.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Twinprice: a free currency converter extension for Chrome and Firefox. Shop abroad. See prices in your currency.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://twinprice.com/assets/social-preview.png"><link rel="icon" href="../favicon.ico" sizes="48x48"><link rel="icon" href="../assets/favicon-48.png" type="image/png" sizes="48x48"><link rel="icon" href="../assets/favicon-96.png" type="image/png" sizes="96x96"><link rel="icon" href="../assets/favicon-192.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="../assets/apple-touch-icon.png"><link rel="stylesheet" href="../styles.css"></head>
<body><a class="skip-link" href="#main">Skip to content</a><header class="site-header wrap"><a class="brand" href="../" aria-label="twinprice.com home"><img src="../assets/twinprice-icon.png" width="32" height="32" alt=""><span>twinprice<span class="brand-period">.</span>com</span></a><nav aria-label="Main navigation"><a href="../#how-it-works">How it works</a><a href="../guide/">Guide</a><a href="../privacy/">Privacy</a><a href="../about/">About</a></nav><!-- i18n:languages --><!-- /i18n:languages --><a class="button button-small" href="../#install">Get Twinprice <span aria-hidden="true">↗</span></a></header>
<main class="wrap policy-main" id="main"><p class="eyebrow">RELEASE NOTES</p><h1>What's new</h1><div class="policy-notice"><p>Every Twinprice release, newest first. The notes below are in English. Before version 2.1.0, Twinprice was called Currency Converter Pro. The Chrome and Firefox stores may not offer the newest version at the same time.</p></div><article class="policy-content whats-new" aria-label="Release notes"><div lang="en" translate="no">${rendered}</div></article></main>
<footer class="site-footer wrap"><a class="brand" href="../"><span>twinprice<span class="brand-period">.</span>com</span></a><span>A familiar price, wherever you shop.</span><a href="../guide/">User guide</a><a href="../about/">About</a><a href="../privacy/">Privacy policy</a><a href="./" aria-current="page">What's new</a><a href="https://github.com/somewordshere/twinprice/issues">Help / Report an issue</a><a href="https://github.com/somewordshere/twinprice">Source code</a></footer></body></html>`;
await mkdir(new URL('./dist/whats-new/', import.meta.url), { recursive: true });
await writeFile(new URL('./dist/whats-new/index.html', import.meta.url), html);
console.log(`What's new page updated: ${releases.length} releases.`);
