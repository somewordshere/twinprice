// Render the share card from local text and the shipped icon; no external requests.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const icon = (await readFile(new URL('./dist/assets/twinprice-icon.png', import.meta.url))).toString('base64');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Twinprice share card</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f4f7ff;color:#142038;font-family:"Segoe UI",Arial,sans-serif}
    main{width:1200px;height:630px;padding:60px 72px;position:relative;overflow:hidden;border-top:12px solid #245bea}
    .brand{display:flex;align-items:center;gap:16px;font-size:34px;font-weight:750;letter-spacing:-1px}.brand img{width:48px;height:48px}
    h1{font-size:76px;line-height:1.09;letter-spacing:-3px;margin:48px 0 25px;font-weight:750}h1 span{color:#245bea}
    p{font-size:25px;line-height:1.5;margin:0;color:#425578}.browsers{position:absolute;bottom:56px;right:72px;font-size:18px;font-weight:650;border:1px solid #b9c9ef;border-radius:30px;padding:12px 24px;background:white}
  </style><main><div class="brand"><img src="data:image/png;base64,${icon}" alt="">twinprice.com</div><h1>Shop abroad.<br>See prices in<br><span>your currency.</span></h1><p>A free currency converter extension.</p><div class="browsers">Chrome &amp; Firefox</div></main></html>`);
  await page.screenshot({ path: fileURLToPath(new URL('./dist/assets/social-preview.png', import.meta.url)) });
} finally { await browser.close(); }
console.log('Rendered social-preview.png (1200 × 630).');
