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
// Reports become public issues, so a name that only exists inside a company or a
// home network (hr.intranet.acme.corp, nas.local) must never be published. These
// endings are reserved or in common private use; the extension refuses them too.
// Anything else must also resolve, in public DNS, to a public address.
const PRIVATE_ENDINGS = new Set([
  'alt', 'arpa', 'corp', 'example', 'home', 'internal', 'intranet', 'invalid', 'lan',
  'local', 'localdomain', 'localhost', 'onion', 'private', 'test'
]);
const DNS_RESOLVER = 'https://cloudflare-dns.com/dns-query';
// At most this many new issues an hour across all visitors, so a script that
// fakes the extension's origin from many addresses cannot flood the repository.
// Reports for a website that already has an open issue are still added to it.
const NEW_ISSUES_PER_HOUR = 20;

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
  if (isPrivateName(report.site)) return json({ ok: false, error: 'not-public' }, 400, cors);
  if (!env.GITHUB_TOKEN) return json({ ok: false, error: 'unavailable' }, 503, cors);

  let outcome;
  try {
    if (!(await resolvesPublicly(report.site, fetchImpl))) {
      return json({ ok: false, error: 'not-public' }, 400, cors);
    }
    outcome = await fileReport(report, env, fetchImpl);
  } catch (error) {
    console.error('Could not file a website report.', error instanceof Error ? error.message : error);
    return json({ ok: false, error: 'unavailable' }, 502, cors);
  }
  if (outcome === 'busy') return json({ ok: false, error: 'rate-limited' }, 429, cors);
  return json({ ok: true }, 200, cors);
}

export function isPrivateName(site) {
  return PRIVATE_ENDINGS.has(site.slice(site.lastIndexOf('.') + 1));
}

// Asks public DNS for the name's addresses. A name that does not exist outside a
// private network, or that points only at private addresses (a common way to
// publish intranet hosts), is not public and is not reported.
export async function resolvesPublicly(site, fetchImpl = fetch) {
  for (const [type, code] of [['A', 1], ['AAAA', 28]]) {
    const response = await fetchImpl(`${DNS_RESOLVER}?name=${encodeURIComponent(site)}&type=${type}`, {
      headers: { Accept: 'application/dns-json' }
    });
    if (!response.ok) throw new Error(`DNS lookup answered ${response.status}`);
    const answer = await response.json();
    const addresses = (answer.Answer || [])
      .filter((record) => record.type === code)
      .map((record) => record.data);
    if (addresses.some(isPublicAddress)) return true;
  }
  return false;
}

export function isPublicAddress(address) {
  if (typeof address !== 'string') return false;
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const ipv4 = mapped ? mapped[1] : address;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ipv4)) {
    const [a, b] = ipv4.split('.').map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const ipv6 = address.toLowerCase();
  if (!ipv6.includes(':')) return false;
  return !(
    ipv6 === '::' || ipv6 === '::1' ||
    /^f[cd]/.test(ipv6) ||
    /^fe[89ab]/.test(ipv6) ||
    /^ff/.test(ipv6)
  );
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
  if (!existing && await newIssueCapReached(github, repo)) return 'busy';

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
  return existing ? 'commented' : 'opened';
}

// GitHub's own count is the counter, so the cap holds across every Cloudflare
// location without extra storage. Its search can trail by about a minute.
async function newIssueCapReached(github, repo) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const query = `repo:${repo} is:issue label:${LABEL} created:>=${since}`;
  const response = await github(`/search/issues?q=${encodeURIComponent(query)}&per_page=1`);
  if (!response.ok) throw new Error(`GitHub count answered ${response.status}`);
  return (await response.json()).total_count >= NEW_ISSUES_PER_HOUR;
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
