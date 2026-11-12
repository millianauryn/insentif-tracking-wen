// Pre-kompresi hasil build: tulis <file>.gz untuk aset yang dipaketkan, supaya server
// bisa mengirim gzip tanpa kompresi runtime (tunnel publik sangat lambat).
// shortcut: hanya gzip (brotol butuh dependensi); file .gz ikut ter-deploy bersama dist.
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const COMPRESSIBLE = new Set(['.js', '.css', '.json', '.svg', '.html', '.txt', '.map']);
const MIN_SIZE = 1024;

let count = 0;
let before = 0;
let after = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!COMPRESSIBLE.has(extname(entry.name))) continue;
    if (statSync(full).size < MIN_SIZE) continue;
    const raw = readFileSync(full);
    const gz = gzipSync(raw, { level: 9 });
    writeFileSync(full + '.gz', gz);
    count += 1;
    before += raw.length;
    after += gz.length;
  }
}

walk(DIST);
console.log(`precompress: ${count} berkas, ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB (rasio ${(before / after).toFixed(1)}x)`);
