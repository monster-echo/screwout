#!/usr/bin/env node
/**
 * ScrewOut 真人规则自动玩脚本 (1 ~ 101 关)
 * - 严格遵守游戏规则：只用初始 2 个收纳盒 + 5 个暂存孔，不作弊复活、不偷偷解锁盒子或清槽
 * - 通过真实浏览器鼠标事件 page.mouse.click(x, y) 点击屏幕上的螺丝，走完整触摸与遮挡判定
 *
 * 用法：
 *   node tools/autoplay_all_levels.mjs --headed              # 显示窗口观看真人节奏自动玩 1~101 关
 *   node tools/autoplay_all_levels.mjs --from 1 --to 10      # 无头跑第 1~10 关
 *   node tools/autoplay_all_levels.mjs --interval 450        # 每次点击间隔 450ms（默认）
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build', 'web-mobile');
const REPORT_PATH = path.join(__dirname, 'autoplay_report.json');

const require = createRequire(import.meta.url);
const puppeteer = require('/Users/echo/workspace/CocosGames/Liquid1024/node_modules/puppeteer-core');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function parseArgs(argv) {
    const opts = {
        from: 1,
        to: 101,
        headed: false,
        interval: 450,
        timeoutSec: 180,
        url: '',
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--from' && argv[i + 1]) opts.from = Math.max(1, Number(argv[++i]));
        else if (a === '--to' && argv[i + 1]) opts.to = Math.min(101, Number(argv[++i]));
        else if (a === '--headed') opts.headed = true;
        else if (a === '--interval' && argv[i + 1]) opts.interval = Math.max(120, Number(argv[++i]));
        else if (a === '--timeout' && argv[i + 1]) opts.timeoutSec = Math.max(20, Number(argv[++i]));
        else if (a === '--url' && argv[i + 1]) opts.url = argv[++i];
    }
    return opts;
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.wasm': 'application/wasm',
    '.atlas': 'text/plain; charset=utf-8',
};

function startStaticServer(rootDir) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
            const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
            const full = path.join(rootDir, rel);
            if (!full.startsWith(rootDir) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }
            const ext = path.extname(full).toLowerCase();
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
            fs.createReadStream(full).pipe(res);
        });
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            resolve({ server, url: `http://127.0.0.1:${addr.port}/` });
        });
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runLevel(page, lv, opts) {
    const t0 = Date.now();
    let clicks = 0;
    const errors = [];

    const onPageErr = (e) => errors.push(String(e));
    const onConsole = (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
    };
    page.on('pageerror', onPageErr);
    page.on('console', onConsole);

    try {
        await page.evaluate((levelNum) => window.__SCREW_OUT__.startLevel(levelNum), lv);
        // Wait for boards fade-in & physics activation
        await sleep(750);

        const canvasRect = await page.evaluate(() => {
            const c = document.querySelector('canvas');
            if (!c) return null;
            const r = c.getBoundingClientRect();
            return { left: r.left, top: r.top, width: r.width, height: r.height };
        });
        if (!canvasRect) {
            return { level: lv, result: 'ERROR', clicks: 0, sec: 0, progress: 0, errors: ['No canvas'] };
        }

        while (true) {
            const elapsedSec = (Date.now() - t0) / 1000;
            if (elapsedSec > opts.timeoutSec) {
                const st = await page.evaluate(() => window.__SCREW_OUT__.getState());
                return { level: lv, result: 'TIMEOUT', clicks, sec: Number(elapsedSec.toFixed(1)), progress: st.progress, errors };
            }

            const state = await page.evaluate(() => window.__SCREW_OUT__.getState());
            if (state.status === 'WIN') {
                if (opts.headed) await sleep(1200);
                return { level: lv, result: 'PASS', clicks, sec: Number(elapsedSec.toFixed(1)), progress: 100, errors };
            }
            if (state.status === 'LOSE') {
                if (opts.headed) await sleep(1500);
                return { level: lv, result: 'FAIL', clicks, sec: Number(elapsedSec.toFixed(1)), progress: state.progress, errors };
            }

            const move = await page.evaluate(() => window.__SCREW_OUT__.getBestMove());
            if (move) {
                // Convert normalized Cocos UI coord (bottom-left origin) to browser viewport pixel (top-left origin)
                const clickX = canvasRect.left + move.nx * canvasRect.width;
                const clickY = canvasRect.top + (1 - move.ny) * canvasRect.height;
                await page.mouse.click(clickX, clickY);
                clicks++;
            }

            await sleep(opts.interval);
        }
    } finally {
        page.off('pageerror', onPageErr);
        page.off('console', onConsole);
    }
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(path.join(BUILD_DIR, 'index.html'))) {
        console.error('未找到 build/web-mobile/index.html，请先构建 Cocos web-mobile 工程。');
        process.exit(1);
    }

    let serverObj = null;
    let url = opts.url;
    if (!url) {
        serverObj = await startStaticServer(BUILD_DIR);
        url = serverObj.url;
    }

    console.log(`[AutoPlay] 真人规则模式（严格 2 盒 + 5 孔，不复活/不白嫖道具，真实鼠标点击）`);
    console.log(`[AutoPlay] 目标: 第 ${opts.from} 关 ~ 第 ${opts.to} 关 | 模式: ${opts.headed ? '可视窗口' : '无头模式'} | 间隔: ${opts.interval}ms`);

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: opts.headed ? false : 'new',
        defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=410,900', '--autoplay-policy=no-user-gesture-required'],
    });

    const results = [];
    const totalStart = Date.now();

    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => Boolean(window.__SCREW_OUT__ && window.__SCREW_OUT__.ready), { timeout: 30000 });
        console.log('[AutoPlay] 游戏引擎就绪，开始真实点击闯关...\n');

        for (let lv = opts.from; lv <= opts.to; lv++) {
            const r = await runLevel(page, lv, opts);
            results.push(r);
            const errNote = r.errors.length ? ` | errors=${r.errors.length}` : '';
            console.log(
                `[Lv ${String(lv).padStart(3, ' ')}] ${r.result.padEnd(7)} | 进度 ${String(r.progress).padStart(3)}% | 真实点击 ${String(r.clicks).padStart(3)} | ${r.sec}s${errNote}`,
            );
        }
    } finally {
        await browser.close();
        if (serverObj) serverObj.server.close();
    }

    const passed = results.filter((r) => r.result === 'PASS').length;
    const failed = results.filter((r) => r.result !== 'PASS').length;
    const totalSec = Number(((Date.now() - totalStart) / 1000).toFixed(1));
    const report = {
        timestamp: new Date().toISOString(),
        mode: 'strict-human-mouse',
        range: [opts.from, opts.to],
        total: results.length,
        passed,
        failed,
        totalSec,
        results,
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

    console.log('\n========================================');
    console.log(`完成: ${passed}/${results.length} 通过, ${failed} 失败/超时, 总耗时 ${totalSec}s`);
    console.log(`详细报告已保存: ${REPORT_PATH}`);
    console.log('========================================');
}

main().catch((err) => {
    console.error('[AutoPlay] Fatal error:', err);
    process.exit(1);
});
