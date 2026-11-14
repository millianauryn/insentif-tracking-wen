import { readFileSync, writeFileSync } from 'node:fs';

// Converts only <button> elements whose opening tag carries className="button..."
// into shadcn <Button>. Attr group cannot cross a plain '>' (only '=>'),
// so nested/other buttons (icon-button, text-button, icon-action) are untouched.
const re = /<button((?:(?:=>)|[^>])*?className="button[^"]*"(?:(?:=>)|[^>])*?)>([\s\S]*?)<\/button>/g;

for (const p of ['src/pages/Master.jsx', 'src/pages/Documents.jsx']) {
  const s = readFileSync(p, 'utf8');
  let n = 0;
  const out = s.replace(re, (m, attrs, body) => {
    n += 1;
    return '<Button' + attrs + '>' + body + '</Button>';
  });
  writeFileSync(p, out);
  console.log(p, 'converted', n);
}
