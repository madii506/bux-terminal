// BUX · Pump: every pump.fun launch, live from Jupiter's gems feed, in three columns (new pairs, final stretch, migrated).
// Tap a coin to open it in the terminal; ⚡ buys it in one wallet signature through Jupiter Ultra.
import { $, $$, esc, store, toast, solscan, pct, cls, icon } from './core.js';
import * as api from './api.js';
import * as W from './wallet.js';

const JDP = 'https://datapi.jup.ag';
const COLS = [['recent', 'New pairs', 'just launched'], ['aboutToGraduate', 'Final stretch', 'closest to bonding'], ['graduated', 'Migrated', 'live on PumpSwap']];
const QB = [0.05, 0.1, 0.25, 0.5, 1];
const P = { on: false, pulse: { recent: [], aboutToGraduate: [], graduated: [] }, by: new Map(), prev: new Map(), at: 0, err: 0, timer: 0, q: '', col: 'recent', qb: +store.get('bux:qb', .1) || .1, pend: new Set() };
// coins named after hate are left out
const BAD = /hitler|nazi|swastika|\b1488\b|\bkkk\b|holocaust|n[i1!]gg|f[a@]gg[o0]t|\bpedo|\brape\b|\bisis\b/i;

async function j(url, opt = {}, ms = 12000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { ...opt, signal: c.signal }); const d = await r.json().catch(() => null); if (!r.ok) throw new Error((d && (d.error || d.message)) || 'HTTP ' + r.status); return d; }
  finally { clearTimeout(t); }
}
const gems = () => { const f = { timeframe: '24h', launchpads: ['pump.fun'] }; return j(JDP + '/v1/pools/gems', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recent: f, aboutToGraduate: f, graduated: f }) }); };

const fin = v => v != null && isFinite(v);
const cmp = v => { if (!fin(v)) return '—'; const a = Math.abs(v); if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return '$' + (v / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K'; return '$' + Math.round(v); };
const amt = v => { if (!fin(v)) return '—'; const a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return String(Math.round(v)); };
const ago = t => { const s = Math.max(0, (Date.now() - t) / 1000); if (s < 60) return Math.floor(s) + 's'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd'; };
const ms = v => (v ? Date.parse(v) || null : null);
const clamp = v => (fin(v) ? Math.max(0, Math.min(100, v)) : 0);
function fromTok(b, p = {}, col) {
  const a = b.audit || {}, s5 = b.stats5m || {}, s24 = b.stats24h || {}, grad = ms(b.graduatedAt);
  return { mint: b.id, col, name: b.name || '', sym: b.symbol || '', icon: /^https:\/\//.test(b.icon || '') ? b.icon : '',
    created: ms((b.firstPool && b.firstPool.createdAt) || b.createdAt || p.createdAt), grad, prog: p.bondingCurve != null ? +p.bondingCurve : grad ? 100 : null,
    mcap: +(b.mcap ?? b.fdv) || null, vol: +p.volume24h || (s24.buyVolume || 0) + (s24.sellVolume || 0) || null, holders: b.holderCount ?? null,
    top10: a.topHoldersPercentage ?? null, mintOff: a.mintAuthorityDisabled ?? null, freezeOff: a.freezeAuthorityDisabled ?? null, devMints: a.devMints ?? null,
    bundle: a.bundlerStats ? a.bundlerStats.holdingPct ?? null : null, tw: b.twitter || '', web: b.website || '', tg: b.telegram || '', ch5: s5.priceChange ?? null };
}
const merge = t => { const o = P.by.get(t.mint); if (o) for (const k of Object.keys(t)) if (t[k] == null || t[k] === '') t[k] = o[k]; P.by.set(t.mint, t); return t; };

export function init(hooks) {
  $('#pQb').innerHTML = QB.map(v => `<button type="button" data-qb="${v}" class="${P.qb === v ? 'on' : ''}">⚡ ${v}</button>`).join('');
  $('#pCol').innerHTML = COLS.map(([k, l]) => `<button type="button" data-col="${k}" class="${P.col === k ? 'on' : ''}">${l}</button>`).join('');
  $('#pcols').innerHTML = COLS.map(([k, l, s]) => `<section class="pcol${P.col === k ? ' cur' : ''}" data-col="${k}"><h3><b>${l}</b><span>${s}</span><em id="pn-${k}">0</em></h3><div class="plist" id="pl-${k}"><div class="sk"></div><div class="sk"></div><div class="sk"></div><div class="sk"></div></div></section>`).join('');
  $('#pQb').onclick = e => { const b = e.target.closest('[data-qb]'); if (!b) return; P.qb = +b.dataset.qb; store.set('bux:qb', P.qb); $$('#pQb button').forEach(x => x.classList.toggle('on', x === b)); draw(); };
  $('#pCol').onclick = e => { const b = e.target.closest('[data-col]'); if (!b) return; P.col = b.dataset.col; $$('#pCol button').forEach(x => x.classList.toggle('on', x === b)); $$('.pcol').forEach(c => c.classList.toggle('cur', c.dataset.col === P.col)); };
  $('#pq').oninput = () => { const v = $('#pq').value.trim(); P.q = v; if (/^[1-9A-HJ-NP-Za-km-z]{40,44}$/.test(v)) { openCoin(v); return; } draw(); };
  $('#pcols').onclick = e => {
    const qb = e.target.closest('[data-buy]'); if (qb) { e.stopPropagation(); buy(qb.dataset.buy); return; }
    const c = e.target.closest('.pc'); if (c) openCoin(c.dataset.m);
  };
  $('#pcols').onkeydown = e => { const c = e.target.closest('.pc'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openCoin(c.dataset.m); } };
  hooks.pump = { show: start, hide: stop };
  setInterval(status, 1000);
}
function openCoin(m) { window.__buxPick && window.__buxPick(m, 'ape'); window.__go && window.__go('trade'); }
function start() { if (P.on) return; P.on = true; poll(); }
function stop() { P.on = false; clearTimeout(P.timer); }
async function poll() {
  clearTimeout(P.timer); if (!P.on) return;
  if (document.hidden) { P.timer = setTimeout(poll, 2000); return; }
  try {
    const d = await gems();
    for (const [k] of COLS) {
      for (const t of P.pulse[k]) if (t.mcap != null) P.prev.set(t.mint, t.mcap);
      P.pulse[k] = ((d[k] && d[k].pools) || []).filter(p => p && p.baseAsset && p.baseAsset.id).map(p => merge(fromTok(p.baseAsset, p, k))).filter(t => (t.sym || t.name) && !BAD.test(t.sym + ' ' + t.name));
    }
    P.at = Date.now(); P.err = 0; draw();
  } catch { P.err++; }
  status();
  P.timer = setTimeout(poll, P.err ? Math.min(30000, 3000 * 2 ** P.err) : 4000);
}
function status() {
  const s = $('#pStat'); if (!s) return; const age = P.at ? Math.round((Date.now() - P.at) / 1000) : null;
  const off = !!P.err && (!P.at || age > 20);
  s.textContent = off ? 'reconnecting…' : P.at ? (age < 3 ? 'live' : `live · ${age}s`) : 'connecting…'; s.parentElement.classList.toggle('off', off);
}
const pass = t => { const q = P.q.toLowerCase(); return !q || t.sym.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.mint.toLowerCase() === q; };
const sorted = k => { const L = P.pulse[k].slice(); if (k === 'recent') L.sort((a, b) => (b.created || 0) - (a.created || 0)); else if (k === 'graduated') L.sort((a, b) => (b.grad || 0) - (a.grad || 0)); else L.sort((a, b) => (b.prog ?? 0) - (a.prog ?? 0)); return L; };
function flags(t) {
  const f = [];
  if (fin(t.top10)) f.push(`<span class="fl ${t.top10 >= 30 ? 'bad' : ''}" title="Share held by the top 10 holders">T10 ${t.top10.toFixed(0)}%</span>`);
  if (fin(t.devMints) && t.devMints > 0) f.push(`<span class="fl ${t.devMints >= 10 ? 'bad' : ''}" title="Coins this dev has launched">DEV ${t.devMints}</span>`);
  if (fin(t.bundle) && t.bundle >= 1) f.push(`<span class="fl ${t.bundle >= 15 ? 'bad' : ''}" title="Share held by bundled wallets">BNDL ${t.bundle.toFixed(0)}%</span>`);
  if (t.mintOff === false || t.freezeOff === false) f.push('<span class="fl bad" title="Mint or freeze authority is still on">AUTH</span>');
  return f.join('');
}
function card(t, k) {
  const pv = P.prev.get(t.mint), fl = pv != null && fin(t.mcap) && Math.abs(t.mcap / pv - 1) > .002 ? (t.mcap > pv ? ' fu' : ' fd') : '';
  const soc = [t.tw && ['𝕏', t.tw], t.web && ['www', t.web], t.tg && ['tg', t.tg]].filter(Boolean).filter(([, u]) => /^https?:\/\//i.test(u)).map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener nofollow" title="${esc(u)}">${l}</a>`).join('');
  return `<div class="pc${fl}" data-m="${esc(t.mint)}" tabindex="0" role="button" aria-label="${esc(t.sym)}">
    <span class="pc-i${k !== 'graduated' && t.prog >= 90 ? ' hot' : ''}" style="--p:${clamp(k === 'graduated' ? 100 : t.prog)}">${icon(t.icon, t.sym, t.mint)}</span>
    <span class="pc-b"><span class="pc-n"><b>${esc(t.sym)}</b><em>${esc(t.name)}</em></span>
      <span class="pc-m"><time>${t.created ? ago(k === 'graduated' && t.grad ? t.grad : t.created) : ''}</time>${fin(t.holders) ? `<span>${amt(t.holders)} holders</span>` : ''}${flags(t)}${soc ? `<span class="soc">${soc}</span>` : ''}</span>
      <span class="pc-k"><span>MC <b>${cmp(t.mcap)}</b></span><span>V <b>${cmp(t.vol)}</b></span>${fin(t.ch5) ? `<span class="${cls(t.ch5)}">${pct(t.ch5, 1)}</span>` : ''}</span></span>
    <span class="pc-r">${k === 'graduated' ? '<span class="pc-tag">PumpSwap</span>' : `<span class="pc-pg${t.prog >= 90 ? ' hot' : ''}">${fin(t.prog) ? t.prog.toFixed(0) + '%' : ''}</span>`}
      <button type="button" class="pc-buy" data-buy="${esc(t.mint)}" ${P.pend.has(t.mint) ? 'disabled' : ''} title="Buy ${P.qb} SOL"><svg viewBox="0 0 24 24"><path d="M13.2 2.5 5 13.6h5.6l-1 7.9 8.4-11.3h-5.7z"/></svg>${P.qb}</button></span></div>`;
}
function stats() {
  const now = Date.now(), R = P.pulse.recent, A = P.pulse.aboutToGraduate, G = P.pulse.graduated; if (!P.at) return;
  const n5 = R.filter(t => t.created && now - t.created < 5 * 60e3).length, n15 = R.filter(t => t.created && now - t.created < 15 * 60e3).length;
  const bond = [...R, ...A].filter(t => t.prog >= 90).length, mig = G.filter(t => t.grad && now - t.grad < 3600e3).length;
  const hot = [...R, ...A, ...G].filter(t => fin(t.ch5)).sort((a, b) => b.ch5 - a.ch5)[0];
  $('#psNew').textContent = n5; $('#psPace').textContent = n15 ? `${(n15 / 15).toFixed(1)} a minute, last 15 min` : 'quiet right now';
  $('#psBond').textContent = bond; $('#psMig').textContent = mig;
  $('#psHot').textContent = hot ? hot.sym : '—'; $('#psHotV').innerHTML = hot ? `<span class="${cls(hot.ch5)}">${pct(hot.ch5, 1)}</span> · MC ${cmp(hot.mcap)}` : '—';
}
function draw() {
  stats();
  for (const [k] of COLS) {
    const box = $(`#pl-${k}`); if (!box) continue;
    const L = sorted(k).filter(pass).slice(0, 40), y = box.scrollTop;
    $(`#pn-${k}`).textContent = L.length;
    box.innerHTML = L.length ? L.map(t => card(t, k)).join('') : `<p class="empty mono">${P.at ? 'Nothing matches.' : 'Reading pump.fun…'}</p>`;
    box.scrollTop = y;
  }
}
async function buy(mint) {
  if (!W.sol.address) { toast('Connect a Solana wallet to buy.', '', 3000); return window.__wallets && window.__wallets(); }
  if (P.pend.has(mint)) return;
  const t = P.by.get(mint), sym = t ? t.sym : 'the coin', sol = P.qb;
  P.pend.add(mint); $$(`[data-buy="${mint}"]`).forEach(b => b.disabled = true);
  toast(`Buying ${sym} for ${sol} SOL. Check your wallet.`, '', 4000);
  try {
    const r = await W.swap({ inputMint: api.SOL_MINT, outputMint: mint, amount: Math.round(sol * 1e9) });
    toast(`Bought ${esc(sym)}. <a href="${solscan(r.sig)}" target="_blank" rel="noopener">View on Solscan</a>`, 'ok', 9000);
  } catch (e) {
    const m = String((e && e.message) || e || 'The buy failed.');
    toast(/reject|denied|cancel|declin/i.test(m) ? 'You cancelled it in your wallet.' : esc(m.length > 160 ? m.slice(0, 157) + '…' : m) + (e && e.sig ? ` <a href="${solscan(e.sig)}" target="_blank" rel="noopener">Solscan</a>` : ''), 'err');
  } finally { P.pend.delete(mint); $$(`[data-buy="${mint}"]`).forEach(b => b.disabled = false); }
}
