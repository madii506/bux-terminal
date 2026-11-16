// BUX · Overview: the dashboard you land on. A GTA VI countdown with rolling digits, the meme market mood gauge, live
// price tiles with 24h sparklines, top movers, fresh pump.fun launches, who's paying funding, trending coins, the whale
// radar and your bag. Every widget is live and refreshes while the page is open.
import { $, $$, on, esc, px, usd, pct, cls, num, icon, coinIcon, short, reduced } from './core.js';
import * as api from './api.js';
import * as W from './wallet.js';

const KPI = ['SOL', 'BTC', 'ETH', 'HYPE'];
const GTA = new Date('2026-11-19T00:00:00').getTime();
const O = { on: false, timers: [], spark: {}, sparkAt: 0, mv: 'up', counted: false };
const BAD = /hitler|nazi|swastika|\b1488\b|\bkkk\b|holocaust|n[i1!]gg|f[a@]gg[o0]t|\bpedo|\brape\b|\bisis\b/i;
let GO = () => {}, WH = null;

export function init(hooks, go) {
  GO = go;
  hooks.overview = { show, hide };
  $('#mvTab').onclick = e => { const b = e.target.closest('button'); if (!b) return; O.mv = b.dataset.m; $$('#mvTab button').forEach(x => x.classList.toggle('on', x === b)); movers(); };
  $('#ovMovers').onclick = e => { const r = e.target.closest('[data-c]'); if (!r) return; window.__buxPerp && window.__buxPerp(r.dataset.c, O.mv === 'up' ? 'long' : 'short'); GO('trade'); };
  $('#ovFund').onclick = e => { const r = e.target.closest('[data-c]'); if (!r) return; window.__buxPerp && window.__buxPerp(r.dataset.c, r.dataset.s); GO('trade'); };
  $('#ovFresh').onclick = e => { const r = e.target.closest('[data-m]'); if (!r) return; window.__buxPick && window.__buxPick(r.dataset.m, 'ape'); GO('trade'); };
  $('#ovTrend').onclick = e => { const r = e.target.closest('[data-m]'); if (!r) return; window.__buxPick && window.__buxPick(r.dataset.m, 'ape'); GO('trade'); };
  $('#ovKpi').onclick = e => { const r = e.target.closest('[data-c]'); if (!r) return; window.__buxPerp && window.__buxPerp(r.dataset.c, 'long'); GO('trade'); };
  $('#ovWhales').onclick = e => { const r = e.target.closest('[data-a]'); if (!r) return; WH && WH.trader(r.dataset.a, r.dataset.n); };
  $('#ovBag').onclick = e => { if (e.target.closest('[data-act=connect]')) window.__wallets && window.__wallets(); else if (e.target.closest('[data-act=bag]')) GO('bag'); };
  countdown(); setInterval(countdown, 1000);
  on('perps', () => { if (O.on) { mood(); movers(); funding(); kpis(); } });
  on('mids', () => { if (O.on) kpiMids(); });
  on('sol', () => { if (O.on) bag(); }); on('evm', () => { if (O.on) bag(); });
  import('./whales.js?v=1').then(m => { WH = m; if (O.on) whales(); }).catch(() => {});
}
function show() {
  O.on = true; mood(); movers(); funding(); kpis(); fresh(); trend(); whales(); bag();
  O.timers.forEach(clearInterval);
  O.timers = [setInterval(fresh, 8000), setInterval(trend, 60000), setInterval(bag, 6000), setInterval(whales, 120000)];
}
function hide() { O.on = false; O.timers.forEach(clearInterval); O.timers = []; }

// ---------------------------------------------------------------- the countdown, digits roll when they change
function countdown() {
  let s = Math.max(0, Math.floor((GTA - Date.now()) / 1000));
  const v = { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
  for (const u of ['d', 'h', 'm', 's']) {
    const el = $(`#cd b[data-u=${u}]`); if (!el) continue;
    const t = u === 'd' ? String(v.d) : String(v[u]).padStart(2, '0');
    if (el.textContent !== t) { el.textContent = t; if (!reduced()) { el.classList.remove('roll'); void el.offsetWidth; el.classList.add('roll'); } }
  }
  if (s === 0) $('.ov-h').textContent = 'Vice City is open';
}

// ---------------------------------------------------------------- mood: how much of the meme market is up, and who pays funding
function mood() {
  const L = api.perps.list.filter(p => p.meme && p.oi > 0); if (!L.length) return;
  const up = L.filter(p => p.chg > 0).length, oi = L.reduce((s, p) => s + p.oi, 0), f = L.reduce((s, p) => s + p.apr * p.oi, 0) / (oi || 1);
  const avgCh = L.reduce((s, p) => s + Math.max(-30, Math.min(30, p.chg || 0)), 0) / L.length;
  const score = Math.round(Math.max(0, Math.min(100, up / L.length * 70 + 15 + avgCh * 1.2 + Math.max(-10, Math.min(10, f / 4)))));
  const lab = score < 22 ? 'Extreme fear' : score < 42 ? 'Fear' : score < 58 ? 'Neutral' : score < 78 ? 'Greed' : 'Extreme greed';
  $('#gNeedle').style.transform = `rotate(${-90 + score * 1.8}deg)`;
  $('#moodV').textContent = score; $('#moodL').textContent = lab; $('#moodV').className = score < 42 ? 'dn' : score > 58 ? 'up' : '';
  $('#moodUp').innerHTML = `<span class="up">${up}</span>`; $('#moodDn').innerHTML = `<span class="dn">${L.length - up}</span>`;
  $('#moodF').innerHTML = `<span class="${cls(f)}">${f >= 0 ? '+' : ''}${f.toFixed(1)}%</span>`;
}

// ---------------------------------------------------------------- price tiles with 24h sparklines
async function sparks() {
  if (Date.now() - O.sparkAt < 10 * 60e3 && Object.keys(O.spark).length === KPI.length) return;
  O.sparkAt = Date.now();
  await Promise.all(KPI.map(c => api.candles(c, '1h', 26 * 3600e3).then(a => { O.spark[c] = a.slice(-25).map(k => k.c); }).catch(() => {})));
}
function path(arr, w, h) {
  if (!arr || arr.length < 2) return { l: '', a: '' };
  const lo = Math.min(...arr), hi = Math.max(...arr), sx = w / (arr.length - 1), y = v => h - 3 - (hi === lo ? .5 : (v - lo) / (hi - lo)) * (h - 6);
  const l = arr.map((v, i) => `${i ? 'L' : 'M'}${(i * sx).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return { l, a: `${l} L${w} ${h} L0 ${h} Z` };
}
async function kpis() {
  if (!api.perps.list.length) return;
  const box = $('#ovKpi');
  if (!box.children.length) box.innerHTML = KPI.map(c => `<button type="button" class="kpi" data-c="${c}"><div class="kpi-h">${coinIcon(c, 'ci')}<b>${c}</b><em class="kc">—</em></div><div class="kpi-p mono" data-p>—</div><svg class="spark" viewBox="0 0 200 54" preserveAspectRatio="none"><defs><linearGradient id="sg-${c}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".35"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><path class="sa" fill="url(#sg-${c})"/><path class="sl" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><div class="kpi-f mono"><span>funding <b data-f>—</b></span><span>OI <b data-o>—</b></span></div></button>`).join('');
  await sparks();
  for (const c of KPI) {
    const p = api.perps.by[c], el = box.querySelector(`[data-c=${c}]`); if (!p || !el) continue;
    el.querySelector('.kc').textContent = pct(p.chg, 2); el.querySelector('.kc').className = 'kc ' + cls(p.chg);
    el.classList.toggle('dn', p.chg < 0);
    el.querySelector('[data-f]').textContent = (p.fund * 100).toFixed(4) + '%'; el.querySelector('[data-o]').textContent = usd(p.oi);
    const s = path(O.spark[c], 200, 54); el.querySelector('.sl').setAttribute('d', s.l); el.querySelector('.sa').setAttribute('d', s.a);
    const pe = el.querySelector('[data-p]'), target = api.mids[c] || p.mark;
    if (!O.counted && !reduced()) countUp(pe, target); else pe.textContent = px(target);
  }
  O.counted = true;
}
function kpiMids() { for (const c of KPI) { const v = api.mids[c], el = $(`#ovKpi [data-c=${c}] [data-p]`); if (!v || !el || el.dataset.busy) continue; const old = +el.dataset.v || v; el.dataset.v = v; el.textContent = px(v); if (v !== old) { el.classList.remove('fu', 'fd'); void el.offsetWidth; el.classList.add(v > old ? 'fu' : 'fd'); } } }
function countUp(el, to) {
  el.dataset.busy = 1; const t0 = performance.now(), from = to * .82;
  const step = now => { const k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3); el.textContent = px(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); else { el.textContent = px(to); delete el.dataset.busy; el.dataset.v = to; } };
  requestAnimationFrame(step); setTimeout(() => { if (el.dataset.busy) { el.textContent = px(to); delete el.dataset.busy; } }, 1500);
}

// ---------------------------------------------------------------- movers and funding (meme perps)
function movers() {
  const L = api.perps.list.filter(p => p.meme && p.oi > 0 && p.chg != null).sort((a, b) => O.mv === 'up' ? b.chg - a.chg : a.chg - b.chg).slice(0, 6); if (!L.length) return;
  const mx = Math.max(...L.map(p => Math.abs(p.chg))) || 1;
  $('#ovMovers').innerHTML = L.map((p, i) => `<button type="button" class="mvr" data-c="${esc(p.name)}" style="--i:${i}">${coinIcon(p.name, 'ci')}<b>${esc(p.name)}</b><span class="mono">${px(api.mids[p.name] || p.mark)}</span><em class="mono ${cls(p.chg)}">${pct(p.chg, 1)}</em><i class="bar ${cls(p.chg)}" style="--w:${(Math.abs(p.chg) / mx * 100).toFixed(0)}%"></i></button>`).join('');
}
function funding() {
  const L = api.perps.list.filter(p => p.oi > 1e6 && isFinite(p.apr)); if (!L.length) return;
  const s = L.slice().sort((a, b) => b.apr - a.apr), hi = s.slice(0, 4), lo = s.slice(-4).reverse();
  const row = (p, side) => `<button type="button" class="fur" data-c="${esc(p.name)}" data-s="${side}">${coinIcon(p.name, 'ci')}<b>${esc(p.name)}</b><em class="mono ${cls(p.apr)}">${p.apr >= 0 ? '+' : ''}${p.apr.toFixed(1)}%</em><span class="mono">${side === 'short' ? 'short to earn' : 'long to earn'}</span></button>`;
  $('#ovFund').innerHTML = `<p class="fu-t mono">Longs are paying</p>${hi.map(p => row(p, 'short')).join('')}<p class="fu-t mono">Shorts are paying</p>${lo.map(p => row(p, 'long')).join('')}`;
}

// ---------------------------------------------------------------- fresh pump.fun launches (Jupiter's gems feed)
async function fresh() {
  try {
    const f = { timeframe: '24h', launchpads: ['pump.fun'] };
    const r = await fetch('https://datapi.jup.ag/v1/pools/gems', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recent: f }) });
    const d = await r.json(), L = ((d.recent && d.recent.pools) || []).map(p => ({ b: p.baseAsset || {}, prog: p.bondingCurve })).filter(x => x.b.id && (x.b.symbol || x.b.name) && !BAD.test((x.b.symbol || '') + ' ' + (x.b.name || '')))
      .sort((a, b) => Date.parse(b.b.createdAt || 0) - Date.parse(a.b.createdAt || 0)).slice(0, 6);
    const ago = t => { const s = Math.max(0, (Date.now() - Date.parse(t)) / 1000); return s < 60 ? Math.floor(s) + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : Math.floor(s / 3600) + 'h'; };
    $('#ovFresh').innerHTML = L.map(({ b, prog }) => `<button type="button" class="frr" data-m="${esc(b.id)}"><span class="pc-i sm" style="--p:${Math.max(0, Math.min(100, +prog || 0))}">${icon(/^https:/.test(b.icon || '') ? b.icon : '', b.symbol, b.id)}</span><div><b>${esc(b.symbol || '')}</b><span>${esc(b.name || '')}</span></div><time class="mono">${b.createdAt ? ago(b.createdAt) : ''}</time><em class="mono">${usd(+(b.mcap ?? b.fdv) || 0)}</em></button>`).join('') || '<p class="empty mono">Nothing new this second.</p>';
  } catch { if (!$('#ovFresh .frr')) $('#ovFresh').innerHTML = '<p class="empty mono">pump.fun is quiet right now.</p>'; }
}

// ---------------------------------------------------------------- trending (Jupiter), the whale radar, your bag
async function trend() {
  try {
    const L = (await api.trending('1h', 14)).filter(t => t.mint && t.symbol && !/^(USD|PYUSD|EURC)|USD[A-Z]?$/i.test(t.symbol)).slice(0, 12);
    $('#ovTrend').innerHTML = L.map((t, i) => { const s = t.s1h || {}; return `<button type="button" class="trc" data-m="${esc(t.mint)}" style="--i:${i}"><span class="rk mono">${i + 1}</span>${icon(t.icon, t.symbol, t.mint)}<b>${esc(t.symbol)}</b><span class="mono">${px(t.price)}</span><em class="mono ${cls(s.priceChange)}">${pct(s.priceChange, 1)}</em><small class="mono">${usd(t.mcap)} mcap</small></button>`; }).join('');
  } catch { $('#ovTrend').innerHTML = '<p class="empty mono">Jupiter is not answering right now.</p>'; }
}
async function whales() {
  if (!WH) return;
  try {
    const d = await WH.top('day', 'pnl'), L = (d.rows || []).slice(0, 5);
    $('#ovWhales').innerHTML = L.map((x, i) => `<button type="button" class="whr" data-a="${esc(x.a)}" data-n="${esc(x.n)}"><span class="rk mono">${i + 1}</span><span class="av" style="--h:${parseInt(x.a.slice(2, 8), 16) % 360}"></span><b>${x.n ? esc(x.n) : short(x.a)}</b><em class="mono ${cls(x.p[0])}">${x.p[0] > 0 ? '+' : ''}${usd(x.p[0])}</em><span class="mono">24h · ${usd(x.v)} acct</span></button>`).join('') || '<p class="empty mono">No whales today.</p>';
  } catch { $('#ovWhales').innerHTML = '<p class="empty mono">The leaderboard is not answering right now.</p>'; }
}
function bag() {
  const box = $('#ovBag'), b = window.__bux && window.__bux.bag ? window.__bux.bag() : null;
  if (!W.sol.address && !W.evm.address) { box.innerHTML = `<div class="ovc-h"><b>Your bag</b></div><div class="bag-cta"><p>Connect a Solana wallet for memes and an EVM wallet for Hyperliquid. Your net worth, holdings and positions show up right here.</p><button class="btn btn-g btn-sm" type="button" data-act="connect">Connect wallets</button></div>`; return; }
  const sol = W.sol.address && b ? b.tot : null, hl = b && b.hl ? b.hl.equity : null, pos = b && b.hl ? b.hl.pos.length : 0;
  box.innerHTML = `<div class="ovc-h"><b>Your bag</b><button class="mono lnk" type="button" data-act="bag">open →</button></div>
    <div class="bag-nw"><span class="mono muted">Net worth</span><b>${sol != null || hl != null ? usd((sol || 0) + (hl || 0)) : '—'}</b></div>
    <div class="kv3 mono"><div><span>Solana bag</span><b>${sol != null ? usd(sol) : '—'}</b></div><div><span>Hyperliquid</span><b>${hl != null ? usd(hl) : '—'}</b></div><div><span>Positions</span><b>${W.evm.address ? pos : '—'}</b></div></div>`;
}
