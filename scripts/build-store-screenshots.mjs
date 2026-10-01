// Composes Chrome Web Store screenshots (1280x800) from captured product shots,
// one set per store language.
//
// Capture the source images first, then run this (or both at once with
// `npm run build:store-assets`):
//   npm run capture
//   node scripts/build-store-screenshots.mjs
//
// Each language names the capture set it shows (which currencies convert into
// which) and carries its own copy, which is meant to be edited. The tile order is
// the order the store shows them: the first tile carries the whole pitch, so it
// shows a converted page rather than a secondary feature.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "store/chrome/screenshots");
const WIDTH = 1280;
const HEIGHT = 800;

// Where tests/capture/screenshots.spec.js writes each currency pair.
const CAPTURES = {
  "usd-eur": resolve(ROOT, "screenshots"),
  "eur-pln": resolve(ROOT, "store/chrome/captures/eur-pln"),
  "usd-brl": resolve(ROOT, "store/chrome/captures/usd-brl")
};

const LAYOUT = [
  { file: "01-converted.png", source: "v2-inpage.png", shotWidth: 776 },
  { file: "02-one-click.png", source: "v2-inpage-prompt.png", shotWidth: 776 },
  { file: "03-live-rate.png", source: "v2-popup-light.png", shotWidth: 420 },
  { file: "04-select-price.png", source: "v2-inpage-selection-done.png", shotWidth: 776 }
];

// Copy per tile, in LAYOUT order: [kicker, headline, body]. The extension's own
// screens are English, so translated copy describes controls instead of quoting
// button labels the shopper will not see.
const LOCALES = {
  en: {
    captures: "usd-eur",
    copy: [
      ["Every price, in your currency", "See what it really costs",
        "Each price on the page gets its converted value right beside it. The original stays, so you see both."],
      ["Works where you shop", "One click converts the page",
        "When Twinprice spots prices, it offers to convert them and shows the rate first. Undo restores the page."],
      ["Private by design", "See the rate before you convert",
        "The exact rate, how fresh it is, and the last seven days. Only a currency code ever leaves your browser."],
      ["One price at a time", "Highlight a price to convert it",
        "Select any price and the converted amount appears right beside it. Nothing else on the page is touched."]
    ]
  },
  pl: {
    captures: "eur-pln",
    copy: [
      ["Każda cena w Twojej walucie", "Zobacz, ile to naprawdę kosztuje",
        "Obok każdej ceny na stronie pojawia się przeliczona kwota. Oryginał zostaje, więc widzisz obie."],
      ["Działa tam, gdzie kupujesz", "Jedno kliknięcie przelicza stronę",
        "Gdy Twinprice znajdzie ceny, proponuje przeliczenie i najpierw pokazuje kurs. Jednym kliknięciem cofniesz zmiany."],
      ["Prywatność w standardzie", "Zobacz kurs przed przeliczeniem",
        "Dokładny kurs, jego aktualność i ostatnie siedem dni. Z przeglądarki wychodzi tylko kod waluty."],
      ["Jedna cena naraz", "Zaznacz cenę, by ją przeliczyć",
        "Zaznacz dowolną cenę, a przeliczona kwota pojawi się tuż obok. Reszta strony zostaje bez zmian."]
    ]
  },
  de: {
    captures: "usd-eur",
    copy: [
      ["Jeder Preis in deiner Währung", "Sieh, was es wirklich kostet",
        "Neben jedem Preis auf der Seite steht der umgerechnete Betrag. Das Original bleibt, du siehst beides."],
      ["Funktioniert, wo du einkaufst", "Ein Klick rechnet die Seite um",
        "Findet Twinprice Preise, bietet es die Umrechnung an und zeigt vorher den Kurs. Mit einem Klick ist alles wieder wie vorher."],
      ["Privat von Anfang an", "Erst den Kurs sehen, dann umrechnen",
        "Der genaue Kurs, wie aktuell er ist, und die letzten sieben Tage. Nur ein Währungscode verlässt deinen Browser."],
      ["Ein Preis nach dem anderen", "Preis markieren und umrechnen",
        "Markiere einen Preis, und der umgerechnete Betrag erscheint direkt daneben. Der Rest der Seite bleibt unverändert."]
    ]
  },
  es: {
    captures: "usd-eur",
    copy: [
      ["Cada precio, en tu moneda", "Mira lo que cuesta de verdad",
        "Junto a cada precio de la página aparece su importe convertido. El original se queda, así ves los dos."],
      ["Funciona donde compras", "Un clic convierte la página",
        "Cuando Twinprice detecta precios, te ofrece convertirlos y antes te muestra el tipo de cambio. Y lo deshaces con un clic."],
      ["Privado por diseño", "Mira el tipo antes de convertir",
        "El tipo exacto, lo reciente que es y los últimos siete días. Solo un código de moneda sale de tu navegador."],
      ["Un precio cada vez", "Selecciona un precio para convertirlo",
        "Selecciona cualquier precio y el importe convertido aparece justo al lado. El resto de la página no cambia."]
    ]
  },
  fr: {
    captures: "usd-eur",
    copy: [
      ["Chaque prix, dans votre devise", "Voyez ce que ça coûte vraiment",
        "À côté de chaque prix de la page s’affiche son montant converti. L’original reste, vous voyez les deux."],
      ["Là où vous faites vos achats", "Un clic convertit la page",
        "Quand Twinprice repère des prix, il propose de les convertir et affiche d’abord le taux. Un clic suffit pour tout annuler."],
      ["Privé par conception", "Voyez le taux avant de convertir",
        "Le taux exact, sa fraîcheur et les sept derniers jours. Seul un code de devise quitte votre navigateur."],
      ["Un prix à la fois", "Sélectionnez un prix pour le convertir",
        "Sélectionnez un prix : le montant converti s’affiche juste à côté. Le reste de la page ne change pas."]
    ]
  },
  pt_BR: {
    captures: "usd-brl",
    copy: [
      ["Cada preço na sua moeda", "Veja quanto custa de verdade",
        "Ao lado de cada preço da página aparece o valor convertido. O original continua lá, então você vê os dois."],
      ["Funciona onde você compra", "Um clique converte a página",
        "Quando o Twinprice encontra preços, ele oferece a conversão e mostra a cotação antes. Dá para desfazer com um clique."],
      ["Privado desde o início", "Veja a cotação antes de converter",
        "A cotação exata, quão recente ela é e os últimos sete dias. Só um código de moeda sai do seu navegador."],
      ["Um preço de cada vez", "Selecione um preço para convertê-lo",
        "Selecione qualquer preço e o valor convertido aparece logo ao lado. O resto da página não muda."]
    ]
  }
};

function dataUri(directory, file) {
  const path = resolve(directory, file);
  if (!existsSync(path)) return null;
  return `data:image/png;base64,${readFileSync(path).toString("base64")}`;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function tileMarkup(lang, tile, [kicker, headline, body], image) {
  return `<!doctype html><html lang="${lang.replace("_", "-")}"><head><style>
  @font-face { font-family: x; src: local("Segoe UI"); }
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; display: grid;
    grid-template-columns: 340px 1fr; align-items: center; gap: 44px;
    padding: 0 60px;
    background: linear-gradient(152deg, #16327e 0%, #1b3fbf 58%, #2350d8 100%);
    color: #fff;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  }
  .kicker {
    font-size: 17px; font-weight: 600; letter-spacing: .12em;
    text-transform: uppercase; color: #a9bef5; margin-bottom: 22px;
  }
  h1 {
    font-size: 48px; line-height: 1.08; letter-spacing: -.025em;
    font-weight: 700; margin-bottom: 26px; text-wrap: balance; hyphens: manual;
  }
  p { font-size: 21px; line-height: 1.5; color: #d5e0fb; }
  .stage { display: flex; justify-content: center; align-items: center; }
  img {
    width: ${tile.shotWidth}px; height: auto; display: block;
    border-radius: 10px;
    box-shadow: 0 40px 80px -24px rgba(6, 12, 32, .65), 0 6px 18px rgba(6, 12, 32, .3);
  }
  .missing {
    width: ${tile.shotWidth}px; height: 420px; display: grid; place-items: center;
    border: 2px dashed #a9bef5; border-radius: 10px; color: #a9bef5; font-size: 20px;
  }
</style></head><body>
<div class="copy">
  <div class="kicker">${escapeHtml(kicker)}</div>
  <h1>${escapeHtml(headline)}</h1>
  <p>${escapeHtml(body)}</p>
</div>
<div class="stage">
  ${image ? `<img src="${image}" alt="">` : `<div class="missing">${tile.source} not captured</div>`}
</div>
</body></html>`;
}

// Longer languages get the same layout at a slightly smaller size instead of a
// headline that runs to five lines or a word that overflows its column.
async function fitCopy(page) {
  return page.evaluate(() => {
    const column = document.querySelector(".copy");
    const heading = document.querySelector("h1");
    const body = document.querySelector("p");
    const overflows = (node) => node.scrollWidth > column.clientWidth + 1;
    let size = 48;
    while (size > 34 && (heading.offsetHeight > size * 1.08 * 3 + 2 || overflows(heading))) {
      size -= 2;
      heading.style.fontSize = `${size}px`;
    }
    let bodySize = 21;
    while (bodySize > 17 && column.offsetHeight > 560) {
      bodySize -= 1;
      body.style.fontSize = `${bodySize}px`;
    }
    return { size, bodySize, height: column.offsetHeight, overflow: overflows(heading) || overflows(body) };
  });
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  for (const [lang, locale] of Object.entries(LOCALES)) {
    const outDir = resolve(OUT, lang);
    mkdirSync(outDir, { recursive: true });
    for (const [index, tile] of LAYOUT.entries()) {
      const image = dataUri(CAPTURES[locale.captures], tile.source);
      if (!image) console.warn(`! ${locale.captures}/${tile.source} is missing — rendering a placeholder.`);
      await page.setContent(tileMarkup(lang, tile, locale.copy[index], image));
      await page.waitForTimeout(120);
      const fit = await fitCopy(page);
      if (fit.overflow) console.warn(`! ${lang}/${tile.file}: copy still overflows its column.`);
      const png = await page.screenshot({ clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
      writeFileSync(resolve(outDir, tile.file), png);
      console.log(`wrote ${lang}/${tile.file} (${(png.length / 1024).toFixed(0)}KB, headline ${fit.size}px)`);
    }
  }
} finally {
  await browser.close();
}
