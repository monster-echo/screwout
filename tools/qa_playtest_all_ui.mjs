#!/usr/bin/env node
/**
 * Full Interactive Playtest & UI QA Capture for ScrewOut.
 * Drives every screen, popup, booster, theme switch, and win/paint flow with real clicks.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build', 'web-mobile');
const OUT_DIR = path.join(PROJECT_ROOT, 'store_assets', 'qa_playtest');
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

function startServer(rootDir) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
            if (urlPath === '/favicon.ico') {
                res.writeHead(204);
                res.end();
                return;
            }
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
    const { server, url } = await startServer(BUILD_DIR);
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
        defaultViewport: { width: 750, height: 1334, deviceScaleFactor: 1 },
    });

    const logs = [];
    const errors = [];
    try {
        const page = await browser.newPage();
        page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(`CONSOLE_ERR: ${msg.text()}`);
            else logs.push(msg.text());
        });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForFunction(() => Boolean(window.__SCREW_OUT__ && window.__SCREW_OUT__.ready), { timeout: 25000 });
        await sleep(800);

        // 1. Home Menu
        await page.screenshot({ path: path.join(OUT_DIR, '01_menu.png') });
        console.log('1. Captured 01_menu.png');

        // 2. Click Settings gear (top-left ~ x=65, y=67)
        await page.mouse.click(65, 67);
        await sleep(450);
        await page.screenshot({ path: path.join(OUT_DIR, '02_settings.png') });
        console.log('2. Captured 02_settings.png');
        // Toggle sound off & on, toggle haptics off & on
        await page.mouse.click(375, 571); // Sound
        await sleep(180);
        await page.mouse.click(375, 667); // Haptics
        await sleep(180);
        await page.mouse.click(375, 571); // Sound back on
        await page.mouse.click(375, 667); // Haptics back on
        await sleep(150);
        // Close Settings (x=375+226=601, y=667-236=431)
        await page.mouse.click(601, 431);
        await sleep(300);

        // 3. Click MY ART Gallery button (bottom-left ~ x=119, y=1161)
        await page.mouse.click(119, 1161);
        await sleep(450);
        await page.screenshot({ path: path.join(OUT_DIR, '04_gallery.png') });
        console.log('3. Captured 04_gallery.png');
        // Close Gallery (x=375+288=663, y=667-434=233)
        await page.mouse.click(663, 233);
        await sleep(300);

        // 4. Click PLAY CTA (bottom-right ~ x=437, y=1165)
        await page.mouse.click(437, 1165);
        await sleep(900);
        await page.screenshot({ path: path.join(OUT_DIR, '05_game_lv1.png') });
        console.log('4. Captured 05_game_lv1.png');

        // 5. Test Pause Popup (top-left ~ x=57, y=59)
        await page.mouse.click(57, 59);
        await sleep(400);
        await page.screenshot({ path: path.join(OUT_DIR, '06_pause.png') });
        console.log('5. Captured 06_pause.png');
        // Click RESUME (x=375, y=667-30=637)
        await page.mouse.click(375, 637);
        await sleep(350);

        // 7. Test MELT booster (bottom-right ~ x=608, y=1248) -> verify banner + CANCEL keeps count=1!
        await page.mouse.click(608, 1248);
        await sleep(350);
        await page.screenshot({ path: path.join(OUT_DIR, '07_melt_banner.png') });
        console.log('7. Captured 07_melt_banner.png');
        // Click CANCEL on SmashBanner (x=375+186=561, y=667-232=435)
        await page.mouse.click(561, 435);
        await sleep(350);

        // 8. Play Level 1 to WIN using real clicks (flipping Cocos Y -> DOM Y)!
        let won = false;
        for (let step = 0; step < 35; step++) {
            const st = await page.evaluate(() => window.__SCREW_OUT__.getState());
            if (st && st.status === 'WIN') {
                won = true;
                break;
            }
            const mv = await page.evaluate(() => window.__SCREW_OUT__.getBestMove());
            if (mv) {
                await page.mouse.click(mv.nx * 750, (1 - mv.ny) * 1334);
            }
            await sleep(320);
        }
        await sleep(1000);
        await page.screenshot({ path: path.join(OUT_DIR, '08_win_popup.png') });
        console.log(`8. Captured 08_win_popup.png (won=${won})`);

        // 9. Click COLLECT / PAINT CTA on Win Popup (center-bottom of card ~ x=375, y=905)
        await page.mouse.click(375, 905);
        await sleep(700);
        await page.screenshot({ path: path.join(OUT_DIR, '09_paint_layer.png') });
        console.log('9. Captured 09_paint_layer.png');

        // Hold down shoot button (x=375, y=1110) for 1.2s to verify shooting bolts into pixel art!
        await page.mouse.move(375, 1110);
        await page.mouse.down();
        await sleep(1200);
        await page.mouse.up();
        await sleep(500);
        await page.screenshot({ path: path.join(OUT_DIR, '10_paint_after_shoot.png') });
        console.log('10. Captured 10_paint_after_shoot.png');

        console.log(`Total JS/Console Errors: ${errors.length}`);
        if (errors.length) console.log(errors.join('\n'));
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
