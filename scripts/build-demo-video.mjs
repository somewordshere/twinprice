// Records the short product demo video (1920x1080, about 20 seconds).
//
// Same approach as the store screenshots: the real extension runs in the
// Chromium that ships with Playwright against the fictional capture shop, so
// every conversion in the video is one the extension actually performed. The
// rates are the round fixture rates, not live market rates.
//
// Playwright's own video recorder is too soft for store use, so the page is
// captured through the DevTools screencast at 2x device scale and ffmpeg
// (which must be on PATH) assembles the frames. Headless Chromium paints no
// mouse pointer, so the page gets a drawn one that follows the real mouse.
//
//   npm run prepare:chrome && node scripts/build-demo-video.mjs [--out store/video]

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const { runPageCommand, seedExtension } = require("../tests/e2e/harness");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION = join(ROOT, "dist/chrome");
const WORK = join(ROOT, "test-results/demo-video");
const outFlag = process.argv.indexOf("--out");
const OUT = resolve(ROOT, outFlag > -1 ? process.argv[outFlag + 1] : "store/video");

// The one origin the extension holds a standing host permission for; see
// tests/capture/screenshots.spec.js.
const SHOP_URL = "https://api.frankfurter.dev/shop/ceramics";
const SHOP_HTML = readFileSync(join(ROOT, "tests/fixtures/capture-shop.html"), "utf8");
const ICON = readFileSync(join(ROOT, "src/icons/icon128.png")).toString("base64");

const VIEWPORT = { width: 960, height: 540 };
const SCALE = 2;
const FPS = 30;
const FADE = 0.3;
// Each scene is held to a fixed length so the cut runs the same every build.
const PAGE_SCENE_SECONDS = 6.8;
// The converted bubble dismisses itself about 2.3 seconds after it appears, so
// the click is pinned late enough that the scene ends with it still showing.
const SELECTION_CLICK_AT = 4.2;
const SELECTION_SCENE_SECONDS = 6;

function ffmpeg(args) {
  const result = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    stdio: "inherit"
  });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

const ENCODE = ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-color_range", "tv", "-r", String(FPS)];

// ---------------------------------------------------------------------------
// Still artwork: title cards and captions, rendered by the same Chromium.

const CARD_CSS = `
  * { box-sizing: border-box; }
  html { zoom: .75; }
  html, body { margin: 0; width: 100%; height: 100%; }
  body {
    display: grid; place-items: center; text-align: center;
    font-family: Inter, system-ui, "Segoe UI", sans-serif; color: #fff;
  }
  .card { background: linear-gradient(140deg, #16327e, #1b3fbf); }
  h1 { margin: 0; font-size: 58px; font-weight: 700; letter-spacing: -.03em; line-height: 1.12; }
  p { margin: 18px 0 0; font-size: 25px; color: #a9bef5; }
  img { width: 104px; height: 104px; margin-bottom: 26px; }
  .url { margin-top: 34px; font-size: 30px; font-weight: 600; color: #fff; }
  .caption {
    position: fixed; left: 50%; bottom: 44px; transform: translateX(-50%);
    padding: 15px 30px; border-radius: 999px; white-space: nowrap;
    background: rgba(16, 23, 37, .92); box-shadow: 0 10px 34px rgba(16, 23, 37, .28);
    font-size: 25px; font-weight: 600; letter-spacing: -.01em;
  }
`;

async function renderStill(page, name, body, { transparent = false } = {}) {
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>${CARD_CSS}</style>` +
    `<body class="${transparent ? "" : "card"}">${body}</body>`
  );
  const file = join(WORK, `${name}.png`);
  await page.screenshot({ path: file, omitBackground: transparent });
  return file;
}

function cardSegment(name, still, seconds) {
  const file = join(WORK, `${name}.mp4`);
  ffmpeg([
    "-loop", "1", "-t", String(seconds), "-i", still,
    "-vf", `fps=${FPS},fade=in:st=0:d=${FADE},fade=out:st=${seconds - FADE}:d=${FADE}`,
    ...ENCODE, file
  ]);
  return file;
}

// ---------------------------------------------------------------------------
// Scene recording.

// Appended to <html> rather than <body> so the extension's price scan, which
// walks the body, never meets it.
const POINTER_SCRIPT = () => {
  const pointer = document.createElement("div");
  pointer.style.cssText =
    "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;" +
    "width:22px;height:22px;will-change:transform;transform:translate(-100px,-100px)";
  pointer.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 8.2-6.6 1.7L8.6 19z" ' +
    'fill="#101725" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const ring = document.createElement("div");
  ring.style.cssText =
    "position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;width:36px;height:36px;" +
    "margin:-18px 0 0 -18px;border-radius:50%;background:rgba(27,63,191,.28);opacity:0";
  document.documentElement.append(ring, pointer);
  addEventListener("mousemove", (event) => {
    pointer.style.transform = `translate(${event.clientX - 3}px,${event.clientY - 2}px)`;
  }, true);
  addEventListener("mousedown", (event) => {
    ring.style.left = `${event.clientX}px`;
    ring.style.top = `${event.clientY}px`;
    ring.animate(
      [{ opacity: 1, transform: "scale(.4)" }, { opacity: 0, transform: "scale(1.5)" }],
      { duration: 450, easing: "ease-out" }
    );
  }, true);
};

async function openShop(context) {
  const shop = await context.newPage();
  await shop.route(SHOP_URL, (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: SHOP_HTML
  }));
  await shop.goto(SHOP_URL);
  await shop.evaluate(POINTER_SCRIPT);
  return shop;
}

// The screencast only delivers a frame when the page repaints, so each frame is
// held until the next one arrives; ffmpeg turns that into a constant frame rate.
async function startRecording(context, page, name) {
  const dir = join(WORK, name);
  mkdirSync(dir, { recursive: true });
  const cdp = await context.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, at: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 95, everyNthFrame: 1 });
  const startedAt = Date.now() / 1000;

  return {
    // Seconds since the recording began, for timing captions.
    now: () => (Date.now() / 1000) - startedAt,
    // Holds the last frame until the scene reaches its fixed length.
    async holdUntil(seconds) {
      await page.waitForTimeout(Math.max((seconds - ((Date.now() / 1000) - startedAt)) * 1000, 0));
    },
    async stop(captions) {
      const endedAt = Date.now() / 1000;
      await cdp.send("Page.stopScreencast");
      await cdp.detach();

      const kept = frames.filter((frame) => frame.at >= startedAt);
      const first = kept.length ? kept : frames.slice(-1);
      const lines = [];
      first.forEach((frame, index) => {
        const from = index === 0 ? startedAt : frame.at;
        const until = index + 1 < first.length ? first[index + 1].at : endedAt;
        lines.push(`file '${frame.file.replaceAll("\\", "/")}'`, `duration ${Math.max(until - from, 0.001).toFixed(4)}`);
      });
      lines.push(`file '${first.at(-1).file.replaceAll("\\", "/")}'`);
      const list = join(dir, "frames.txt");
      writeFileSync(list, lines.join("\n"));

      const length = endedAt - startedAt;
      const inputs = ["-f", "concat", "-safe", "0", "-i", list];
      let chain = `[0:v]fps=${FPS},scale=${VIEWPORT.width * SCALE}:${VIEWPORT.height * SCALE}:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p[v0]`;
      captions.forEach((caption, index) => {
        inputs.push("-i", caption.still);
        const to = caption.to ?? length;
        chain += `;[v${index}][${index + 1}:v]overlay=0:0:enable='between(t,${caption.from.toFixed(2)},${to.toFixed(2)})'[v${index + 1}]`;
      });
      chain += `;[v${captions.length}]fade=in:st=0:d=${FADE},fade=out:st=${(length - FADE).toFixed(2)}:d=${FADE}[out]`;

      const file = join(WORK, `${name}.mp4`);
      ffmpeg([...inputs, "-filter_complex", chain, "-map", "[out]", "-t", length.toFixed(2), ...ENCODE, file]);
      return file;
    }
  };
}

let pointerAt = { x: 760, y: 470 };

// Paced by the clock, not by a step count: recording slows each step by a
// varying amount, and counted steps made the same glide differ between runs.
async function glide(page, x, y, ms = 800) {
  const from = pointerAt;
  const started = Date.now();
  let t = 0;
  while (t < 1) {
    t = Math.min((Date.now() - started) / ms, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    await page.mouse.move(from.x + ((x - from.x) * eased), from.y + ((y - from.y) * eased));
    await page.waitForTimeout(8);
  }
  pointerAt = { x, y };
}

async function centerOf(locator) {
  const box = await locator.boundingBox();
  return { x: box.x + (box.width / 2), y: box.y + (box.height / 2), box };
}

// ---------------------------------------------------------------------------

// Emptied rather than removed: a shell sitting in the folder locks it on Windows.
for (const entry of existsSync(WORK) ? readdirSync(WORK) : []) rmSync(join(WORK, entry), { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
mkdirSync(OUT, { recursive: true });

const context = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  // The screencast ignores Playwright's emulated device scale and would deliver
  // half-size frames to be blown up. A real 2x browser window records every
  // physical pixel, so the window is scaled by flag and sized by hand instead.
  viewport: null,
  args: [
    `--disable-extensions-except=${EXTENSION}`,
    `--load-extension=${EXTENSION}`,
    `--force-device-scale-factor=${SCALE}`,
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`
  ]
});
context.on("page", (page) => {
  if (page.url().includes("onboarding/onboarding.html")) page.close().catch(() => {});
});

try {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const seed = (settings) => seedExtension(worker, {
    settings: { fromCurrency: "USD", toCurrency: "EUR", ...settings }
  });

  const art = await context.newPage();
  // Grow the window by whatever its frame takes, so the page area is exact.
  const windowCdp = await context.newCDPSession(art);
  const { windowId, bounds } = await windowCdp.send("Browser.getWindowForTarget");
  const inner = await art.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  await windowCdp.send("Browser.setWindowBounds", {
    windowId,
    bounds: {
      width: bounds.width + (VIEWPORT.width - inner.width),
      height: bounds.height + (VIEWPORT.height - inner.height)
    }
  });
  await art.waitForFunction(
    (size) => innerWidth === size.width && innerHeight === size.height, VIEWPORT
  );
  await windowCdp.detach();
  const caption = (name, text) => renderStill(art, name, `<div class="caption">${text}</div>`, { transparent: true });
  const stills = {
    intro: await renderStill(art, "intro", "<div><h1>Shopping abroad?</h1><p>See every price in your own currency.</p></div>"),
    outro: await renderStill(art, "outro",
      `<div><img src="data:image/png;base64,${ICON}" alt=""><h1>Twinprice</h1>` +
      "<p>Free for Chrome and Firefox. Page contents stay on your device.</p>" +
      '<div class="url">twinprice.com</div></div>'),
    foreign: await caption("caption-foreign", "A shop priced in dollars"),
    page: await caption("caption-page", "One click converts the whole page"),
    select: await caption("caption-select", "Or select just one price")
  };
  await art.close();

  // Scene 1: the on-page offer, accepted, converts every price.
  await seed({ showPagePrompt: true });
  let shop = await openShop(context);
  await runPageCommand(worker, "CONTENT_READY", SHOP_URL);
  await shop.mouse.move(pointerAt.x, pointerAt.y);
  let recording = await startRecording(context, shop, "scene-page");
  await glide(shop, 620, 360, 700);
  await shop.waitForTimeout(400);
  await runPageCommand(worker, "SHOW_CONVERT_PROMPT", SHOP_URL);
  await shop.locator(".ccp-page-prompt-action").waitFor();
  await shop.waitForTimeout(700);
  const accept = await centerOf(shop.locator(".ccp-page-prompt-action"));
  await glide(shop, accept.x, accept.y, 700);
  await shop.waitForTimeout(350);
  const converted = recording.now();
  await shop.mouse.down();
  await shop.mouse.up();
  await shop.waitForTimeout(900);
  await glide(shop, 560, 400, 700);
  await recording.holdUntil(PAGE_SCENE_SECONDS);
  const pageScene = await recording.stop([
    { still: stills.foreign, from: 0, to: converted },
    { still: stills.page, from: converted + 0.15 }
  ]);
  await shop.close();

  // Scene 2: dragging across one price offers to convert only that one.
  await seed({ showPagePrompt: false });
  shop = await openShop(context);
  await runPageCommand(worker, "CONTENT_READY", SHOP_URL);
  pointerAt = { x: 740, y: 440 };
  await shop.mouse.move(pointerAt.x, pointerAt.y);
  recording = await startRecording(context, shop, "scene-selection");
  const price = await centerOf(shop.locator("#p3"));
  await glide(shop, price.box.x + 1, price.y, 900);
  await shop.waitForTimeout(250);
  await shop.mouse.down();
  await glide(shop, price.box.x + price.box.width - 1, price.y, 550);
  await shop.mouse.up();
  await shop.locator(".ccp-selection-popup").waitFor();
  // Leave the offer readable before the pointer covers it.
  await recording.holdUntil(SELECTION_CLICK_AT - 0.9);
  const bubble = await centerOf(shop.locator(".ccp-selection-popup"));
  await glide(shop, bubble.x, bubble.y, 650);
  await recording.holdUntil(SELECTION_CLICK_AT);
  await shop.mouse.down();
  await shop.mouse.up();
  await shop.locator('.ccp-selection-popup[data-state="success"]').waitFor();
  await shop.waitForTimeout(600);
  await glide(shop, bubble.x + 150, bubble.y - 60, 600);
  await recording.holdUntil(SELECTION_SCENE_SECONDS);
  const selectionScene = await recording.stop([{ still: stills.select, from: 0 }]);
  await shop.close();

  const segments = [
    cardSegment("card-intro", stills.intro, 2.2),
    pageScene,
    selectionScene,
    cardSegment("card-outro", stills.outro, 5.1)
  ];
  const list = join(WORK, "segments.txt");
  writeFileSync(list, segments.map((file) => `file '${file.replaceAll("\\", "/")}'`).join("\n"));
  const video = join(OUT, "twinprice-demo.mp4");
  ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", video]);
  console.log(`Wrote ${video}`);
} finally {
  await context.close();
}
