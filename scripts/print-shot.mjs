// Print-media screenshot: loads a URL with a dev session, emulates print CSS,
// and saves a PNG so the paper format can be eyeballed.
// Usage: node scripts/print-shot.mjs <url> <out.png>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_TO_CHECK = process.argv[2] || 'http://localhost:5173/documents/sales';
const OUT = process.argv[3] || 'print-shot.png';
const OPERA_EXE =
  process.env.OPERA_EXE || 'C:\\Users\\pbj\\AppData\\Local\\Programs\\Opera GX\\opera.exe';
const DEBUG_PORT = 9337;
const DEBUG = `http://127.0.0.1:${DEBUG_PORT}`;
const APP_ORIGIN = new URL(URL_TO_CHECK).origin;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function devLogin() {
  const res = await fetch('http://localhost:3002/api/auth/dev-login?user=super', { method: 'POST' });
  const token = /session_token=([^;]+)/.exec(res.headers.get('set-cookie') || '')?.[1];
  if (!token) throw new Error(`dev-login failed: ${res.status}`);
  return token;
}

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'print-shot-'));
  const opera = spawn(OPERA_EXE, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
  ], { stdio: 'ignore' });

  try {
    let targets = null;
    for (let i = 0; i < 30 && !targets; i++) {
      await sleep(500);
      try {
        const r = await fetch(`${DEBUG}/json/list`);
        if (r.ok) targets = await r.json();
      } catch { /* not up yet */ }
    }
    if (!targets) throw new Error('CDP debug port never came up');

    const token = await devLogin();
    const page = await (await fetch(`${DEBUG}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const i = ++id;
        pending.set(i, { resolve, reject });
        ws.send(JSON.stringify({ id: i, method, params }));
      });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        pending.get(m.id).resolve(m);
        pending.delete(m.id);
      }
    };
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

    await send('Page.enable');
    await send('Network.enable');
    await send('Network.setCookie', {
      url: APP_ORIGIN, name: 'session_token', value: token, httpOnly: true, sameSite: 'Lax',
    });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 794, height: 1123, deviceScaleFactor: 1, mobile: false,
    });
    await send('Page.navigate', { url: URL_TO_CHECK });
    await sleep(8000);
    await send('Emulation.setEmulatedMedia', { media: 'print' });
    await sleep(1000);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const { writeFileSync } = await import('node:fs');
    writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
    console.log('WROTE', OUT);
    ws.close();
    process.exit(0);
  } finally {
    opera.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ }
  }
}

main().catch((e) => { console.error('FATAL:', e.message || e); process.exit(1); });
