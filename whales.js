// BUX · Whales: Hyperliquid's public leaderboard (ranked by the window you pick), any trader's open positions with
// copy / fade into the terminal, and a stakeout on any Solana wallet (holdings priced live through Jupiter).
import { $, $$, esc, px, usd, pct, cls, num, icon, coinIcon, short, toast, copy } from './core.js';
import * as api from './api.js';
import * as W from './wallet.js';

const LB = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';
const H = { rows: null, raw: null, win: 'month', sort: 'pnl', q: '', at: 0 };
let GO = () => {};

export function init(hooks, go) {
  GO = go;
  $('#whTab').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#whTab button').forEach(x => x.classList.toggle('on', x === b)); $('#whHL').hidden = b.dataset.t !== 'hl'; $('#whSOL').hidden = b.dataset.t !== 'sol'; if (b.dataset.t === 'sol') setTimeout(() => $('#soQ').focus(), 30); };
  $('#whWin').onclick = e => { const b = e.target.closest('button'); if (!b) return; H.win = b.dataset.w; $$('#whWin button').forEach(x => x.classList.toggle('on', x === b)); load(); };
  $('#whSort').onclick = e => { const b = e.target.closest('button'); if (!b) return; H.sort = b.dataset.s; $$('#whSort button').forEach(x => x.classList.toggle('on', x === b)); load(); };
  let qt; $('#whQ').oninput = () => { clearTimeout(qt); qt = setTimeout(() => { H.q = $('#whQ').value.trim().toLowerCase(); load(); }, 300); };
  $('#whRows').onclick = e => { const c = e.target.closest('[data-copy]'); if (c) { e.stopPropagation(); copy(c.dataset.copy); return; } const tr = e.target.closest('tr[data-a]'); if (tr) trader(tr.dataset.a, tr.dataset.n); };
  $('#soGo').onclick = () => stakeout($('#soQ').value.trim());
  $('#soQ').onkeydown = e => { if (e.key === 'Enter') stakeout($('#soQ').value.trim()); };
  $('#soMine').onclick = () => { if (!W.sol.address) return window.__wallets && window.__wallets(); $('#soQ').value = W.sol.address; stakeout(W.sol.address); };
  $('#soOut').onclick = e => { const r = e.target.closest('[data-m]'); if (!r) return; window.__buxPick && window.__buxPick(r.dataset.m, 'ape'); GO('trade'); };
  hooks.whales = { show: () => { if (!H.rows || Date.now() - H.at > 5 * 60e3) load(); } };
}

// ---------------------------------------------------------------- the leaderboard
// served boiled down by /api/whales (top 100 per window and sort, cached at the edge); the raw file is the fallback
const memo = new Map();
async function fetchTop(win = H.win, sort = H.sort, q = H.q) {
  const key = win + '|' + sort + '|' + q, hit = memo.get(key);
  if (hit && Date.now() - hit.at < 60e3) return hit.d;
  let d;
  try {
    const r = await fetch(`/api/whales?win=${win}&sort=${sort}${q ? '&q=' + encodeURIComponent(q) : ''}`);
    if (!r.ok) throw new Error('api ' + r.status); d = await r.json(); if (!d || !Array.isArray(d.rows)) throw new Error('bad');
  } catch {
    if (!H.raw) { const r = await fetch(LB, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json();
      H.raw = (j.leaderboardRows || []).map(x => { const w = {}; for (const [k, v] of x.windowPerformances || []) w[k] = [+v.pnl || 0, +v.roi || 0, +v.vlm || 0]; return { a: x.ethAddress, n: x.displayName || '', v: +x.accountValue || 0, w }; }).filter(x => x.a); }
    const si = ['pnl', 'roi', 'vlm'].indexOf(sort);
    let L = q ? H.raw.filter(x => x.a.toLowerCase().includes(q) || x.n.toLowerCase().includes(q)) : H.raw.filter(x => x.v >= 10000 && x.w[win]);
    L = L.slice().sort((a, b) => ((b.w[win] || [])[si] || 0) - ((a.w[win] || [])[si] || 0)).slice(0, 100);
    d = { total: H.raw.length, rows: L.map(x => ({ a: x.a, n: x.n, v: x.v, p: x.w[win] || [0, 0, 0] })) };
  }
  memo.set(key, { at: Date.now(), d }); return d;
}
let lseq = 0;
async function load() {
  const my = ++lseq; $('#whNote').textContent = 'reading the leaderboard…';
  if (!H.rows) $('#whRows').innerHTML = '<tr><td colspan="7" class="muted">Reading the Hyperliquid leaderboard…</td></tr>';
  try {
    const d = await fetchTop(); if (my !== lseq) return;
    H.rows = d.rows; H.total = d.total; H.at = Date.now(); $('#whNote').textContent = num(d.total || 0, 0) + ' traders · public Hyperliquid leaderboard';
    draw();
  } catch { if (my === lseq) { $('#whRows').innerHTML = '<tr><td colspan="7" class="muted">The Hyperliquid leaderboard is not answering. Try again in a moment.</td></tr>'; $('#whNote').textContent = ''; } }
}
function draw() {
  if (!H.rows) return;
  const win = { day: '24h', week: '7d', month: '30d', allTime: 'all time' }[H.win];
  const R = H.rows, pnl = R.reduce((a, x) => a + (x.p[0] || 0), 0), roi = R.reduce((a, x) => a + (x.p[1] || 0), 0) / (R.length || 1), top = R.slice().sort((a, b) => (b.p[0] || 0) - (a.p[0] || 0))[0];
  $('#wsPnl').innerHTML = `<span class="${cls(pnl)}">${pnl > 0 ? '+' : ''}${usd(pnl)}</span>`; $('#wsWin').textContent = H.q ? 'matching traders' : win;
  $('#wsRoi').innerHTML = `<span class="${cls(roi)}">${pct(roi * 100, 1)}</span>`;
  $('#wsTop').textContent = top ? (top.n || short(top.a)) : '—'; $('#wsTopV').innerHTML = top ? `<span class="${cls(top.p[0])}">+${usd(top.p[0])}</span> ${win}` : '—';
  $('#wsN').textContent = H.total ? num(H.total, 0) : '—';
  $('#whTbl thead').innerHTML = `<tr><th>#</th><th>Trader</th><th>Account</th><th>PnL ${win}</th><th>ROI ${win}</th><th>Volume ${win}</th><th></th></tr>`;
  $('#whRows').innerHTML = H.rows.length ? H.rows.map((x, i) => {
    const [pnl, roi, vlm] = x.p || [0, 0, 0];
    return `<tr data-a="${esc(x.a)}" data-n="${esc(x.n)}"><td class="rk">${i + 1}</td><td><div class="wn"><span class="av" style="--h:${parseInt(x.a.slice(2, 8), 16) % 360}"></span><b>${x.n ? esc(x.n) : short(x.a)}</b>${x.n ? `<small>${short(x.a)}</small>` : ''}<button type="button" class="cp" data-copy="${esc(x.a)}" title="Copy address">⧉</button></div></td>
      <td>${usd(x.v)}</td><td class="${cls(pnl)}">${pnl > 0 ? '+' : ''}${usd(pnl)}</td><td class="${cls(roi)}">${pct((roi || 0) * 100, 1)}</td><td>${usd(vlm)}</td><td class="acts"><button type="button" class="hd">Positions</button></td></tr>`;
  }).join('') : '<tr><td colspan="7" class="muted">No trader matches.</td></tr>';
}

// ---------------------------------------------------------------- one trader: open positions, copy or fade
async function trader(addr, name) {
  const m = $('#modal'), b = $('#mBody'); $('#mTitle').textContent = name || short(addr);
  b.innerHTML = '<p class="m-note">Reading their account on Hyperliquid…</p>'; m.hidden = false;
  try {
    const a = await api.account(addr);
    const pos = (a.assetPositions || []).map(x => x.position).filter(Boolean).map(p => ({ coin: p.coin, szi: +p.szi, entry: +p.entryPx, upnl: +p.unrealizedPnl, roe: +p.returnOnEquity, liq: p.liquidationPx ? +p.liquidationPx : null, val: +p.positionValue, lev: p.leverage && p.leverage.value }))
      .sort((x, y) => Math.abs(y.val) - Math.abs(x.val));
    const eq = +a.marginSummary.accountValue, ntl = +a.marginSummary.totalNtlPos, up = pos.reduce((s, p) => s + p.upnl, 0);
    b.innerHTML = `<div class="wh-k mono"><div><span>Account</span><b>${usd(eq)}</b></div><div><span>Open notional</span><b>${usd(ntl)}</b></div><div><span>Unrealized</span><b class="${cls(up)}">${up > 0 ? '+' : ''}${usd(up)}</b></div><div><span>Leverage</span><b>${eq ? (ntl / eq).toFixed(2) + 'x' : '—'}</b></div></div>
      ${pos.length ? `<div class="wh-pos mono">${pos.map(p => { const long = p.szi > 0, mark = api.mids[p.coin] || (api.perps.by[p.coin] || {}).mark;
        return `<div class="wp"><div class="wp-h">${coinIcon(p.coin, 'ci')}<b>${esc(p.coin)}</b><span class="tag ${long ? 'up' : 'dn'}">${long ? 'LONG' : 'SHORT'} ${p.lev ? p.lev + 'x' : ''}</span><em class="${cls(p.upnl)}">${p.upnl > 0 ? '+' : ''}${usd(p.upnl)} · ${pct((p.roe || 0) * 100, 1)}</em></div>
          <div class="wp-k"><span>Size <b>${usd(Math.abs(p.val))}</b></span><span>Entry <b>${px(p.entry)}</b></span><span>Mark <b>${mark ? px(mark) : '—'}</b></span><span>Liq <b>${p.liq ? px(p.liq) : '—'}</b></span></div>
          <div class="wp-a"><button type="button" class="lg" data-c="${esc(p.coin)}" data-s="${long ? 'long' : 'short'}">Copy · ${long ? 'long' : 'short'}</button><button type="button" class="sh" data-c="${esc(p.coin)}" data-s="${long ? 'short' : 'long'}">Fade · ${long ? 'short' : 'long'}</button></div></div>`; }).join('')}</div>`
        : '<p class="m-note">No open positions right now.</p>'}
      <p class="m-note">Live from Hyperliquid's public API. Copying opens the same perp in the terminal; you pick the size and sign it yourself.</p>
      <a class="wbtn" href="https://app.hyperliquid.xyz/explorer/address/${esc(addr)}" target="_blank" rel="noopener"><b>Open in Hyperliquid's explorer</b><em>↗</em></a>`;
    b.onclick = e => { const x = e.target.closest('button[data-c]'); if (!x) return; m.hidden = true; window.__buxPerp && window.__buxPerp(x.dataset.c, x.dataset.s); GO('trade'); toast(`${x.dataset.s === 'long' ? 'Long' : 'Short'} ${esc(x.dataset.c)} is ready in the terminal. Set your size and sign.`, '', 4000); };
  } catch { b.innerHTML = '<p class="m-note">Hyperliquid is not answering right now. Try again in a moment.</p>'; }
}

// ---------------------------------------------------------------- stakeout: any Solana wallet, priced live
let soSeq = 0;
async function stakeout(addr) {
  const out = $('#soOut');
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) { out.innerHTML = '<p class="empty mono">That is not a Solana address.</p>'; return; }
  const my = ++soSeq; out.innerHTML = '<div class="sk" style="height:220px;border-radius:16px"></div>';
  try {
    const h = await api.holdings(addr); if (my !== soSeq) return;
    const toks = Object.entries(h.tokens || {}).map(([mint, accs]) => ({ mint, ui: accs.reduce((s, a) => s + (+a.uiAmount || 0), 0) })).filter(x => x.ui > 0);
    const meta = await api.tokens(toks.map(x => x.mint).slice(0, 270)); if (my !== soSeq) return;
    const by = Object.fromEntries(meta.map(m => [m.mint, m])), solUi = +h.uiAmount || (+h.amount || 0) / 1e9, solPx = api.mids.SOL || (api.perps.by.SOL || {}).mark || 0;
    const rows = toks.map(x => { const m = by[x.mint] || {}; return { ...x, sym: m.symbol || short(x.mint), name: m.name || '', icon: m.icon, usd: m.price ? m.price * x.ui : 0, ch: (m.s24h || {}).priceChange, mcap: m.mcap }; })
      .sort((a, b) => b.usd - a.usd);
    const shown = rows.filter(r => r.usd >= 1), dust = rows.length - shown.length, tot = shown.reduce((s, r) => s + r.usd, 0) + solUi * solPx;
    const top = shown.slice(0, 6), rest = Math.max(0, tot - top.reduce((s, r) => s + r.usd, 0) - solUi * solPx);
    const segs = [{ sym: 'SOL', usd: solUi * solPx }, ...top, { sym: 'Other', usd: rest }].filter(x => x.usd > 0);
    const COL = ['#ff2a8f', '#3fd8ff', '#8a3dff', '#ffd23f', '#2ee6a6', '#ff7a4a', '#b77bff', '#6b6396'];
    out.innerHTML = `<div class="so-h"><div><span class="mono muted">Wallet</span><b class="mono">${short(addr)}</b><button type="button" class="cp" data-copy="${esc(addr)}">⧉</button><a class="mono" href="https://solscan.io/account/${esc(addr)}" target="_blank" rel="noopener">Solscan ↗</a></div>
        <div class="so-k mono"><div><span>Total</span><b>${usd(tot)}</b></div><div><span>SOL</span><b>${solUi.toFixed(3)}</b></div><div><span>Tokens</span><b>${shown.length}</b></div><div><span>Dust</span><b>${dust}</b></div></div></div>
      <div class="alloc">${segs.map((x, i) => `<i style="flex:${x.usd};background:${COL[i % COL.length]}" title="${esc(x.sym)} ${usd(x.usd)}"></i>`).join('')}</div>
      <div class="alloc-l mono">${segs.map((x, i) => `<span><i style="background:${COL[i % COL.length]}"></i>${esc(x.sym)} ${tot ? (x.usd / tot * 100).toFixed(1) : 0}%</span>`).join('')}</div>
      <div class="tbl-wrap"><table class="tbl mono so-t"><thead><tr><th>Token</th><th>Amount</th><th>Value</th><th>24h</th><th>Mcap</th><th></th></tr></thead><tbody>${shown.slice(0, 80).map(r => `<tr data-m="${esc(r.mint)}"><td><div class="pn">${icon(r.icon, r.sym, r.mint)}<b>${esc(r.sym)}</b><small class="nm">${esc(r.name)}</small></div></td><td>${num(r.ui, 2)}</td><td>${usd(r.usd)}</td><td class="${cls(r.ch)}">${pct(r.ch, 1)}</td><td>${usd(r.mcap)}</td><td class="acts"><button type="button" class="lg">Trade</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No tokens worth over $1.</td></tr>'}</tbody></table></div>`;
    out.querySelector('.cp').onclick = e => { e.stopPropagation(); copy(addr); };
  } catch { if (my === soSeq) out.innerHTML = '<p class="empty mono">Could not read that wallet right now. Try again in a moment.</p>'; }
}

// for the overview's whale radar
export const top = (win, sort) => fetchTop(win, sort, '');
export { trader };
