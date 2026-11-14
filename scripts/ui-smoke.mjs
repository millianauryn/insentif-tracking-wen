// UI smoke check via raw CDP — replacement for the browser MCP tool.
// Launches headless Opera with a debug port, dev-logs in, opens the URL,
// and reports render state + console errors.
//
// Usage:  node scripts/ui-smoke.mjs [url]
//   1. start Vite (client) + API (server) first
//   2. node scripts/ui-smoke.mjs http://localhost:5173/documents/sales
//
// Requires: Opera GX at the default install path (override with OPERA_EXE).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_TO_CHECK = process.argv[2] || 'http://localhost:5173/dashboard';
const OPERA_EXE =
  process.env.OPERA_EXE || 'C:\\Users\\pbj\\AppData\\Local\\Programs\\Opera GX\\opera.exe';
const DEBUG_PORT = 9333;
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
  const profile = mkdtempSync(join(tmpdir(), 'ui-smoke-'));
  const opera = spawn(OPERA_EXE, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
  ], { stdio: 'ignore' });

  try {
    // wait for the debug port
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

    // fresh tab (Opera opens GX Corner on start)
    const page = await (await fetch(`${DEBUG}/json/new?about:blank`, { method: 'PUT' })).json();
    if (!page?.webSocketDebuggerUrl) throw new Error('could not create tab');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const logs = [];
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
      if (m.method === 'Runtime.consoleAPICalled') {
        const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
        logs.push({ type: m.params.type, text });
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        logs.push({ type: 'exception', text: `${d.text} ${d.exception?.description || ''}` });
      }
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        logs.push({ type: 'log.error', text: `${m.params.entry.text} ${m.params.entry.url || ''}` });
      }
    };
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.enable');
    await send('Network.setCookie', {
      url: APP_ORIGIN,
      name: 'session_token',
      value: token,
      httpOnly: true,
      sameSite: 'Lax',
    });
    await send('Page.navigate', { url: URL_TO_CHECK });
    await sleep(8000);

    const ev = await send('Runtime.evaluate', {
      expression: `({ rootLen: document.getElementById('root') ? document.getElementById('root').innerHTML.length : -1, text: document.body.innerText.replace(/\\n+/g, ' | ').slice(0, 500) })`,
      returnByValue: true,
    });
    const state = ev.result?.result?.value || {};
    const errors = logs.filter((l) => l.type === 'error' || l.type === 'exception' || l.type === 'log.error');

    console.log('URL:', URL_TO_CHECK);
    console.log('rootLen:', state.rootLen);
    console.log('body:', state.text);
    console.log('errors:', errors.length);
    errors.forEach((e) => console.log(`  [${e.type}] ${e.text.slice(0, 600)}`));
    ws.close();

    const blank = state.rootLen <= 0;
    if (blank || errors.length) process.exit(1);
    console.log('SMOKE OK');
    process.exit(0);
  } finally {
    opera.kill();
    await sleep(500);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* profile dir may still be locked briefly */
    }
  }
}

main().catch((e) => {
  console.error('SMOKE FATAL:', e.message || e);
  process.exit(1);
});
