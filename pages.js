// BUX · the pages around the terminal: the live perps tape, trending memes, the perps board, the market map, the hedge story
// and hedge math. Each page draws when it is opened (page hooks), from the same live Hyperliquid and Jupiter data.
import { $, $$, on, esc, px, usd, pct, cls, num, icon, parseNum, reduced, coinIcon } from './core.js';
import * as api from './api.js';

let GO = () => {};
const toTrade = () => GO('trade');
export function init(hooks, go) {
  GO = go;
  on('perps', P => { tape(P); stats(); if (vis('perps')) PV.v === 'map' ? paint() : board(); calcPerps(); });
  if (api.perps.list.length) { tape(api.perps); calcPerps(); stats(); }
  on('mids', () => { tapeMids(); if (vis('perps')) PV.v === 'map' ? heatMids() : boardMids(); });
  calc();
  $('#perpSet').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#perpSet button').forEach(x => x.classList.toggle('on', x === b)); B.set = b.dataset.set; board(); };
  $('#memeTf').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#memeTf button').forEach(x => x.classList.toggle('on', x === b)); memes(b.dataset.tf); };
  $('#heatBy').onclick = e => { const b = e.target.closest('button'); if (!b) return; by = b.dataset.b; $$('#heatBy button').forEach(x => x.classList.toggle('on', x === b)); paint(true); };
  $('#heat').onclick = e => { const t = e.target.closest('.tl'); if (!t) return; window.__buxPerp && window.__buxPerp(t.dataset.c, +t.dataset.ch >= 0 ? 'long' : 'short'); toTrade(); };
  $('#tapeIn').onclick = e => { const t = e.target.closest('.tk'); if (!t) return; window.__buxPerp && window.__buxPerp(t.dataset.c, 'long'); toTrade(); };
  new ResizeObserver(() => { if (vis('perps') && PV.v === 'map') paint(); }).observe($('#heat'));
  $('#perpView').onclick = e => { const b = e.target.closest('button'); if (!b) return; PV.v = b.dataset.v; $$('#perpView button').forEach(x => x.classList.toggle('on', x === b)); $('#pvBoard').hidden = PV.v !== 'board'; $('#pvMap').hidden = PV.v !== 'map'; $('#perpSet').style.visibility = PV.v === 'map' ? 'hidden' : ''; PV.v === 'map' ? requestAnimationFrame(() => paint(true)) : board(); };
  $('#calcGo').onclick = () => { const n = $('#cPerp').value; window.__buxHedgePerp && window.__buxHedgePerp(n); toTrade(); };
  Object.assign(hooks, {
    trending: { show: () => { if (Date.now() - M.at > 60000) memes(M.tf); } },
    perps: { show: () => { stats(); PV.v === 'map' ? requestAnimationFrame(() => paint(true)) : board(); } },
    hedge: { show: () => hedgeStory() },
  });
}
const vis = p => { const s = $(`.page[data-page="${p}"]`); return s && !s.hidden; };

// ---------------------------------------------------------------- tape: every meme perp, live
function tape(P) {
  const m = P.list.filter(p => p.meme).sort((a, b) => b.vol - a.vol); if (!m.length) return;
  const item = p => `<button class="tk" type="button" data-c="${esc(p.name)}">${coinIcon(p.name, 'ci')}<b>${esc(p.name)}</b><em class="tk-p">${px(api.mids[p.name] || p.mark)}</em><em class="${cls(p.chg)}">${pct(p.chg, 1)}</em><span>fund ${(p.fund * 100).toFixed(4)}%</span></button>`;
  const h = m.map(item).join('');
  $('#tapeIn').innerHTML = h + h;
  $('#tapeIn').style.animationDuration = Math.max(50, m.length * 4) + 's';
}
function tapeMids() { $$('#tapeIn .tk').forEach(el => { const v = api.mids[el.dataset.c]; if (v) el.querySelector('.tk-p').textContent = px(v); }); }

// ---------------------------------------------------------------- perps board
const B = { set: 'memes', key: 'vol', dir: -1 };
function board() {
  const L = api.perps.list.filter(p => B.set === 'all' || p.meme); if (!L.length) return;
  const val = p => ({ name: p.name, mark: p.mark, chg: p.chg, fund: p.fund, apr: p.apr, oi: p.oi, vol: p.vol, lev: p.maxLev }[B.key]);
  L.sort((a, b) => { const x = val(a), y = val(b); return typeof x === 'string' ? x.localeCompare(y) * B.dir : ((x ?? -1e18) - (y ?? -1e18)) * B.dir; });
  $('#perpRows').innerHTML = L.map(p => {
    const mint = api.PERP_MINT[p.name];
    return `<tr data-c="${esc(p.name)}"><td><div class="pn">${coinIcon(p.name)}<b>${esc(p.name)}</b>${mint && p.name !== 'SOL' ? '<small>solana</small>' : ''}</div></td><td class="m">${px(api.mids[p.name] || p.mark)}</td><td class="${cls(p.chg)}">${pct(p.chg)}</td><td class="${cls(p.fund)}">${(p.fund * 100).toFixed(4)}%</td><td class="${cls(p.apr)}">${p.apr.toFixed(1)}%</td><td>${usd(p.oi)}</td><td>${usd(p.vol)}</td><td>${p.maxLev}x</td><td class="acts"><button type="button" class="lg" data-x="long" data-n="${esc(p.name)}">Long</button><button type="button" class="sh" data-x="short" data-n="${esc(p.name)}">Short</button>${mint ? `<button type="button" class="hd" data-h="${esc(p.name)}">Hedge</button>` : ''}</td></tr>`;
  }).join('');
  $$('#perpTbl th').forEach(th => th.classList.toggle('sorted', th.dataset.k === B.key));
}
$('#perpTbl thead').onclick = e => { const th = e.target.closest('th[data-k]'); if (!th) return; if (B.key === th.dataset.k) B.dir *= -1; else { B.key = th.dataset.k; B.dir = th.dataset.k === 'name' ? 1 : -1; } board(); };
$('#perpRows').onclick = e => {
  const q = e.target.closest('button[data-x]');
  if (q) { window.__buxPerp && window.__buxPerp(q.dataset.n, q.dataset.x); toTrade(); return; }
  const b = e.target.closest('button[data-h]'); if (!b) return;
  const name = b.dataset.h, mint = api.PERP_MINT[name];
  if (mint && mint !== api.SOL_MINT && window.__buxPick) window.__buxPick(mint, 'hedge');
  window.__buxHedgePerp && window.__buxHedgePerp(name);
  toTrade();
};
const last = {};
function boardMids() {
  $$('#perpRows tr[data-c]').forEach(tr => {
    const c = tr.dataset.c, v = api.mids[c]; if (!v) return;
    const td = tr.querySelector('.m'); if (last[c] && v !== last[c]) { td.classList.remove('flash-u', 'flash-d'); void td.offsetWidth; td.classList.add(v > last[c] ? 'flash-u' : 'flash-d'); }
    last[c] = v; td.textContent = px(v);
  });
}

// ---------------------------------------------------------------- trending memes (Jupiter)
const M = { tf: '1h', at: 0 };
async function memes(tf) {
  const box = $('#memeCards'); M.tf = tf;
  try {
    const list = (await api.trending(tf, 24)).filter(t => t.mint && t.symbol && !/^(USD|PYUSD|EURC)|USD[A-Z]?$/i.test(t.symbol));
    M.at = Date.now();
    const S5 = list.map(t => t['s' + tf] || {}), vol = S5.reduce((a, s) => a + (s.buyVolume || 0) + (s.sellVolume || 0), 0), buy = S5.reduce((a, s) => a + (s.buyVolume || 0), 0);
    const ch = list.map((t, i) => ({ t, c: S5[i].priceChange })).filter(x => x.c != null), top = ch.slice().sort((a, b) => b.c - a.c)[0], avg = ch.reduce((a, x) => a + x.c, 0) / (ch.length || 1);
    $('#tsVol').textContent = usd(vol); $('#tsTf').textContent = `${list.length} trending coins, last ${tf}`;
    $('#tsBuy').innerHTML = vol ? `<span class="${buy / vol >= .5 ? 'up' : 'dn'}">${(buy / vol * 100).toFixed(0)}%</span>` : '—';
    $('#tsTop').textContent = top ? top.t.symbol : '—'; $('#tsTopV').innerHTML = top ? `<span class="${cls(top.c)}">${pct(top.c, 1)}</span> · ${usd(top.t.mcap)} mcap` : '—';
    $('#tsAvg').innerHTML = `<span class="${cls(avg)}">${pct(avg, 1)}</span>`; $('#tsUp').textContent = `${ch.filter(x => x.c > 0).length} up · ${ch.filter(x => x.c <= 0).length} down`;
    box.innerHTML = list.map((t, i) => {
      const s = t['s' + tf] || {}, perp = api.MINT_PERP[t.mint];
      const flow = (s.buyVolume || 0) + (s.sellVolume || 0), buys = flow ? (s.buyVolume || 0) / flow * 100 : null;
      return `<button class="card" data-m="${esc(t.mint)}" type="button" style="--i:${i}"><div class="card-h">${icon(t.icon, t.symbol, t.mint)}<div><b>${esc(t.symbol)}</b><span>${esc(t.name)}</span></div><span class="rank mono">#${i + 1}</span></div>
        <div class="card-p"><b>${px(t.price)}</b><em class="${cls(s.priceChange)}">${pct(s.priceChange, 1)}</em></div>
        <div class="card-m"><div>Mcap<b>${usd(t.mcap)}</b></div><div>Liquidity<b>${usd(t.liq)}</b></div><div>Volume ${tf}<b>${usd(flow)}</b></div><div>Traders<b>${num(s.numTraders || 0, 1)}</b></div></div>
        <div class="pb" title="Buy share of volume"><i style="width:${buys != null ? buys.toFixed(0) : 50}%"></i></div>
        <span class="badge ${perp ? '' : 'no'}">${perp ? 'own perp: ' + esc(perp) : 'hedge with SOL'}</span></button>`;
    }).join('') || '<p class="empty mono">Nothing trending right now.</p>';
  } catch { box.innerHTML = '<p class="empty mono">Jupiter is not answering. Try again in a moment.</p>'; }
  box.onclick = e => { const c = e.target.closest('.card'); if (!c) return; window.__buxPick && window.__buxPick(c.dataset.m, 'ape'); toTrade(); };
}

// ---------------------------------------------------------------- market map: a treemap of meme perps (size = OI or volume, colour = 24h)
let by = 'oi', painted = false;
const PV = { v: 'board' };
function stats() {
  const L = api.perps.list.filter(p => p.meme && p.oi > 0); if (!L.length) return;
  const up = L.filter(p => p.chg > 0).length, oi = L.reduce((s, p) => s + p.oi, 0), vol = L.reduce((s, p) => s + p.vol, 0);
  const fund = L.reduce((s, p) => s + p.apr * p.oi, 0) / (oi || 1), top = L.slice().sort((a, b) => b.chg - a.chg)[0];
  $('#msN').textContent = L.length; $('#msUD').innerHTML = `<span class="up">${up} up</span> · <span class="dn">${L.length - up} down</span>`;
  $('#msOI').textContent = usd(oi); $('#msVol').textContent = usd(vol); $('#msTop').innerHTML = top ? `top: ${esc(top.name)} <span class="${cls(top.chg)}">${pct(top.chg, 1)}</span>` : '—';
  const f = $('#msFund'); f.textContent = (fund >= 0 ? '+' : '') + fund.toFixed(1) + '%'; f.className = cls(fund);
}
function paint(fresh) {
  const L = api.perps.list.filter(p => p.meme && p.oi > 0); if (!L.length) return;
  const box = $('#heat'), W = box.clientWidth, H = box.clientHeight; if (!W || !H) return;
  const items = L.map(p => ({ p, v: Math.max(1, by === 'oi' ? p.oi : p.vol) })).sort((a, b) => b.v - a.v).slice(0, 26);
  const rects = squarify(items, 0, 0, W, H);
  box.innerHTML = rects.map(({ p, x, y, w, h }, i) => {
    const c = Math.max(-12, Math.min(12, p.chg || 0)) / 12, a = .2 + Math.abs(c) * .6;
    const bg = c >= 0 ? `rgba(46,230,166,${a.toFixed(2)})` : `rgba(255,77,125,${a.toFixed(2)})`;
    const big = w > 120 && h > 84, mid = w > 70 && h > 52, tiny = w < 46 || h < 30;
    return `<button class="tl ${big ? 'big' : mid ? 'mid' : 'sm'}${fresh && !reduced() ? ' pop' : ''}" type="button" data-c="${esc(p.name)}" data-ch="${p.chg || 0}" style="--i:${i};left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${(w - 3).toFixed(1)}px;height:${(h - 3).toFixed(1)}px;background:${bg}" title="${esc(p.name)} ${pct(p.chg)}">
      ${mid ? coinIcon(p.name, 'hi') : ''}${tiny ? '' : `<b>${esc(p.name)}</b>`}${mid ? `<em>${pct(p.chg, 1)}</em>` : ''}${big ? `<span class="tp">${px(api.mids[p.name] || p.mark)}</span>` : ''}</button>`;
  }).join('');
  painted = true;
}
function heatMids() { $$('#heat .tl').forEach(t => { const v = api.mids[t.dataset.c]; if (v) { const e = t.querySelector('.tp'); if (e) e.textContent = px(v); } }); }
function squarify(items, x, y, w, h) {                                                        // squarified treemap (Bruls et al.)
  const total = items.reduce((s, i) => s + i.v, 0), area = w * h, out = [];
  let rest = items.map(i => ({ ...i, a: i.v / total * area }));
  while (rest.length) {
    const short = Math.min(w, h); let row = [rest[0]], best = worst(row, short), i = 1;
    while (i < rest.length) { const next = [...row, rest[i]], wv = worst(next, short); if (wv > best) break; row = next; best = wv; i++; }
    const sum = row.reduce((s, r) => s + r.a, 0);
    if (w >= h) { const cw = sum / h; let cy = y; for (const r of row) { const rh = r.a / cw; out.push({ p: r.p, x, y: cy, w: cw, h: rh }); cy += rh; } x += cw; w -= cw; }
    else { const ch = sum / w; let cx = x; for (const r of row) { const rw = r.a / ch; out.push({ p: r.p, x: cx, y, w: rw, h: ch }); cx += rw; } y += ch; h -= ch; }
    rest = rest.slice(row.length);
  }
  return out;
}
function worst(row, s) { const sum = row.reduce((a, r) => a + r.a, 0), mx = Math.max(...row.map(r => r.a)), mn = Math.min(...row.map(r => r.a)); return Math.max(s * s * mx / (sum * sum), (sum * sum) / (s * s * mn)); }

// ---------------------------------------------------------------- the hedge story: a real meme perp, a real SOL short, the net (7 days, hourly)
const HS = { D: null, prog: 0, raf: 0, loading: null };
function hsDraw() {
  const cv = $('#hedgeCv'), box = cv.parentElement, dpr = Math.min(2, devicePixelRatio || 1), w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
  cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const D = HS.D; if (!D) return;
  const all = [...D.coin, ...D.hedge, ...D.net]; const lo = Math.min(...all, -5), hi = Math.max(...all, 5);
  const pad = 26, y = v => pad + (hi - v) / (hi - lo) * (h - pad * 2 - 30), x = i => pad + i / (D.coin.length - 1) * (w - pad * 2);
  g.strokeStyle = 'rgba(190,170,255,.12)'; g.setLineDash([3, 5]); g.beginPath(); g.moveTo(pad, y(0)); g.lineTo(w - pad, y(0)); g.stroke(); g.setLineDash([]);
  g.font = '10.5px JBM, monospace'; g.fillStyle = '#6b6396'; g.fillText('0%', w - pad - 16, y(0) - 6);
  const line = (arr, col, p, wd) => { const n = Math.max(2, Math.floor(arr.length * Math.min(1, Math.max(0, p)))); g.strokeStyle = col; g.lineWidth = wd; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i < n; i++) i ? g.lineTo(x(i), y(arr[i])) : g.moveTo(x(i), y(arr[i])); g.stroke(); if (p > 0 && p < 1.001) { g.fillStyle = col; g.beginPath(); g.arc(x(n - 1), y(arr[n - 1]), 3.5, 0, 7); g.fill(); } };
  const p = HS.prog;
  line(D.coin, '#2ee6a6', p * 3, 2);
  if (p > .33) line(D.hedge, '#ff4d7d', (p - .33) * 3, 2);
  if (p > .66) line(D.net, '#f5f1ff', (p - .66) * 3, 2.6);
  const k = p < .33 ? 0 : p < .66 ? 1 : 2; $$('#beats li').forEach((b, i) => b.classList.toggle('on', i <= k));
}
async function hsLoad() {
  if (HS.D) return; if (HS.loading) return HS.loading;
  return (HS.loading = (async () => {
    try {
      const coin = 'FARTCOIN', ms = 7 * 864e5;
      const [a, s] = await Promise.all([api.candles(coin, '1h', ms), api.candles('SOL', '1h', ms)]);
      const n = Math.min(a.length, s.length); const A = a.slice(-n), S = s.slice(-n);
      const ra = A.map((k, i) => i ? Math.log(k.c / A[i - 1].c) : 0), rs = S.map((k, i) => i ? Math.log(k.c / S[i - 1].c) : 0);
      const ma = ra.reduce((p, v) => p + v, 0) / n, msol = rs.reduce((p, v) => p + v, 0) / n;
      let cov = 0, vs = 0; for (let i = 1; i < n; i++) { cov += (ra[i] - ma) * (rs[i] - msol); vs += (rs[i] - msol) ** 2; }
      const beta = Math.max(.3, Math.min(4, cov / (vs || 1))), c0 = A[0].c, s0 = S[0].c;
      const D = { coin: A.map(k => (k.c / c0 - 1) * 100), hedge: S.map(k => -beta * (k.c / s0 - 1) * 100) }; D.net = D.coin.map((v, i) => v + D.hedge[i]);
      const dd = arr => { let pk = -1e9, m = 0; for (const v of arr) { const e = 100 + v; pk = Math.max(pk, e); m = Math.min(m, (e / pk - 1) * 100); } return m; };
      $('#hedgeLeg').innerHTML = `<span><i class="sw g"></i>${coin} <b class="${cls(D.coin[n - 1])}">${pct(D.coin[n - 1], 1)}</b></span><span><i class="sw r"></i>SOL short ×${beta.toFixed(2)} <b class="${cls(D.hedge[n - 1])}">${pct(D.hedge[n - 1], 1)}</b></span><span><i class="sw" style="background:#f5f1ff"></i>net <b class="${cls(D.net[n - 1])}">${pct(D.net[n - 1], 1)}</b></span><span>worst dip: bag ${dd(D.coin).toFixed(1)}% · net ${dd(D.net).toFixed(1)}%</span>`;
      $('#hedgeCap').textContent = `${coin} vs a β ${beta.toFixed(2)} SOL short · Hyperliquid · 7 days, hourly`;
      HS.D = D;
    } catch { $('#hedgeCap').textContent = 'Hyperliquid is not answering right now.'; }
  })());
}
let hsObs = false;
async function hedgeStory() {
  if (!hsObs) { hsObs = true; new ResizeObserver(hsDraw).observe($('#hedgeCv').parentElement); }
  await hsLoad();
  cancelAnimationFrame(HS.raf);
  if (reduced()) { HS.prog = 1; hsDraw(); return; }
  const t0 = performance.now();
  const step = now => { HS.prog = Math.min(1.02, (now - t0) / 3200 * 1.02); hsDraw(); if (HS.prog < 1.02 && vis('hedge')) HS.raf = requestAnimationFrame(step); };
  HS.raf = requestAnimationFrame(step);
  setTimeout(() => { if (HS.prog < 1) { HS.prog = 1.02; hsDraw(); } }, 4200);                 // background tabs pause rAF: always land on the full picture
}

// ---------------------------------------------------------------- hedge math
function calcPerps() {
  const sel = $('#cPerp'); if (sel.options.length > 2 || !api.perps.list.length) return;
  const m = api.perps.list.filter(p => p.meme).sort((a, b) => b.vol - a.vol).slice(0, 30);
  const maj = ['SOL', 'BTC', 'ETH'].map(n => api.perps.by[n]).filter(Boolean);
  sel.innerHTML = [...maj, ...m].map(p => `<option value="${esc(p.name)}" ${p.name === 'SOL' ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  calcRun();
}
function calc() {
  ['cBag', 'cPerp', 'cPct', 'cLev', 'cCoin', 'cPerpMv'].forEach(id => $('#' + id).addEventListener('input', calcRun));
  if (!$('#cPerp').options.length) $('#cPerp').innerHTML = '<option value="SOL">SOL</option>';
  calcRun();
}
function calcRun() {
  const bag = parseNum($('#cBag').value) || 0, pc = +$('#cPct').value / 100, lev = +$('#cLev').value, cm = +$('#cCoin').value / 100, pm = +$('#cPerpMv').value / 100;
  const p = api.perps.by[$('#cPerp').value];
  $('#cPctV').textContent = Math.round(pc * 100) + '%'; $('#cLevV').textContent = lev + 'x';
  $('#cCoinV').textContent = (cm > 0 ? '+' : '') + Math.round(cm * 100) + '%'; $('#cPerpV').textContent = (pm > 0 ? '+' : '') + Math.round(pm * 100) + '%';
  const sh = bag * pc, liq = (1 / lev - (p ? 1 / (2 * p.maxLev) : .02));
  const shortPnl = pm >= liq ? -sh / lev : -sh * pm;                                    // a short that gets liquidated loses its margin
  const bagPnl = bag * cm, netPnl = bagPnl + shortPnl;
  const set = (id, v) => { const e = $(id); e.textContent = (v > 0 ? '+' : '') + usd(v); e.className = cls(v); };
  set('#oBag', bagPnl); set('#oShort', shortPnl); set('#oNet', netPnl);
  const f = p ? sh * p.fund * 24 : null;
  $('#oKv').innerHTML = [['Short size', usd(sh)], ['Margin locked', usd(sh / lev)], ['Liquidated if the perp pumps', '≈ +' + (liq * 100).toFixed(0) + '%'], ['Funding now', f == null ? '—' : `${f >= 0 ? 'earn' : 'pay'} ${usd(Math.abs(f))}/day`], ['Unhedged result', usd(bagPnl)], ['Hedge saved', usd(netPnl - bagPnl)]].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  const rows = [['Market dumps', -.5, -.15], ['Your coin rugs alone', -.8, 0], ['Everything pumps', 1, .2], ['Coin pumps, market flat', .6, 0]];
  $('#oScen tbody').innerHTML = rows.map(([n, c, q]) => { const s2 = q >= liq ? -sh / lev : -sh * q, u = bag * c, hdg = u + s2; return `<tr><td>${n}</td><td class="${cls(c)}">${c > 0 ? '+' : ''}${c * 100}%</td><td class="${cls(q)}">${q > 0 ? '+' : ''}${q * 100}%</td><td class="${cls(u)}">${usd(u)}</td><td class="${cls(hdg)}">${usd(hdg)}</td></tr>`; }).join('');
}
