#!/usr/bin/env node
/**
 * Captures real live gameplay screenshots from built ScrewOut (web-mobile)
 * for App Store & Google Play promotional screenshots AND verifies zero runtime errors.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build', 'web-mobile');
const OUT_DIR = path.join(PROJECT_ROOT, 'store_assets', 'raw_captures');
fs.mkdirSync(OUT_DIR, { recursive: true });

const require = createRequire(import.meta.url);
const puppeteer = require('/Users/echo/workspace/CocosGames/Liquid1024/node_modules/puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.wasm': 'application/wasm',
    '.atlas': 'text/plain; charset=utf-8',
};

function startStaticServer(rootDir) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
            const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
            const full = path.join(rootDir, rel);
            if (!full.startsWith(rootDir) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream' });
            fs.createReadStream(full).pipe(res);
        });
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            resolve({ server, url: `http://127.0.0.1:${addr.port}/` });
        });
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    const { server, url } = await startStaticServer(BUILD_DIR);
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
        defaultViewport: { width: 750, height: 1334, deviceScaleFactor: 1 },
    });

    const errors = [];
    try {
        const page = await browser.newPage();
        page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(`CONSOLE_ERR: ${msg.text()}`);
        });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForFunction(() => Boolean(window.__SCREW_OUT__ && window.__SCREW_OUT__.ready), { timeout: 25000 });
        await sleep(900);

        // 1. Home Menu (Sweet Dessert default!)
        await page.screenshot({ path: path.join(OUT_DIR, '01_menu_dessert.png') });
        console.log('Captured 01_menu_dessert.png');

        // 2. Theme Shop modal
        await page.evaluate(() => window.__SCREW_OUT__.openThemes());
        await sleep(500);
        await page.screenshot({ path: path.join(OUT_DIR, '02_theme_shop.png') });
        console.log('Captured 02_theme_shop.png');

        // 3. My Artworks Gallery modal
        await page.evaluate(() => window.__SCREW_OUT__.openGallery());
        await sleep(500);
        await page.screenshot({ path: path.join(OUT_DIR, '03_gallery.png') });
        console.log('Captured 03_gallery.png');

        // 4. Sweet Dessert Gameplay (Level 1 + a couple of real clicks so boxes fill!)
        await page.evaluate(() => {
            window.__SCREW_OUT__.setTheme('dessert');
            return window.__SCREW_OUT__.startLevel(1);
        });
        await sleep(900);
        for (let i = 0; i < 4; i++) {
            const mv = await page.evaluate(() => window.__SCREW_OUT__.getBestMove());
            if (!mv) break;
            await page.mouse.click(mv.nx * 750, mv.ny * 1334);
            await sleep(550);
        }
        await sleep(450);
        await page.screenshot({ path: path.join(OUT_DIR, '04_gameplay_dessert_lv1.png') });
        console.log('Captured 04_gameplay_dessert_lv1.png');

        // 5. Sweet Dessert Gameplay (Level 6 - rich multi-layer glazed boards)
        await page.evaluate(() => window.__SCREW_OUT__.startLevel(6));
        await sleep(900);
        for (let i = 0; i < 2; i++) {
            const mv = await page.evaluate(() => window.__SCREW_OUT__.getBestMove());
            if (!mv) break;
            await page.mouse.click(mv.nx * 750, (1 - mv.ny) * 1334);
            await sleep(500);
        }
        await sleep(450);
        await page.screenshot({ path: path.join(OUT_DIR, '05_gameplay_dessert_lv5.png') });
        console.log('Captured 05_gameplay_dessert_lv5.png (Level 6)');

        // 6. Wood & Acrylic Theme Gameplay (Level 10 - crystal high-clarity mode!)
        await page.evaluate(() => {
            window.__SCREW_OUT__.setTheme('acrylic');
            return window.__SCREW_OUT__.startLevel(10);
        });
        await sleep(900);
        await page.screenshot({ path: path.join(OUT_DIR, '06_gameplay_acrylic_lv10.png') });
        console.log('Captured 06_gameplay_acrylic_lv10.png');

        console.log(`Errors: ${errors.length}`);
        if (errors.length > 0) console.log(errors.join('\n'));
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
