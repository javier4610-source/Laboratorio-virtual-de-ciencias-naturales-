// Genera los iconos PNG de la aplicación instalable a partir del logo SVG.
// Uso: node scripts/make-icons.mjs   (requiere Chromium; ver PW_CHROMIUM_PATH)
import { chromium } from '@playwright/test';

const logo = (size, pad) => {
  const s = 34, inner = s - 2 * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${pad ? 0 : 8}" fill="#0b6762"/>
  <g transform="translate(${pad} ${pad}) scale(${inner / s})">
    <path d="M13 7h8M14.5 7v7.5L9 25.5Q8 28 11 28h12q3 0 2-2.5L19.5 14.5V7" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
    <path d="M10.6 22h12.8" stroke="#fff" stroke-width="2"/>
    <circle cx="15" cy="25" r="1.4" fill="#fff"/><circle cx="19.5" cy="24.4" r="1" fill="#fff"/>
  </g></svg>`;
};

const targets = [
  ['icon-192.png', 192, 0], ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 5], ['apple-touch-icon.png', 180, 3],
];
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const page = await browser.newPage();
for (const [name, size, pad] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${logo(size, pad)}`);
  await page.locator('svg').screenshot({ path: `public/icons/${name}`, omitBackground: true });
}
await browser.close();
console.log('Iconos generados en public/icons/');
