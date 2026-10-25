// twinprice.com is mostly static files from dist/. This Worker runs first only for
// /api/* (see run_worker_first in wrangler.jsonc) and hands everything else back
// to the assets. Its one job: take a "Report this website" press from the
// extension and turn it into a GitHub issue, one issue per website.

const REASONS = Object.freeze({
  'no-prices': 'No prices were found',
  'no-currency': 'The source currency could not be detected',
  'failed': 'Conversion failed'
});
const BROWSERS = new Set(['chrome', 'firefox', 'edge']);
const LABEL = 'site-report';
// GITHUB_REPO in wrangler.jsonc names the repository. Editing secrets in the
// Cloudflare dashboard has dropped that variable from the live version before
// (2026-10-25), so reports fall back to the extension's own repository.
const DEFAULT_REPO = 'somewordshere/twinprice';
const MAX_BODY_BYTES = 1024;
// The store build's ID, unpacked Chrome builds (32 letters a–p) and Firefox's
// per-install UUIDs. CORS stops other websites from posting with a visitor's
// browser; it is not a defence against scripts, which the rate limit covers.
const EXTENSION_ORIGIN = /^(?:chrome-extension:\/\/[a-p]{32}|moz-extension:\/\/[0-9a-f-]{36})$/;
const HOSTNAME = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/report') return handleReport(request, env);
    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'not-found' }, 404);
    return env.ASSETS.fetch(request);
  }
};

export async function handleReport(request, env, fetchImpl = fetch) {
  const origin = request.headers.get('Origin') || '';
  const cors = EXTENSION_ORIGIN.test(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {};
  if (request.method === 'OPTIONS') {
    if (!cors['Access-Control-Allow-Origin']) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, { ...cors, Allow: 'POST, OPTIONS' });
  if (!cors['Access-Control-Allow-Origin']) return json({ ok: false, error: 'origin' }, 403);

  // The address is used only as the rate-limit key, held by Cloudflare for the
  // length of the window. It is never logged or passed to GitHub.
  const visitor = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.REPORT_LIMITER) {
    const { success } = await env.REPORT_LIMITER.limit({ key: visitor });
    if (!success) return json({ ok: false, error: 'rate-limited' }, 429, cors);
  }

  const report = parseReport(await readBody(request));
  if (!report) return json({ ok: false, error: 'invalid' }, 400, cors);
  if (!env.GITHUB_TOKEN) return json({ ok: false, error: 'unavailable' }, 503, cors);

  try {
    await fileReport(report, env, fetchImpl);
  } catch (error) {
    console.error('Could not file a website report.', error instanceof Error ? error.message : error);
    return json({ ok: false, error: 'unavailable' }, 502, cors);
  }
  return json({ ok: true }, 200, cors);
}

async function readBody(request) {
  const declared = Number(request.headers.get('Content-Length'));
  if (declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Every field is checked against a closed format, so nothing a sender writes
// reaches the issue except a hostname, a known reason and short codes.
export function parseReport(input) {
  if (!input || typeof input !== 'object') return null;
  const site = typeof input.site === 'string' ? input.site.toLowerCase() : '';
  if (!HOSTNAME.test(site)) return null;
  if (!Object.hasOwn(REASONS, input.reason)) return null;
  const version = typeof input.version === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(input.version)
    ? input.version
    : null;
  if (!version) return null;
  const browser = BROWSERS.has(input.browser) ? input.browser : null;
  if (!browser) return null;
  const to = typeof input.to === 'string' && /^[A-Z]{3}$/.test(input.to) ? input.to : null;
  const language = typeof input.language === 'string' && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(input.language)
    ? input.language
    : null;
  return { site, reason: input.reason, version, browser, to, language };
}

async function fileReport(report, env, fetchImpl) {
  const github = (path, init = {}) => fetchImpl(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'twinprice.com site reports',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  const repo = env.GITHUB_REPO || DEFAULT_REPO;
  const title = `Site report: ${report.site}`;
  const query = `repo:${repo} is:issue is:open label:${LABEL} in:title "${title}"`;
  const search = await github(`/search/issues?q=${encodeURIComponent(query)}&per_page=10`);
  if (!search.ok) throw new Error(`GitHub search answered ${search.status}`);
  const existing = (await search.json()).items?.find((issue) => issue.title === title);

  const response = existing
    ? await github(`/repos/${repo}/issues/${existing.number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: `Reported again.\n\n${details(report)}` })
    })
    : await github(`/repos/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, labels: [LABEL], body: issueBody(report) })
    });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
}

function issueBody(report) {
  return [
    `Someone pressed **Report this website** in Twinprice on \`${report.site}\`.`,
    '',
    details(report),
    '',
    'Later reports for this website are added as comments. Only the website name, the reason and the extension details are sent; never the page address or its contents.'
  ].join('\n');
}

function details(report) {
  return [
    '| | |',
    '| --- | --- |',
    `| What happened | ${REASONS[report.reason]} |`,
    `| Twinprice | ${report.version} (${report.browser}) |`,
    `| Target currency | ${report.to || 'unknown'} |`,
    `| Interface language | ${report.language || 'unknown'} |`
  ].join('\n');
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}
