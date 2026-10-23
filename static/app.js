'use strict';
/* Nspire Studio front end. Layout constants mirror runtime.lua so the
   viewer shows what the calculator will draw. */

const W = 318, H = 212, TABH = 18, PAD = 4, SBW = 3, CW = W - 2 * PAD - SBW;
const FONT_PX = { 7: 9, 9: 11, 10: 13, 11: 14, 12: 15, 16: 20, 24: 30 };
const SIZES = [7, 9, 10, 11, 12, 16, 24];
// gc:getStringHeight() measured on a CX II (OS 6.3): taller than the glyphs themselves
const LINE_H = { 7: 14, 9: 17, 10: 19, 11: 21, 12: 21, 16: 27, 24: 39 };

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k instanceof Node ? k : document.createTextNode(k));
  return el;
}

function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (err ? ' err' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.add('hidden'), err ? 6000 : 3000);
}

async function api(path, opts = {}) {
  const o = { method: opts.body !== undefined ? 'POST' : 'GET', headers: {} };
  if (opts.body !== undefined) {
    if (opts.raw) o.body = opts.body;
    else { o.body = JSON.stringify(opts.body); o.headers['Content-Type'] = 'application/json'; }
  }
  if (opts.method) o.method = opts.method;
  const r = await fetch('/api/' + path, o);
  if (opts.blob) {
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.error || r.statusText), j); }
    return r.blob();
  }
  const j = await r.json().catch(() => ({ ok: false, error: r.statusText }));
  if (!r.ok || j.ok === false) throw Object.assign(new Error(j.error || r.statusText), j, { status: r.status });
  return j;
}

/* ------------------------------------------------------------ document model */
const DEFAULTS = {
  heading: () => ({ text: 'Heading', size: 12, align: 'left', color: '' }),
  text: () => ({ text: '', size: 10, style: 'r', align: 'left', color: '' }),
  equation: () => ({ latex: 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}', size: 15, align: 'center', color: '#111111' }),
  image: () => ({ src: '', width: CW, align: 'center' }),
  graph: () => ({ fns: [{ expr: 'x^2', color: '#1060d0' }], xmin: -10, xmax: 10, ymin: -10, ymax: 10, gx: 1, gy: 1, grid: true, h: 120 }),
  input: () => ({ label: 'Mass', var: 'm', value: '1', unit: 'kg' }),
  output: () => ({ label: 'Result', expr: 'm*9.81', var: '', unit: '', digits: '3', exact: false }),
  divider: () => ({}),
  spacer: () => ({ h: 8 }),
};
const TYPE_NAMES = { heading: 'Heading', text: 'Text', equation: 'Equation', image: 'Image', graph: 'Graph', input: 'Input', output: 'Output', divider: 'Divider', spacer: 'Space' };

function newItem(type) { return { id: uid(), type, ...DEFAULTS[type]() }; }

function sampleDoc() {
  const it = (type, o) => ({ ...newItem(type), ...o });
  return {
    id: uid(), title: 'Physics notes', angle: 'rad',
    theme: { bg: '#ffffff', fg: '#111111', accent: '#2a6fdb', tabbg: '#2b3442', tabfg: '#c9d2de' },
    send: { folder: '/Notes', name: 'physics' },
    tabs: [
      { id: uid(), name: 'Notes', items: [
        it('heading', { text: 'Kinematics' }),
        it('text', { text: 'Constant acceleration. Use the Calc tab to solve for final speed and distance.' }),
        it('equation', { latex: 'v = v_0 + at', size: 15 }),
        it('equation', { latex: 'x = v_0 t + \\tfrac{1}{2}at^2', size: 15 }),
        it('divider', {}),
        it('heading', { text: 'Quadratic formula', size: 11 }),
        it('equation', {}),
      ] },
      { id: uid(), name: 'Calc', items: [
        it('heading', { text: 'Motion solver', size: 11 }),
        it('input', { label: 'v0', var: 'v0', value: '2', unit: 'm/s' }),
        it('input', { label: 'a', var: 'acc', value: '3', unit: 'm/s²' }),
        it('input', { label: 't', var: 'tt', value: '4', unit: 's' }),
        it('divider', {}),
        it('output', { label: 'v', expr: 'v0+acc*tt', var: 'vf', unit: 'm/s', digits: '3' }),
        it('output', { label: 'x', expr: 'v0*tt+acc*tt^2/2', unit: 'm', digits: '3' }),
        it('output', { label: 'KE/m', expr: 'vf^2/2', unit: 'J/kg', digits: '2' }),
      ] },
      { id: uid(), name: 'Graph', items: [
        it('text', { text: 'Position vs time for the values on Calc', size: 9 }),
        it('graph', { fns: [{ expr: 'v0*x+acc*x^2/2', color: '#1060d0' }, { expr: 'v0+acc*x', color: '#d0402a' }], xmin: 0, xmax: 6, ymin: -5, ymax: 60, gx: 1, gy: 10, h: 150 }),
      ] },
    ],
  };
}

let doc = null;
let editTab = 0;          // tab shown in the editor
let selItem = null;       // selected item id
let projects = [];

/* ------------------------------------------------------------ math (preview) */
function tiToJs(expr) {
  return String(expr ?? '')
    .replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/·|×/g, '*').replace(/÷/g, '/')
    .replace(/−/g, '-').replace(/ℯ/g, 'e').replace(/\*\*/g, '^');
}
function mathScope(deg) {
  const r = deg ? Math.PI / 180 : 1;
  return {
    ln: x => Math.log(x),
    log: (x, b) => b === undefined ? Math.log10(x) : Math.log(x) / Math.log(b),
    sin: x => Math.sin(x * r), cos: x => Math.cos(x * r), tan: x => Math.tan(x * r),
    arcsin: x => Math.asin(x) / r, arccos: x => Math.acos(x) / r, arctan: x => Math.atan(x) / r,
    asin: x => Math.asin(x) / r, acos: x => Math.acos(x) / r, atan: x => Math.atan(x) / r,
    approx: x => x, root: (x, n) => Math.pow(x, 1 / n),
  };
}
const compiled = new Map();
function compile(expr) {
  const k = tiToJs(expr);
  if (!compiled.has(k)) {
    try { compiled.set(k, window.math.compile(k)); } catch (e) { compiled.set(k, e); }
  }
  return compiled.get(k);
}
function evalNum(expr, scope) {
  const c = compile(expr);
  if (c instanceof Error) throw c;
  let v = c.evaluate(scope);
  if (v && typeof v === 'object' && 're' in v) { if (Math.abs(v.im) > 1e-12) throw new Error('complex'); v = v.re; }
  if (typeof v !== 'number') v = Number(v);
  return v;
}
function fmtNum(v, digits) {
  if (!isFinite(v)) return 'undef';
  if (digits !== '' && digits != null && !isNaN(parseInt(digits))) {
    const d = parseInt(digits);
    const m = Math.pow(10, d);
    v = Math.round(v * m) / m;
  }
  let s = window.math.format(v, { precision: 12 });
  if (/e/.test(s)) s = s.replace('e+', 'ᴇ').replace('e', 'ᴇ');
  else if (!s.includes('.')) s += '.';
  return s.replace(/^-/, '−');
}

/* ------------------------------------------------------------ rasters (equations / images) */
const rasterCache = new Map();   // key -> {canvas, url, w, h, shrunk} | Promise
function rasterKey(item) {
  return item.type === 'equation'
    ? `eq|${item.latex}|${item.size}|${item.color}|${doc.theme.bg}`
    : `img|${item.src.length}|${item.src.slice(-64)}|${item.width}|${doc.theme.bg}`;
}
function getRaster(item) {
  if (item.type === 'image' && !item.src) return null;
  if (item.type === 'equation' && !item.latex.trim()) return null;
  const k = rasterKey(item);
  const r = rasterCache.get(k);
  if (r && !(r instanceof Promise)) return r;
  if (!r) {
    const p = (item.type === 'equation' ? renderEquation(item) : renderImage(item))
      .then(res => { rasterCache.set(k, res); scheduleViewer(); return res; })
      .catch(err => { const res = { error: err.message || String(err) }; rasterCache.set(k, res); scheduleViewer(); return res; });
    rasterCache.set(k, p);
  }
  return null;
}
async function waitRaster(item) {
  getRaster(item);
  const r = rasterCache.get(rasterKey(item));
  return r instanceof Promise ? await r : r;
}

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image failed to load')); i.src = src; });
}

async function renderEquation(item) {
  await mathReady();
  const node = MathJax.tex2svg(item.latex, { display: true });
  const svg = node.querySelector('svg');
  const err = node.querySelector('[data-mjx-error]');
  if (err) throw new Error(err.getAttribute('data-mjx-error'));
  const px = item.size || 15;          // font size in calculator pixels
  const exPx = px * 0.431;
  let w = parseFloat(svg.getAttribute('width')) * exPx;
  let hh = parseFloat(svg.getAttribute('height')) * exPx;
  let scale = 1, shrunk = false;
  if (w + 4 > CW) { scale = (CW - 4) / w; shrunk = true; }
  w = Math.ceil(w * scale) + 4; hh = Math.ceil(hh * scale) + 4;
  svg.setAttribute('width', (w - 4) + 'px');
  svg.setAttribute('height', (hh - 4) + 'px');
  svg.setAttribute('color', item.color || '#111111');
  svg.style.color = item.color || '#111111';
  const xml = new XMLSerializer().serializeToString(svg).replace(/currentColor/g, item.color || '#111111');
  const img = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml));
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  const g = c.getContext('2d');
  g.fillStyle = doc.theme.bg; g.fillRect(0, 0, w, hh);
  g.drawImage(img, 2, 2, w - 4, hh - 4);
  return { canvas: c, url: c.toDataURL('image/png'), w, h: hh, shrunk };
}

async function renderImage(item) {
  const img = await loadImg(item.src);
  const w = Math.max(8, Math.min(CW, Math.round(item.width || CW)));
  const hh = Math.max(1, Math.round(img.height * w / img.width));
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  const g = c.getContext('2d');
  g.fillStyle = doc.theme.bg; g.fillRect(0, 0, w, hh);
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, w, hh);
  // quantise to RGB555 so the preview matches the calculator
  const d = g.getImageData(0, 0, w, hh);
  for (let i = 0; i < d.data.length; i += 4) for (let k = 0; k < 3; k++) d.data[i + k] = (d.data[i + k] & 0xf8) | (d.data[i + k] >> 5);
  g.putImageData(d, 0, 0);
  return { canvas: c, url: c.toDataURL('image/png'), w, h: hh, shrunk: false };
}

function mathReady() {
  return new Promise(res => {
    const check = () => (window.MathJax && MathJax.tex2svg) ? (MathJax.startup?.promise || Promise.resolve()).then(res) : setTimeout(check, 50);
    check();
  });
}

/* ------------------------------------------------------------ viewer (simulated calculator) */
const screen = $('#screen');
const sg = screen.getContext('2d');
const sim = { tab: 0, scroll: [], focus: null, values: {}, layout: [], contentH: [], results: {}, graphs: {} };
let zoom = 2;
let hoverItem = null;

function simValue(item) { return item.id in sim.values ? sim.values[item.id] : item.value; }

function font(style, size) {
  const px = FONT_PX[size] || 13;
  const b = style && style.includes('b') ? 'bold ' : '';
  const i = style && style.includes('i') ? 'italic ' : '';
  sg.font = `${i}${b}${px}px Arial, Helvetica, sans-serif`;
  return LINE_H[size] || Math.round(px * 1.45);   // line height, like getStringHeight
}
const sw = s => sg.measureText(s).width;

function wrap(text, maxw) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (let word of para.split(/\s+/).filter(Boolean)) {
      const tryL = line ? line + ' ' + word : word;
      if (sw(tryL) <= maxw) { line = tryL; continue; }
      if (line) lines.push(line);
      while (sw(word) > maxw && word.length > 1) {
        let k = word.length;
        while (k > 1 && sw(word.slice(0, k)) > maxw) k--;
        lines.push(word.slice(0, k)); word = word.slice(k);
      }
      line = word;
    }
    lines.push(line);
  }
  return lines;
}

function itemHeight(e, entry) {
  switch (e.type) {
    case 'heading': case 'text': {
      const lh = font(e.type === 'heading' ? 'b' : e.style, e.size);
      entry.lines = wrap(e.text || '', CW); entry.lh = lh;
      return entry.lines.length * lh + (e.type === 'heading' ? 2 : 0);
    }
    case 'equation': case 'image': {
      const r = getRaster(e);
      if (r && r.canvas) return r.h;
      return e.type === 'equation' ? (r && r.error ? 14 : 24) : (e.src ? 40 : 0);
    }
    case 'graph': return +e.h || 120;
    case 'input': case 'output': return font('r', 10) + 4;
    case 'divider': return 5;
    case 'spacer': return +e.h || 8;
  }
  return 0;
}

function measure(t) {
  let y = PAD; const L = [];
  for (const e of doc.tabs[t].items) {
    const en = { y, id: e.id };
    en.h = itemHeight(e, en);
    L.push(en);
    y += en.h + (e.type === 'spacer' ? 0 : 3);
  }
  sim.layout[t] = L; sim.contentH[t] = y + PAD;
}

function recompute() {
  const deg = doc.angle === 'deg';
  const scope = mathScope(deg);
  sim.results = {}; sim.graphs = {};
  for (const tab of doc.tabs) for (const e of tab.items) {
    if (e.type !== 'input' || !e.var.trim()) continue;
    const v = simValue(e);
    if (v === '' || v == null) continue;
    try { scope[e.var.trim()] = evalNum(v, scope); } catch { /* left undefined */ }
  }
  for (const tab of doc.tabs) for (const e of tab.items) {
    if (e.type !== 'output') continue;
    try {
      const v = evalNum(e.expr, scope);
      sim.results[e.id] = fmtNum(v, e.exact ? '' : e.digits);
      if (e.var.trim()) scope[e.var.trim()] = v;
    } catch (err) { sim.results[e.id] = '? error'; }
  }
  sim.scope = scope;
}

function graphPoints(e) {
  if (sim.graphs[e.id]) return sim.graphs[e.id];
  const n = 120, xmin = +e.xmin, xmax = +e.xmax, step = (xmax - xmin) / n;
  const out = e.fns.map(f => {
    const pts = [];
    if (!String(f.expr).trim()) return pts;
    const sc = Object.assign({}, sim.scope);
    for (let k = 0; k <= n; k++) {
      sc.x = xmin + k * step;
      try { const v = evalNum(f.expr, sc); pts.push(isFinite(v) ? v : null); } catch { pts.push(null); }
    }
    return pts;
  });
  sim.graphs[e.id] = out;
  return out;
}

const viewH = () => H - TABH;
const maxScroll = t => Math.max(0, (sim.contentH[t] || 0) - viewH());

function drawField(e, x, y, w, hh, value, focused, isOut) {
  const ty = y + 2 + Math.floor((font('r', 10) - FONT_PX[10]) / 2);
  sg.fillStyle = doc.theme.fg;
  const label = (e.label || '') + (e.label ? ':' : '');
  sg.fillText(label, x, ty);
  const lw = sw(label) + 6;
  const unit = e.unit || '';
  const uw = unit ? sw(unit) + 4 : 0;
  const bx = x + lw, bw = w - lw - uw;
  if (isOut) {
    sg.fillStyle = '#eef3fa'; sg.fillRect(bx, y, bw, hh);
    sg.strokeStyle = '#b8c8dc'; sg.strokeRect(bx + .5, y + .5, bw - 1, hh - 2);
    font('b', 10); sg.fillStyle = doc.theme.fg;
  } else {
    sg.fillStyle = '#fff'; sg.fillRect(bx, y, bw, hh);
    sg.strokeStyle = focused ? doc.theme.accent : '#909090';
    sg.lineWidth = focused ? 2 : 1;
    sg.strokeRect(bx + (focused ? 1 : .5), y + (focused ? 1 : .5), bw - (focused ? 2 : 1), hh - (focused ? 3 : 2));
    sg.lineWidth = 1; sg.fillStyle = doc.theme.fg;
  }
  let v = String(value ?? '');
  while (v.length > 1 && sw(v) > bw - 6) v = v.slice(1);
  sg.fillText(v, bx + 3, ty);
  if (focused && document.activeElement === screen && (Date.now() / 500 | 0) % 2 === 0) {
    const cx = Math.round(bx + 3 + sw(v)) + .5;
    sg.strokeStyle = doc.theme.fg; sg.beginPath(); sg.moveTo(cx, y + 3); sg.lineTo(cx, y + hh - 4); sg.stroke();
  }
  if (unit) { font('r', 10); sg.fillStyle = doc.theme.fg; sg.fillText(unit, bx + bw + 4, ty); }
}

function drawGraph(e, x, y, w, hh) {
  const xmin = +e.xmin, xmax = +e.xmax, ymin = +e.ymin, ymax = +e.ymax;
  sg.fillStyle = '#fff'; sg.fillRect(x, y, w, hh);
  if (!(xmax > xmin && ymax > ymin)) { font('r', 9); sg.fillStyle = '#c33'; sg.fillText('min must be < max', x + 4, y + 4); return; }
  const sx = v => x + (v - xmin) / (xmax - xmin) * (w - 1);
  const sy = v => y + hh - 1 - (v - ymin) / (ymax - ymin) * (hh - 1);
  sg.save(); sg.beginPath(); sg.rect(x, y, w, hh); sg.clip();
  const line = (x1, y1, x2, y2) => { sg.beginPath(); sg.moveTo(Math.round(x1) + .5, Math.round(y1) + .5); sg.lineTo(Math.round(x2) + .5, Math.round(y2) + .5); sg.stroke(); };
  if (e.grid) {
    sg.strokeStyle = '#e4e4e4';
    const gx = +e.gx || 1, gy = +e.gy || 1;
    if ((xmax - xmin) / gx < 60) for (let v = Math.ceil(xmin / gx) * gx; v <= xmax; v += gx) line(sx(v), y, sx(v), y + hh);
    if ((ymax - ymin) / gy < 60) for (let v = Math.ceil(ymin / gy) * gy; v <= ymax; v += gy) line(x, sy(v), x + w, sy(v));
  }
  sg.strokeStyle = '#707070';
  if (ymin <= 0 && ymax >= 0) line(x, sy(0), x + w, sy(0));
  if (xmin <= 0 && xmax >= 0) line(sx(0), y, sx(0), y + hh);
  const data = graphPoints(e), n = 120, step = (xmax - xmin) / n, span = ymax - ymin;
  sg.lineWidth = 2; sg.lineJoin = 'round';
  e.fns.forEach((f, fi) => {
    sg.strokeStyle = f.color || '#1060d0';
    sg.beginPath(); let pen = false;
    data[fi].forEach((v, k) => {
      if (v == null || v < ymin - 10 * span || v > ymax + 10 * span) { pen = false; return; }
      const X = sx(xmin + k * step), Y = sy(v);
      pen ? sg.lineTo(X, Y) : sg.moveTo(X, Y); pen = true;
    });
    sg.stroke();
  });
  sg.lineWidth = 1; sg.restore();
  sg.strokeStyle = '#b0b0b0'; sg.strokeRect(x + .5, y + .5, w - 1, hh - 1);
  font('r', 7); sg.fillStyle = '#707070';
  const num = v => String(+(+v).toPrecision(6));
  sg.textBaseline = 'top'; sg.fillText(num(ymax), x + 2, y + 1);
  sg.textBaseline = 'bottom'; sg.fillText(num(ymin), x + 2, y + hh - 1);
  const s = num(xmax); sg.fillText(s, x + w - 2 - sw(s), y + hh - 1);
  sg.textBaseline = 'top';
}

function drawTabs() {
  sg.fillStyle = doc.theme.tabbg; sg.fillRect(0, 0, W, TABH);
  font('b', 9);
  const n = doc.tabs.length, tw = Math.floor(W / n);
  let x = 0;
  doc.tabs.forEach((tab, i) => {
    const w = i === n - 1 ? W - x : tw;
    if (i === sim.tab) {
      sg.fillStyle = doc.theme.bg; sg.fillRect(x, 2, w, TABH - 2);
      sg.fillStyle = doc.theme.accent; sg.fillRect(x, 0, w, 2);
      sg.fillStyle = doc.theme.fg;
    } else sg.fillStyle = doc.theme.tabfg;
    let name = tab.name || 'Tab';
    while (name.length > 1 && sw(name) > w - 4) name = name.slice(0, -1);
    sg.fillText(name, Math.round(x + (w - sw(name)) / 2), 3);
    if (i > 0) { sg.fillStyle = doc.theme.tabfg; sg.fillRect(x, 4, 1, TABH - 8); }
    x += w;
  });
}

function paint() {
  if (!doc) return;
  sim.tab = Math.min(sim.tab, doc.tabs.length - 1);
  const t = sim.tab;
  measure(t);
  sim.scroll[t] = Math.max(0, Math.min(sim.scroll[t] || 0, maxScroll(t)));
  sg.textBaseline = 'top';
  sg.fillStyle = doc.theme.bg; sg.fillRect(0, 0, W, H);
  const items = doc.tabs[t].items, L = sim.layout[t], off = TABH - sim.scroll[t];
  sg.save(); sg.beginPath(); sg.rect(0, TABH, W, H - TABH); sg.clip();
  items.forEach((e, i) => {
    const en = L[i], y = en.y + off;
    if (y + en.h < TABH || y > H) return;
    switch (e.type) {
      case 'heading': case 'text': {
        font(e.type === 'heading' ? 'b' : e.style, e.size);
        sg.fillStyle = e.color || doc.theme.fg;
        const off = Math.floor((en.lh - (FONT_PX[e.size] || 13)) / 2);
        en.lines.forEach((ln, li) => {
          let x = PAD;
          if (e.align === 'center') x = PAD + (CW - sw(ln)) / 2;
          else if (e.align === 'right') x = PAD + CW - sw(ln);
          sg.fillText(ln, Math.round(x), y + li * en.lh + off);
        });
        if (e.type === 'heading') { sg.fillStyle = doc.theme.accent; sg.fillRect(PAD, y + en.h - 2, CW, 1); }
        break;
      }
      case 'equation': case 'image': {
        const r = getRaster(e);
        if (r && r.canvas) {
          let x = PAD;
          if (e.align === 'center') x = PAD + Math.floor((CW - r.w) / 2);
          else if (e.align === 'right') x = PAD + CW - r.w;
          sg.drawImage(r.canvas, x, y);
        } else {
          font('r', 7); sg.fillStyle = r && r.error ? '#c33' : '#999';
          sg.fillText(r && r.error ? '⚠ ' + r.error : (e.type === 'image' && !e.src ? '' : 'rendering…'), PAD, y + 2);
        }
        break;
      }
      case 'graph': drawGraph(e, PAD, y, CW, en.h); break;
      case 'input': drawField(e, PAD, y, CW, en.h, simValue(e), sim.focus === e.id, false); break;
      case 'output': drawField(e, PAD, y, CW, en.h, sim.results[e.id] ?? '', false, true); break;
      case 'divider': sg.fillStyle = '#c0c0c0'; sg.fillRect(PAD, y + 2, CW, 1); break;
    }
    if (hoverItem === e.id) {
      sg.strokeStyle = 'rgba(42,111,219,.85)'; sg.setLineDash([3, 2]);
      sg.strokeRect(1.5, y - 1.5, W - 3, en.h + 3); sg.setLineDash([]);
    }
  });
  sg.restore();
  const ms = maxScroll(t);
  if (ms > 0) {
    const vh = viewH(), bh = Math.max(12, vh * vh / sim.contentH[t]), by = TABH + (vh - bh) * sim.scroll[t] / ms;
    sg.fillStyle = '#e0e0e0'; sg.fillRect(W - SBW, TABH, SBW, vh);
    sg.fillStyle = '#8a8a8a'; sg.fillRect(W - SBW, by, SBW, bh);
  }
  drawTabs();
  updateFitNotes();
}

let paintQueued = false;
function scheduleViewer(recalc = false) {
  if (recalc) recompute();
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(() => { paintQueued = false; paint(); });
}
setInterval(() => { if (document.activeElement === screen && sim.focus) scheduleViewer(); }, 500);

function setZoom(z) {
  zoom = z;
  const avail = $('.device').clientWidth - 30;
  const px = Math.max(W, Math.min(W * z, avail > 0 ? avail : W * z));
  const f = px / W;
  screen.style.width = px + 'px'; screen.style.height = H * f + 'px';
  $('.docbar').style.width = px + 'px';
  $('.docbar').style.fontSize = (6 + f * 2.5) + 'px';
  $('.docbar').style.height = 10 * f + 4 + 'px';
  $$('#zoomSeg button').forEach(b => b.classList.toggle('active', +b.dataset.z === z));
}
window.addEventListener('resize', () => setZoom(zoom));

function simInputs() { return doc.tabs[sim.tab].items.filter(e => e.type === 'input'); }
function simSelectTab(t) {
  const n = doc.tabs.length;
  sim.tab = (t + n) % n;
  const ins = simInputs();
  sim.focus = ins[0]?.id || null;
  scheduleViewer();
}
function simMoveFocus(dir) {
  const ins = simInputs();
  if (!ins.length) return false;
  let i = ins.findIndex(e => e.id === sim.focus);
  i = (i + dir + ins.length) % ins.length;
  if (i < 0) i = 0;
  sim.focus = ins[i].id;
  const en = sim.layout[sim.tab]?.find(l => l.id === sim.focus);
  if (en) {
    let s = sim.scroll[sim.tab] || 0;
    if (en.y < s) s = en.y - PAD;
    if (en.y + en.h > s + viewH()) s = en.y + en.h - viewH() + PAD;
    sim.scroll[sim.tab] = s;
  }
  scheduleViewer();
  return true;
}
function simFocused() { return doc.tabs[sim.tab].items.find(e => e.id === sim.focus); }

screen.addEventListener('keydown', ev => {
  const k = ev.key;
  const f = simFocused();
  if (k === 'ArrowLeft') simSelectTab(sim.tab - 1);
  else if (k === 'ArrowRight') simSelectTab(sim.tab + 1);
  else if (k === 'ArrowUp') { sim.scroll[sim.tab] = (sim.scroll[sim.tab] || 0) - 20; scheduleViewer(); }
  else if (k === 'ArrowDown') { sim.scroll[sim.tab] = (sim.scroll[sim.tab] || 0) + 20; scheduleViewer(); }
  else if (k === 'Tab') simMoveFocus(ev.shiftKey ? -1 : 1);
  else if (k === 'Enter') simMoveFocus(1);
  else if (k === 'Backspace' && f) { sim.values[f.id] = String(simValue(f) ?? '').slice(0, -1); scheduleViewer(true); }
  else if ((k === 'Delete' || k === 'Escape') && f) { sim.values[f.id] = ''; scheduleViewer(true); }
  else if (k.length === 1 && !ev.ctrlKey && !ev.metaKey && f) { sim.values[f.id] = String(simValue(f) ?? '') + k; scheduleViewer(true); }
  else return;
  ev.preventDefault();
});
screen.addEventListener('wheel', ev => {
  sim.scroll[sim.tab] = (sim.scroll[sim.tab] || 0) + Math.sign(ev.deltaY) * 20;
  scheduleViewer(); ev.preventDefault();
}, { passive: false });
function screenPos(ev) {
  const r = screen.getBoundingClientRect();
  return [(ev.clientX - r.left) * W / r.width, (ev.clientY - r.top) * H / r.height];
}
function itemAt(x, y) {
  if (y < TABH) return null;
  const cy = y - TABH + (sim.scroll[sim.tab] || 0);
  const L = sim.layout[sim.tab] || [];
  return L.find(en => cy >= en.y - 1 && cy < en.y + en.h + 2);
}
screen.addEventListener('mousedown', ev => {
  ev.preventDefault(); screen.focus();
  const [x, y] = screenPos(ev);
  if (y < TABH) { simSelectTab(Math.min(doc.tabs.length - 1, Math.floor(x / (W / doc.tabs.length)))); setEditTab(sim.tab, false); return; }
  const en = itemAt(x, y);
  if (!en) return;
  const e = doc.tabs[sim.tab].items.find(i => i.id === en.id);
  if (e.type === 'input') sim.focus = e.id;
  if (editTab !== sim.tab) setEditTab(sim.tab, false);
  selectItem(e.id, true);
  scheduleViewer();
});
screen.addEventListener('mousemove', ev => {
  const [x, y] = screenPos(ev);
  const en = itemAt(x, y);
  const id = en ? en.id : null;
  if (id !== hoverItem) { hoverItem = id; scheduleViewer(); }
});
screen.addEventListener('mouseleave', () => { hoverItem = null; scheduleViewer(); });
screen.addEventListener('focus', () => scheduleViewer());
screen.addEventListener('blur', () => scheduleViewer());
$$('#zoomSeg button').forEach(b => b.onclick = () => setZoom(+b.dataset.z));

function updateFitNotes() {
  const notes = [];
  const n = doc.tabs.length;
  font('b', 9);
  const tw = W / n;
  doc.tabs.forEach((t, i) => {
    if (sw(t.name || 'Tab') > tw - 4) notes.push({ w: 1, t: `Tab "${t.name}" is cut off in the tab bar — use a shorter name${n > 4 ? ' or fewer tabs' : ''}.` });
  });
  const vars = new Map();
  doc.tabs.forEach(t => t.items.forEach(e => {
    if ((e.type === 'equation') && rasterCache.get(rasterKey(e))?.shrunk) notes.push({ w: 1, t: `An equation on "${t.name}" was too wide and has been shrunk to fit; consider splitting it.` });
    if (e.type === 'input' || (e.type === 'output' && e.var)) {
      const v = e.var.trim();
      if (!v) { if (e.type === 'input') notes.push({ w: 1, t: `Input "${e.label}" on "${t.name}" has no variable name.` }); return; }
      if (!/^[A-Za-z_Ͱ-Ͽ][A-Za-z0-9_Ͱ-Ͽ]*$/.test(v)) notes.push({ w: 1, t: `Variable "${v}" isn't a valid calculator name (letters, digits, _).` });
      if (['x', 'e', 'i', 'pi'].includes(v)) notes.push({ w: 1, t: `Avoid "${v}" as a variable name: it's reserved or used by graphs.` });
      if (vars.has(v)) notes.push({ w: 1, t: `Variable "${v}" is defined twice.` });
      vars.set(v, true);
    }
  }));
  doc.tabs.forEach((t, i) => {
    if (!sim.layout[i]) measure(i);
    const pages = (sim.contentH[i] || 0) / viewH();
    notes.push({ w: 0, t: `"${t.name}": ${pages <= 1 ? 'fits on one screen' : `${pages.toFixed(1)} screens tall — scrolls with ▲▼`}` });
  });
  $('#fitNotes').innerHTML = notes.map(x => `<li class="${x.w ? 'warn' : ''}">${esc(x.t)}</li>`).join('');
}

/* ------------------------------------------------------------ editor UI */
function markDirty(opts = {}) {
  if (opts.recalc !== false) recompute();
  scheduleViewer();
  scheduleSave();
  if (opts.summary) refreshSummaries();
}

function setEditTab(i, syncSim = true) {
  editTab = Math.max(0, Math.min(i, doc.tabs.length - 1));
  if (syncSim) { sim.tab = editTab; const ins = simInputs(); sim.focus = ins[0]?.id || null; }
  renderTabs(); renderItems(); scheduleViewer();
}

function renderTabs() {
  const strip = $('#tabStrip');
  strip.innerHTML = '';
  doc.tabs.forEach((t, i) => {
    const el = h('div', { class: 'tab' + (i === editTab ? ' active' : ''), title: 'Double-click to rename' },
      h('span', {}, t.name || 'Tab'));
    el.onclick = () => { if (i !== editTab) setEditTab(i); };
    el.ondblclick = () => {
      const inp = h('input', { value: t.name });
      el.firstChild.replaceWith(inp); inp.focus(); inp.select();
      const done = () => { t.name = inp.value.trim() || 'Tab'; renderTabs(); markDirty({ recalc: false }); };
      inp.onblur = done; inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = t.name; inp.blur(); } };
    };
    if (i === editTab) {
      if (i > 0) el.append(h('button', { class: 'mv', title: 'Move left', onclick: ev => { ev.stopPropagation(); moveTab(i, -1); } }, '‹'));
      if (i < doc.tabs.length - 1) el.append(h('button', { class: 'mv', title: 'Move right', onclick: ev => { ev.stopPropagation(); moveTab(i, 1); } }, '›'));
      if (doc.tabs.length > 1) el.append(h('button', { class: 'x', title: 'Delete tab', onclick: ev => { ev.stopPropagation(); deleteTab(i); } }, '×'));
    }
    strip.append(el);
  });
  strip.append(h('div', { class: 'tab add', title: 'Add tab', onclick: () => {
    doc.tabs.push({ id: uid(), name: 'Tab ' + (doc.tabs.length + 1), items: [] });
    setEditTab(doc.tabs.length - 1); markDirty();
  } }, '+ Tab'));
}
function moveTab(i, d) {
  const [t] = doc.tabs.splice(i, 1); doc.tabs.splice(i + d, 0, t);
  setEditTab(i + d); markDirty();
}
function deleteTab(i) {
  const t = doc.tabs[i];
  if (t.items.length && !confirm(`Delete tab "${t.name}" and its ${t.items.length} item(s)?`)) return;
  doc.tabs.splice(i, 1); setEditTab(Math.min(i, doc.tabs.length - 1)); markDirty();
}

function selectItem(id, scroll = false) {
  selItem = id;
  $$('.item').forEach(el => el.classList.toggle('sel', el.dataset.id === id));
  if (scroll) $(`.item[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function summary(e) {
  switch (e.type) {
    case 'heading': case 'text': return e.text.split('\n')[0];
    case 'equation': return e.latex;
    case 'image': return e.src ? `${Math.round(e.width)} px wide` : 'no image yet';
    case 'graph': return e.fns.map(f => 'y=' + f.expr).join(',  ');
    case 'input': return `${e.label} → ${e.var} = ${e.value} ${e.unit}`;
    case 'output': return `${e.label} = ${e.expr}${e.var ? '  → ' + e.var : ''}`;
    case 'spacer': return `${e.h} px`;
  }
  return '';
}
function refreshSummaries() {
  for (const tab of doc.tabs) for (const e of tab.items) {
    const el = $(`.item[data-id="${e.id}"] .item-sum`);
    if (el) el.textContent = summary(e);
  }
}

function renderItems() {
  const box = $('#items');
  box.innerHTML = '';
  const items = doc.tabs[editTab].items;
  if (!items.length) {
    box.append(h('div', { class: 'empty' }, h('p', {}, 'This tab is empty.'), h('p', { class: 'small' }, 'Use the Add bar above to put headings, text, equations, images, graphs and input/output fields on it.')));
    return;
  }
  items.forEach((e, i) => box.append(itemCard(e, i, items)));
}

function itemCard(e, i, items) {
  const card = h('div', { class: 'item' + (selItem === e.id ? ' sel' : ''), 'data-id': e.id });
  const act = (label, title, fn, cls) => h('button', { title, class: cls, onclick: ev => { ev.stopPropagation(); fn(); } }, label);
  const head = h('div', { class: 'item-head' },
    h('span', { class: 'item-type' }, TYPE_NAMES[e.type]),
    h('span', { class: 'item-sum' }, summary(e)),
    i > 0 && act('↑', 'Move up', () => { items.splice(i, 1); items.splice(i - 1, 0, e); renderItems(); markDirty(); }),
    i < items.length - 1 && act('↓', 'Move down', () => { items.splice(i, 1); items.splice(i + 1, 0, e); renderItems(); markDirty(); }),
    act('⧉', 'Duplicate', () => { items.splice(i + 1, 0, { ...structuredClone(e), id: uid() }); renderItems(); markDirty(); }),
    doc.tabs.length > 1 && act('⇄', 'Move to another tab', () => moveToTab(e, i, items)),
    act('✕', 'Delete', () => { items.splice(i, 1); renderItems(); markDirty(); }, 'del'),
  );
  card.append(head);
  const body = editorFor(e);
  if (body) card.append(h('div', { class: 'item-body' }, body));
  card.addEventListener('focusin', () => selectItem(e.id));
  card.addEventListener('mousedown', () => selectItem(e.id));
  card.addEventListener('mouseenter', () => { hoverItem = e.id; scheduleViewer(); });
  card.addEventListener('mouseleave', () => { if (hoverItem === e.id) { hoverItem = null; scheduleViewer(); } });
  return card;
}

function moveToTab(e, i, items) {
  const names = doc.tabs.map((t, k) => `${k + 1}: ${t.name}`).join('\n');
  const ans = prompt(`Move to which tab?\n${names}`, String(editTab === 0 ? 2 : 1));
  const k = parseInt(ans) - 1;
  if (isNaN(k) || k < 0 || k >= doc.tabs.length || k === editTab) return;
  items.splice(i, 1); doc.tabs[k].items.push(e);
  renderItems(); markDirty();
}

/* field builders */
function bind(e, key, el, opts = {}) {
  const read = () => el.type === 'checkbox' ? el.checked : (opts.num ? +el.value : el.value);
  el.addEventListener('input', () => {
    e[key] = read();
    if (opts.onchange) opts.onchange();
    if (key === 'value' && e.type === 'input') delete sim.values[e.id];
    markDirty({ summary: true });
  });
  return el;
}
function fText(e, key, label, attrs = {}) {
  return h('label', { class: 'field' }, label, bind(e, key, h('input', { value: e[key] ?? '', ...attrs })));
}
function fNum(e, key, label, attrs = {}) {
  return h('label', { class: 'field' }, label, bind(e, key, h('input', { type: 'number', value: e[key], ...attrs }), { num: attrs.int !== false && attrs.step !== 'any' ? true : true }));
}
function fSelect(e, key, label, opts, num = false) {
  const s = h('select', {}, opts.map(([v, t]) => h('option', { value: v }, t)));
  s.value = e[key];
  return h('label', { class: 'field' }, label, bind(e, key, s, { num }));
}
function fColor(e, key, label, def) {
  const inp = h('input', { type: 'color', value: e[key] || def });
  return h('label', { class: 'field' }, label, bind(e, key, inp));
}
const sizeOpts = SIZES.map(s => [s, s + (s === 10 ? ' (normal)' : s === 12 ? ' (large)' : '')]);
const alignOpts = [['left', 'Left'], ['center', 'Center'], ['right', 'Right']];

const SNIPS = [
  ['a/b', '\\frac{a}{b}'], ['√', '\\sqrt{x}'], ['ⁿ√', '\\sqrt[n]{x}'], ['x²', '^{2}'], ['xₙ', '_{n}'],
  ['Σ', '\\sum_{i=1}^{n}'], ['∫', '\\int_{a}^{b}'], ['lim', '\\lim_{x\\to 0}'], ['d/dx', '\\frac{d}{dx}'],
  ['±', '\\pm'], ['·', '\\cdot'], ['×', '\\times'], ['≤', '\\le'], ['≥', '\\ge'], ['≠', '\\neq'], ['≈', '\\approx'],
  ['→', '\\to'], ['∞', '\\infty'], ['°', '^\\circ'], ['θ', '\\theta'], ['α', '\\alpha'], ['β', '\\beta'],
  ['Δ', '\\Delta'], ['λ', '\\lambda'], ['μ', '\\mu'], ['π', '\\pi'], ['ω', '\\omega'], ['vec', '\\vec{v}'],
  ['( )', '\\left( x \\right)'], ['matrix', '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}'],
  ['cases', 'f(x)=\\begin{cases} 1 & x>0 \\\\ 0 & x\\le 0 \\end{cases}'], ['text', '\\text{ text }'],
];

function editorFor(e) {
  switch (e.type) {
    case 'heading':
      return [fText(e, 'text', 'Heading text'),
        h('div', { class: 'grid2' }, fSelect(e, 'size', 'Size', sizeOpts, true), fSelect(e, 'align', 'Align', alignOpts), fColor(e, 'color', 'Color', '#111111'))];
    case 'text': {
      const ta = bind(e, 'text', h('textarea', { rows: 4, placeholder: 'Type your notes… (line breaks are kept)' }));
      ta.value = e.text;
      return [ta, h('div', { class: 'grid2' },
        fSelect(e, 'size', 'Size', sizeOpts, true),
        fSelect(e, 'style', 'Style', [['r', 'Regular'], ['b', 'Bold'], ['i', 'Italic'], ['bi', 'Bold italic']]),
        fSelect(e, 'align', 'Align', alignOpts), fColor(e, 'color', 'Color', '#111111'))];
    }
    case 'equation': {
      const prev = h('div', { class: 'eq-prev' });
      const err = h('div', { class: 'eq-err' });
      const update = async () => {
        const r = await waitRaster(e);
        if (!r) { prev.innerHTML = '<span class="muted small">empty</span>'; err.textContent = ''; return; }
        if (r.error) { err.textContent = 'LaTeX error: ' + r.error; return; }
        err.textContent = r.shrunk ? 'Too wide for the screen: shrunk to fit.' : '';
        prev.innerHTML = '';
        const img = h('img', { src: r.url, width: r.w * 2, height: r.h * 2, alt: 'equation preview' });
        prev.append(img);
      };
      const ta = h('textarea', { rows: 2, class: 'mono', placeholder: 'LaTeX, e.g. E = mc^2' });
      ta.value = e.latex;
      let t;
      ta.addEventListener('input', () => { e.latex = ta.value; clearTimeout(t); t = setTimeout(update, 250); markDirty({ summary: true, recalc: false }); });
      const snips = h('div', { class: 'snips' }, SNIPS.map(([lbl, code]) => h('button', { type: 'button', title: code, onclick: () => {
        const s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + code + ta.value.slice(en);
        ta.focus(); ta.selectionStart = ta.selectionEnd = s + code.length;
        ta.dispatchEvent(new Event('input'));
      } }, lbl)));
      const sizeSel = h('select', {}, [11, 13, 15, 18, 22, 28].map(s => h('option', { value: s }, s + ' px')));
      sizeSel.value = e.size;
      sizeSel.onchange = () => { e.size = +sizeSel.value; update(); markDirty({ recalc: false }); };
      const col = h('input', { type: 'color', value: e.color || '#111111' });
      col.oninput = () => { e.color = col.value; update(); markDirty({ recalc: false }); };
      setTimeout(update);
      return [ta, snips, prev, err, h('div', { class: 'grid2' },
        h('label', { class: 'field' }, 'Size', sizeSel), fSelect(e, 'align', 'Align', alignOpts),
        h('label', { class: 'field' }, 'Color', col))];
    }
    case 'image': {
      const drop = h('div', { class: 'drop', tabindex: 0 });
      const show = () => {
        drop.innerHTML = '';
        if (e.src) drop.append(h('img', { src: e.src, alt: '' }), h('span', { class: 'small' }, 'Click, drop or paste to replace'));
        else drop.append(h('span', {}, 'Click to choose an image, drop one here, or paste (Ctrl+V)'));
      };
      const take = async file => {
        if (!file || !file.type.startsWith('image/')) return toast('That is not an image', true);
        e.src = await shrinkForStorage(file);
        show(); markDirty({ summary: true, recalc: false });
      };
      drop.onclick = () => { const p = $('#imgPicker'); p.onchange = () => take(p.files[0]); p.value = ''; p.click(); };
      drop.ondragover = ev => { ev.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = ev => { ev.preventDefault(); drop.classList.remove('over'); take(ev.dataTransfer.files[0]); };
      drop.onpaste = ev => { const f = [...ev.clipboardData.files][0]; if (f) { ev.preventDefault(); take(f); } };
      show();
      const range = h('input', { type: 'range', min: 20, max: CW, value: e.width });
      const lbl = h('span', {}, `${e.width} px`);
      range.oninput = () => { e.width = +range.value; lbl.textContent = `${e.width} px`; markDirty({ summary: true, recalc: false }); };
      return [drop, h('div', { class: 'grid2' },
        h('label', { class: 'field' }, h('span', {}, 'Width on screen: ', lbl), range), fSelect(e, 'align', 'Align', alignOpts)),
        h('div', { class: 'note' }, `The screen is ${W}×${H}; images are fitted to ${CW} px wide at most and stored in 16-bit color.`)];
    }
    case 'graph': {
      const list = h('div', { style: 'display:grid;gap:6px' });
      const draw = () => {
        list.innerHTML = '';
        e.fns.forEach((f, k) => {
          const col = h('input', { type: 'color', value: f.color || '#1060d0' });
          col.oninput = () => { f.color = col.value; markDirty({ recalc: false }); };
          const ex = h('input', { class: 'mono', value: f.expr, placeholder: 'e.g. a*x^2+1' });
          ex.oninput = () => { f.expr = ex.value; delete sim.graphs[e.id]; markDirty({ summary: true }); };
          const del = h('button', { class: 'btn small ghost', title: 'Remove', onclick: () => { e.fns.splice(k, 1); draw(); markDirty({ summary: true }); } }, '✕');
          list.append(h('div', { class: 'fn-row' }, col, h('div', { class: 'row' }, h('span', { class: 'lbl' }, `y${k + 1}=`), ex), del));
        });
        const palette = ['#1060d0', '#d0402a', '#1f9d55', '#8a3ad0', '#d48a00'];
        list.append(h('div', {}, h('button', { class: 'btn small', onclick: () => { e.fns.push({ expr: '', color: palette[e.fns.length % palette.length] }); draw(); } }, '+ Function')));
      };
      draw();
      return [list, h('div', { class: 'grid2' },
        fNum(e, 'xmin', 'x min', { step: 'any' }), fNum(e, 'xmax', 'x max', { step: 'any' }),
        fNum(e, 'ymin', 'y min', { step: 'any' }), fNum(e, 'ymax', 'y max', { step: 'any' }),
        fNum(e, 'gx', 'Grid x step', { step: 'any', min: 0 }), fNum(e, 'gy', 'Grid y step', { step: 'any', min: 0 }),
        fNum(e, 'h', 'Height (px)', { min: 40, max: H - TABH - 8 }),
        h('label', { class: 'chk' }, bind(e, 'grid', h('input', { type: 'checkbox', checked: e.grid })), 'Show grid')),
        h('div', { class: 'note' }, 'Use ', h('code', {}, 'x'), ' as the variable. Functions can use any input or named output variable, and redraw when you change them.')];
    }
    case 'input':
      return [h('div', { class: 'grid2' },
        fText(e, 'label', 'Label'), fText(e, 'var', 'Variable name', { class: 'mono', placeholder: 'm' }),
        fText(e, 'value', 'Default value', { class: 'mono' }), fText(e, 'unit', 'Unit (shown after)')),
        h('div', { class: 'note' }, 'On the calculator, press ', h('kbd', {}, 'tab'), ' to move between inputs and type a value. Outputs update instantly.')];
    case 'output':
      return [h('div', { class: 'grid2' },
        fText(e, 'label', 'Label'), fText(e, 'expr', 'Equation / expression', { class: 'mono', placeholder: 'm*acc' }),
        fText(e, 'var', 'Save result as (optional)', { class: 'mono', placeholder: 'F' }), fText(e, 'unit', 'Unit')),
        h('div', { class: 'grid2' },
          fText(e, 'digits', 'Decimal places (blank = full)', { class: 'mono' }),
          h('label', { class: 'chk' }, bind(e, 'exact', h('input', { type: 'checkbox', checked: e.exact })), 'Exact result (CAS: fractions, √)')),
        h('div', { class: 'note' }, 'Uses calculator syntax: ', h('code', {}, 'sqrt( )'), ' ', h('code', {}, 'x^2'), ' ', h('code', {}, 'ln( )'), ' ', h('code', {}, 'log( )'), ' ', h('code', {}, 'sin( )'), ' ', h('code', {}, 'pi'),
          '. Name the result to use it in later outputs and graphs. On a CAS you can also use ', h('code', {}, 'solve( )'), '.')];
    case 'spacer':
      return [fNum(e, 'h', 'Height (px)', { min: 1, max: 100 })];
  }
  return null;
}

async function shrinkForStorage(file) {
  const url = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
  const img = await loadImg(url);
  const max = 640;
  if (img.width <= max && img.height <= max && file.size < 400000) return url;
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
}

$$('#addBar button').forEach(b => b.onclick = () => {
  const e = newItem(b.dataset.add);
  const items = doc.tabs[editTab].items;
  const at = selItem ? items.findIndex(x => x.id === selItem) : -1;
  items.splice(at >= 0 ? at + 1 : items.length, 0, e);
  selItem = e.id;
  renderItems(); markDirty();
  setTimeout(() => {
    const card = $(`.item[data-id="${e.id}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card?.querySelector('input:not([type=color]):not([type=range]), textarea')?.focus();
    if (e.type === 'image') card?.querySelector('.drop')?.click();
  }, 30);
});

/* ------------------------------------------------------------ document settings & projects */
function loadDocUI() {
  $('#docTitle').value = doc.title;
  $('#docAngle').value = doc.angle;
  $('#thBg').value = doc.theme.bg; $('#thFg').value = doc.theme.fg;
  $('#thAccent').value = doc.theme.accent; $('#thTabbg').value = doc.theme.tabbg;
  $('#sendFolder').value = doc.send?.folder ?? '/Notes';
  $('#sendName').value = doc.send?.name ?? '';
  $('#sendName').placeholder = slug(doc.title);
  $('#docbarTitle').textContent = doc.title;
  $('#docbarMode').textContent = doc.angle === 'deg' ? 'DEG' : 'RAD';
  sim.values = {}; sim.scroll = []; sim.tab = 0; sim.focus = null;
  editTab = 0; selItem = null;
  rasterCache.clear();
  recompute(); renderTabs(); renderItems(); renderProjects();
  simSelectTab(0);
}
const slug = s => (s || 'notes').trim().replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || 'notes';

$('#docTitle').oninput = () => { doc.title = $('#docTitle').value; $('#docbarTitle').textContent = doc.title; $('#sendName').placeholder = slug(doc.title); renderProjects(); markDirty({ recalc: false }); };
$('#docAngle').onchange = () => { doc.angle = $('#docAngle').value; $('#docbarMode').textContent = doc.angle === 'deg' ? 'DEG' : 'RAD'; markDirty(); };
for (const [id, key] of [['thBg', 'bg'], ['thFg', 'fg'], ['thAccent', 'accent'], ['thTabbg', 'tabbg']]) {
  $('#' + id).oninput = ev => {
    doc.theme[key] = ev.target.value;
    if (key === 'tabbg') doc.theme.tabfg = contrastText(ev.target.value);
    if (key === 'bg') rasterCache.clear();
    markDirty({ recalc: false });
  };
}
function contrastText(hex) {
  const n = parseInt(hex.slice(1), 16), l = (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255));
  return l > 140 ? '#3a4352' : '#c9d2de';
}
$('#sendFolder').oninput = () => { doc.send = { ...doc.send, folder: $('#sendFolder').value }; scheduleSave(); };
$('#sendName').oninput = () => { doc.send = { ...doc.send, name: $('#sendName').value }; scheduleSave(); };

let saveT = null;
function scheduleSave() {
  $('#saveState').textContent = 'Unsaved changes…';
  clearTimeout(saveT);
  saveT = setTimeout(saveNow, 800);
}
async function saveNow() {
  clearTimeout(saveT);
  try {
    await api('project', { body: doc });
    $('#saveState').textContent = 'Saved on this computer';
    const p = projects.find(p => p.id === doc.id);
    if (!p) { projects.unshift({ id: doc.id, title: doc.title }); renderProjects(); }
    try { localStorage.setItem('lastDoc', doc.id); } catch { }
  } catch (err) { $('#saveState').textContent = 'Save failed: ' + err.message; }
}
function renderProjects() {
  const ul = $('#projList');
  ul.innerHTML = '';
  for (const p of projects) {
    const title = p.id === doc?.id ? doc.title : p.title;
    ul.append(h('li', { class: p.id === doc?.id ? 'active' : '', title, onclick: () => openProject(p.id) }, title || 'Untitled'));
  }
}
async function openProject(id) {
  if (doc && id === doc.id) return;
  if (doc) await saveNow();
  const r = await fetch('/api/project?id=' + encodeURIComponent(id));
  doc = await r.json();
  normalise(doc);
  loadDocUI();
  try { localStorage.setItem('lastDoc', doc.id); } catch { }
}
function normalise(d) {
  d.theme = { bg: '#ffffff', fg: '#111111', accent: '#2a6fdb', tabbg: '#2b3442', tabfg: '#c9d2de', ...(d.theme || {}) };
  d.angle ||= 'rad'; d.send ||= { folder: '/Notes', name: '' };
  d.tabs ||= [{ id: uid(), name: 'Notes', items: [] }];
  if (!d.tabs.length) d.tabs.push({ id: uid(), name: 'Notes', items: [] });
  for (const t of d.tabs) { t.id ||= uid(); t.items ||= []; for (const e of t.items) { e.id ||= uid(); Object.assign(e, { ...DEFAULTS[e.type]?.(), ...e }); } }
}
$('#newDoc').onclick = async () => {
  if (doc) await saveNow();
  doc = { id: uid(), title: 'Untitled notes', angle: 'rad', theme: {}, send: { folder: '/Notes', name: '' }, tabs: [{ id: uid(), name: 'Notes', items: [newItem('heading')] }] };
  normalise(doc);
  projects.unshift({ id: doc.id, title: doc.title });
  loadDocUI(); saveNow();
  $('#docTitle').focus(); $('#docTitle').select();
};
$('#delDoc').onclick = async () => {
  if (!confirm(`Delete "${doc.title}" from this computer? (Copies on the calculator are not touched.)`)) return;
  await api('project-delete', { body: { id: doc.id } });
  projects = projects.filter(p => p.id !== doc.id);
  doc = null;
  if (projects.length) await openProject(projects[0].id);
  else { doc = sampleDoc(); normalise(doc); loadDocUI(); saveNow(); }
};

/* ------------------------------------------------------------ build & send */
async function exportDoc() {
  const out = structuredClone(doc);
  for (const tab of out.tabs) for (const e of tab.items) {
    if (e.type === 'equation' || e.type === 'image') {
      const r = await waitRaster(e);
      if (r && r.error) throw new Error(`Equation error on "${tab.name}": ${r.error}`);
      e.raster = r ? r.url : null;
      delete e.src;
    }
  }
  return out;
}
function sendMsg(t, cls = '') { const m = $('#sendMsg'); m.textContent = t; m.className = 'small ' + cls; }

$('#sendBtn').onclick = async () => {
  const btn = $('#sendBtn');
  btn.disabled = true; sendMsg('Building…');
  try {
    await saveNow();
    const payload = { doc: await exportDoc(), folder: $('#sendFolder').value || '/', name: $('#sendName').value || slug(doc.title) };
    sendMsg('Sending over USB…');
    let r;
    try { r = await api('send', { body: payload }); }
    catch (err) {
      if (err.exists && confirm(`${err.path} already exists on the calculator. Replace it?`)) r = await api('send', { body: { ...payload, overwrite: true } });
      else throw err;
    }
    sendMsg(`Sent ${r.path} (${fmtSize(r.size)}). Open it from My Documents on the calculator.`, 'ok');
    toast('Sent to calculator ✓');
    pollStatus();
  } catch (err) { sendMsg(err.message, 'err'); }
  finally { btn.disabled = false; }
};
$('#dlBtn').onclick = async () => {
  try {
    sendMsg('Building…');
    const blob = await api('build', { body: { doc: await exportDoc(), name: $('#sendName').value || slug(doc.title) }, blob: true });
    const a = h('a', { href: URL.createObjectURL(blob), download: ($('#sendName').value || slug(doc.title)) + '.tns' });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    sendMsg('Downloaded the .tns file. You can also send it with TI-Nspire software.', 'ok');
  } catch (err) { sendMsg(err.message, 'err'); }
};

/* ------------------------------------------------------------ connection */
let status = { connected: false };
async function pollStatus() {
  try { status = await api('status'); } catch { status = { connected: false, server: false }; }
  const dot = $('#connDot'), title = $('#connTitle'), sub = $('#connSub'), btn = $('#connBtn');
  dot.className = 'dot' + (status.connected ? ' on' : status.usb ? ' found' : '');
  $('#navBadge').classList.toggle('hidden', !status.connected);
  if (status.server === false) { title.textContent = 'App server stopped'; sub.textContent = 'Restart Nspire Studio'; btn.disabled = true; return; }
  btn.disabled = false;
  if (status.connected && status.info) {
    const i = status.info;
    title.textContent = i.model + (i.name && i.name !== i.model ? ` · ${i.name}` : '');
    sub.textContent = `OS ${i.os}${i.battery !== 'Unknown' ? ' · Battery ' + i.battery : ''}${i.charging ? ' (charging)' : ''} · ${fmtSize(i.storage_free)} free`;
    btn.textContent = 'Disconnect'; btn.classList.remove('primary');
  } else if (status.usb) {
    title.textContent = status.usb.model + ' detected';
    sub.textContent = status.usb.writable ? 'Ready: press Connect' : 'No USB permission: run install-udev.sh';
    btn.textContent = 'Connect'; btn.classList.add('primary');
  } else {
    title.textContent = 'No calculator';
    sub.textContent = 'Plug in over USB and turn it on';
    btn.textContent = 'Connect'; btn.classList.add('primary');
  }
  renderDevInfo();
  let auto = false;
  try { auto = localStorage.getItem('autoConnect') === '1'; } catch { }
  if (auto && !status.connected && status.usb?.writable && !pollStatus.busy && Date.now() - (pollStatus.lastTry || 0) > 8000) {
    pollStatus.busy = true; pollStatus.lastTry = Date.now();
    api('connect', { body: {} }).then(() => toast('Calculator connected ✓')).catch(() => { }).finally(() => { pollStatus.busy = false; pollStatus(); });
  }
  if (status.connected !== pollStatus.was) {
    pollStatus.was = status.connected;
    if (status.connected) { loadFolders(); if (currentView === 'calc') fsLoad(); }
    else if (currentView === 'calc') fsLoad();
  }
}
$('#connBtn').onclick = async () => {
  const btn = $('#connBtn');
  btn.disabled = true;
  try {
    const set = v => { try { localStorage.setItem('autoConnect', v); } catch { } };
    if (status.connected) { set('0'); await api('disconnect', { body: {} }); toast('Disconnected'); }
    else { btn.textContent = 'Connecting…'; await api('connect', { body: {} }); set('1'); toast('Connected ✓'); }
  } catch (err) { toast(err.message, true); }
  finally { btn.disabled = false; pollStatus(); }
};
setInterval(pollStatus, 2500);

function fmtSize(n) {
  if (n == null) return '';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

function renderDevInfo() {
  const box = $('#devInfo');
  if (!status.connected || !status.info) {
    box.className = 'devinfo muted';
    box.innerHTML = status.usb
      ? `${esc(status.usb.model)} is plugged in but not connected.<br><br><button class="btn primary small" onclick="document.getElementById('connBtn').click()">Connect</button>`
      : 'No calculator found. Plug it in with the USB cable and turn it on (press <b>on</b>; it must not be asleep).';
    return;
  }
  const i = status.info;
  const pct = i.storage_total ? (1 - i.storage_free / i.storage_total) * 100 : 0;
  box.className = 'devinfo';
  box.innerHTML = `<dl>
    <dt>Model</dt><dd>${esc(i.model)}</dd>
    <dt>Name</dt><dd>${esc(i.name || '—')}</dd>
    <dt>OS</dt><dd>${esc(i.os)}</dd>
    <dt>Battery</dt><dd>${esc(i.battery === 'Unknown' ? 'Not reported' : i.battery)}${i.charging ? ' (charging)' : ''}</dd>
    <dt>Storage</dt><dd>${fmtSize(i.storage_free)} free of ${fmtSize(i.storage_total)}<div class="meter"><div style="width:${pct.toFixed(1)}%"></div></div></dd>
    <dt>Screen</dt><dd>${i.lcd[0]}×${i.lcd[1]}, ${i.lcd[2]}-bit</dd>
    <dt>ID</dt><dd class="mono small">${esc(i.id)}</dd>
  </dl>`;
}

/* ------------------------------------------------------------ calculator file system */
let fsPath = '/';
async function loadFolders() {
  try {
    const r = await api('ls?path=/');
    $('#folderList').innerHTML = r.items.filter(x => x.dir).map(x => `<option value="/${esc(x.name)}">`).join('');
  } catch { }
}
const joinPath = (a, b) => (a === '/' ? '' : a) + '/' + b;
async function fsLoad(path = fsPath) {
  const body = $('#fsBody');
  renderCrumbs(path);
  if (!status.connected) {
    body.innerHTML = '<tr><td colspan="4" class="muted">Connect the calculator to browse its files.</td></tr>';
    return;
  }
  body.innerHTML = '<tr><td colspan="4" class="muted">Loading…</td></tr>';
  try {
    const r = await api('ls?path=' + encodeURIComponent(path));
    fsPath = path; renderCrumbs(path);
    body.innerHTML = '';
    if (!r.items.length) body.innerHTML = '<tr><td colspan="4" class="muted">Empty folder</td></tr>';
    for (const it of r.items) {
      const p = joinPath(path, it.name);
      const tr = h('tr', {},
        h('td', {}, h('div', { class: 'name', onclick: () => it.dir ? fsLoad(p) : download(p) },
          h('span', { class: 'ico' }, it.dir ? '📁' : it.name.endsWith('.tns') ? '📄' : '▫'), h('span', {}, it.name))),
        h('td', { class: 'num muted' }, it.dir ? '' : fmtSize(it.size)),
        h('td', { class: 'muted small' }, it.date > 1e8 ? new Date(it.date * 1000).toLocaleString() : ''),
        h('td', { class: 'acts' },
          !it.dir && h('button', { onclick: () => download(p), title: 'Save to this computer' }, 'Download'),
          h('button', { onclick: () => rename(p, it.name) }, 'Rename'),
          h('button', { class: 'del', onclick: () => del(p, it) }, 'Delete')));
      body.append(tr);
    }
  } catch (err) {
    body.innerHTML = `<tr><td colspan="4" class="warn">${esc(err.message)}</td></tr>`;
  }
}
function renderCrumbs(path) {
  const c = $('#crumbs'); c.innerHTML = '';
  const parts = path.split('/').filter(Boolean);
  c.append(h('button', { onclick: () => fsLoad('/') }, 'My Documents'));
  let cur = '';
  for (const p of parts) { cur += '/' + p; const to = cur; c.append(h('span', { class: 'muted' }, '›'), h('button', { onclick: () => fsLoad(to) }, p)); }
}
async function download(p) {
  try {
    const blob = await api('download?path=' + encodeURIComponent(p), { blob: true });
    const a = h('a', { href: URL.createObjectURL(blob), download: p.split('/').pop() });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (err) { toast(err.message, true); }
}
async function rename(p, name) {
  const n = prompt('New name', name);
  if (!n || n === name) return;
  try { await api('move', { body: { src: p, dst: joinPath(fsPath, n) } }); fsLoad(); }
  catch (err) { toast(err.message, true); }
}
async function del(p, it) {
  if (!confirm(`Delete ${it.dir ? 'folder' : 'file'} "${it.name}" from the calculator? This cannot be undone.`)) return;
  try { await api('delete', { body: { path: p, dir: it.dir } }); toast('Deleted'); fsLoad(); }
  catch (err) { toast(err.message + (it.dir ? ' (folders must be empty)' : ''), true); }
}
$('#fsUp').onclick = () => { const parts = fsPath.split('/').filter(Boolean); parts.pop(); fsLoad('/' + parts.join('/')); };
$('#fsRefresh').onclick = () => fsLoad();
$('#fsMkdir').onclick = async () => {
  const n = prompt('Folder name');
  if (!n) return;
  try { await api('mkdir', { body: { path: joinPath(fsPath, n) } }); fsLoad(); loadFolders(); }
  catch (err) { toast(err.message, true); }
};
$('#fsUpload').onchange = async ev => {
  for (const f of ev.target.files) {
    try { await api('upload?path=' + encodeURIComponent(joinPath(fsPath, f.name)), { body: await f.arrayBuffer(), raw: true }); toast('Uploaded ' + f.name); }
    catch (err) { toast(`${f.name}: ${err.message}`, true); }
  }
  ev.target.value = ''; fsLoad();
};
$('#shotBtn').onclick = async () => {
  try {
    const blob = await api('screenshot', { blob: true });
    $('#shotImg').src = URL.createObjectURL(blob);
    $('#shotEmpty').classList.add('hidden');
  } catch (err) { toast(err.message, true); }
};

/* ------------------------------------------------------------ views */
let currentView = 'editor';
$$('.views button').forEach(b => b.onclick = () => {
  currentView = b.dataset.view;
  $$('.views button').forEach(x => x.classList.toggle('active', x === b));
  $('#view-editor').classList.toggle('hidden', currentView !== 'editor');
  $('#view-calc').classList.toggle('hidden', currentView !== 'calc');
  if (currentView === 'calc') { renderDevInfo(); fsLoad(); }
});
document.addEventListener('keydown', ev => {
  if (!(ev.ctrlKey || ev.metaKey)) return;
  const k = ev.key.toLowerCase();
  if (k === 's' && ev.shiftKey) { ev.preventDefault(); saveToFile(); }
  else if (k === 's') { ev.preventDefault(); saveNow(); }
  else if (k === 'o') { ev.preventDefault(); $('#openFile').click(); }
});

/* ------------------------------------------------------------ .nsnotes files */
const FILE_FORMAT = 'nspire-studio';
async function saveToFile() {
  if (!doc) return;
  await saveNow();
  const data = JSON.stringify({ format: FILE_FORMAT, version: 1, saved: new Date().toISOString(), doc }, null, 1);
  const a = h('a', { href: URL.createObjectURL(new Blob([data], { type: 'application/json' })), download: slug(doc.title) + '.nsnotes' });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function openFileText(text, name = 'file') {
  let d;
  try {
    const j = JSON.parse(text);
    d = j && j.format === FILE_FORMAT ? j.doc : j;
    if (!d || !Array.isArray(d.tabs)) throw new Error('not an Nspire Studio document');
  } catch (err) { toast(`Can't open ${name}: ${err.message}`, true); return false; }
  if (doc) await saveNow();
  if (!d.id || projects.some(p => p.id === d.id)) {
    const existing = projects.find(p => p.id === d.id);
    if (existing && confirm(`"${existing.title}" is already in your documents.\n\nOK = replace it with the file\nCancel = open the file as a separate copy`)) {
      // replace: keep the id
    } else d.id = uid();
  }
  normalise(d);
  doc = d;
  if (!projects.some(p => p.id === d.id)) projects.unshift({ id: d.id, title: d.title });
  loadDocUI();
  await saveNow();
  toast(`Opened ${name}`);
  return true;
}
window.openFileText = openFileText;
$('#saveFile').onclick = saveToFile;
$('#openFile').onclick = () => { const p = $('#docPicker'); p.value = ''; p.click(); };
$('#docPicker').onchange = async ev => { const f = ev.target.files[0]; if (f) openFileText(await f.text(), f.name); };
let dragDepth = 0;
const isDocDrag = ev => [...(ev.dataTransfer?.items || [])].some(i => i.kind === 'file') && !ev.target.closest?.('.drop');
window.addEventListener('dragenter', ev => { if (isDocDrag(ev)) { dragDepth++; $('#dropHint').classList.remove('hidden'); } });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#dropHint').classList.add('hidden'); } });
window.addEventListener('dragover', ev => { if (isDocDrag(ev)) ev.preventDefault(); });
window.addEventListener('drop', async ev => {
  dragDepth = 0; $('#dropHint').classList.add('hidden');
  if (ev.target.closest?.('.drop')) return;   // image drop zones handle their own
  const f = [...(ev.dataTransfer?.files || [])].find(f => /\.(nsnotes|json)$/i.test(f.name));
  ev.preventDefault();
  if (f) openFileText(await f.text(), f.name);
  else if (ev.dataTransfer?.files?.length) toast('Drop a .nsnotes file to open it (images go in an Image item)', true);
});
window.addEventListener('beforeunload', () => { if (doc) navigator.sendBeacon?.('/api/project', new Blob([JSON.stringify(doc)], { type: 'application/json' })); });

/* ------------------------------------------------------------ boot */
(async function boot() {
  setZoom(2);
  await new Promise(r => { const c = () => window.math ? r() : setTimeout(c, 30); c(); });
  try { projects = (await api('projects')).projects; } catch { projects = []; }
  let last = null;
  try { last = localStorage.getItem('lastDoc'); } catch { }
  const pick = projects.find(p => p.id === last) || projects[0];
  if (pick) { doc = null; await openProject(pick.id); }
  else { doc = sampleDoc(); normalise(doc); loadDocUI(); await saveNow(); projects = (await api('projects')).projects; renderProjects(); }
  pollStatus();
})();
