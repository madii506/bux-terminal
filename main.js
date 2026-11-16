// BUX · boot: the home (the night city with BUX in the middle: enter or connect), the page router, the wallet modal, the palette, live data
import { $, $$, on, esc, store, short, toast, CONFIG, copy, px, usd, icon, brand, reduced } from './core.js';
import * as api from './api.js';
import * as W from './wallet.js';
import * as T from './tools.js';

const html = document.documentElement;
const PAGES = ['overview', 'trade', 'pump', 'trending', 'perps', 'whales', 'hedge', 'bag', 'faq'];
const TITLES = { overview: 'Overview', trade: 'Trade', pump: 'Pump', trending: 'Trending', perps: 'Perps', whales: 'Whales', hedge: 'Hedge', bag: 'Bag', faq: 'FAQ' };
const hooks = {};                                   // page name -> { show, hide } registered by the page modules
export const pageHooks = hooks;
let page = null;

// ---------------------------------------------------------------- router
function go(p, { push = true } = {}) {
  if (p === 'market') { p = 'perps'; setTimeout(() => { const b = $('#perpView button[data-v=map]'); b && b.click(); }, 30); }
  if (!PAGES.includes(p)) p = 'overview';
  if (page === p) { scrollTo(0, 0); return; }
  const prev = page; page = p;
  $$('.page[data-page]').forEach(s => { s.hidden = s.dataset.page !== p; });
  $$('#links a, #mSheet a, #tabbar a').forEach(a => a.classList.toggle('on', a.dataset.go === p)); $('#navTitle').textContent = TITLES[p];
  html.dataset.view = p;
  if (push) history.replaceState(null, '', location.pathname + location.search + '#' + p);
  scrollTo(0, 0);
  if (prev && hooks[prev] && hooks[prev].hide) hooks[prev].hide();
  if (hooks[p] && hooks[p].show) hooks[p].show();
  const sec = $(`.page[data-page="${p}"]`); if (sec && !reduced()) { sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter'); }
}
window.__go = go;
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-go]'); if (!a) return;
  e.preventDefault(); $('#mSheet').hidden = true; go(a.dataset.go);
});
addEventListener('hashchange', () => { const p = location.hash.slice(1); if ((PAGES.includes(p) || p === 'market') && !html.classList.contains('home')) go(p, { push: false }); });

// ---------------------------------------------------------------- home: the night city
let club = null, entering = false, booted = false;
const startPage = () => { const h = location.hash.slice(1); return PAGES.includes(h) ? h : new URLSearchParams(location.search).has('t') ? 'trade' : 'overview'; };
async function makeHome() {
  if (club) { club.pause(false); club.reset(); introEnds(1300); return; }
  try {
    await Promise.race([document.fonts.load('40px Anton'), new Promise(r => setTimeout(r, 1200))]);
    const m = await import('./city.js?v=8');
    club = m.startCity($('#city'), { reduced: reduced(), header: $('#homeTitle'), onStart: skipped => introEnds(reduced() || skipped ? 0 : 5300) });
  } catch (e) { console.error(e); introEnds(0); }
}
// the intro plays once: the camera comes down out of the sky into its circle round downtown; any tap skips it
let introT = 0;
function introEnds(ms) { clearTimeout(introT); html.classList.remove('intro-done'); introT = setTimeout(() => html.classList.add('intro-done'), ms); }
function skipIntro() { if (html.classList.contains('intro-done') || !html.classList.contains('home')) return; if (club) club.skip(); clearTimeout(introT); setTimeout(() => html.classList.add('intro-done'), 600); }
$('#home').addEventListener('pointerdown', e => { if (!e.target.closest('.home-cta')) skipIntro(); });
addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === ' ') skipIntro(); });
async function enter() {
  if (entering || !html.classList.contains('home')) return;
  entering = true; $('#enterBtn').disabled = true;
  html.classList.add('opening');
  try { if (club && !reduced()) await club.enter(); } catch {}
  const f = $('#flash'); f.classList.add('on');
  setTimeout(() => {
    html.classList.add('flashing'); html.classList.remove('home', 'opening'); boot(); go(CONFIG.ca && !page ? 'trade' : page || startPage(), { push: true });
    setTimeout(() => html.classList.remove('flashing'), 900);
    if (club) club.pause(true);
    setTimeout(() => f.classList.remove('on'), 60);
    entering = false; $('#enterBtn').disabled = false;
  }, reduced() ? 0 : 240);
}
function home() {
  if (html.classList.contains('home')) return;
  if (page && hooks[page] && hooks[page].hide) hooks[page].hide();
  html.classList.add('home'); window.scrollTo(0, 0);
  makeHome();
}
$('#enterBtn').onclick = enter;
$('#homeConnect').onclick = () => openWallets();
$('#homeBtn').onclick = home;
addEventListener('keydown', e => { if (html.classList.contains('home') && e.key === 'Enter' && $('#modal').hidden && document.activeElement === document.body) enter(); });

// ---------------------------------------------------------------- nav: phone sheet, X, CA
const mb = $('#menuBtn'), ms = $('#mSheet');
mb.addEventListener('click', () => { ms.hidden = !ms.hidden; mb.setAttribute('aria-expanded', String(!ms.hidden)); });
$('#tabMore').onclick = () => { ms.hidden = !ms.hidden; };
addEventListener('scroll', () => $('#nav').classList.toggle('solid', scrollY > 8), { passive: true });
if (CONFIG.x) { const x = $('#navX'); x.hidden = false; x.href = /^https?:/.test(CONFIG.x) ? CONFIG.x : 'https://x.com/' + CONFIG.x.replace(/^@/, ''); }
if (CONFIG.ca) {
  $('#caBox').hidden = false; $('#caTxt').textContent = CONFIG.ca; $('#caCopy').onclick = () => copy(CONFIG.ca);
  const cc = $('#caChip'); if (cc) { cc.hidden = false; $('#caChipTxt').textContent = short(CONFIG.ca); cc.onclick = () => copy(CONFIG.ca); }
  $('#caBuy').href = 'https://pump.fun/coin/' + CONFIG.ca; $('#caChart').href = 'https://dexscreener.com/solana/' + CONFIG.ca;
}

// ---------------------------------------------------------------- wallet modal (both sides in one place)
export function openWallets() {
  const m = $('#modal'), b = $('#mBody'); $('#mTitle').textContent = 'Connect';
  const draw = () => {
    const sw = W.sol.list, ew = W.evm.list.length ? W.evm.list : (W.legacyEvm() ? [{ info: { uuid: 'legacy', name: 'Browser wallet', icon: '' } }] : []);
    const ag = W.agent();
    b.innerHTML = `
      <div class="m-sec"><span>Solana · for trading memes</span>
        ${W.sol.address ? `<button class="wbtn on" data-a="sol-off" type="button"><b>${esc(W.sol.w.name)}</b><em>${short(W.sol.address)} · disconnect</em></button>`
          : sw.length ? sw.map(w => `<button class="wbtn" data-sol="${esc(w.name)}" type="button">${w.icon ? `<img src="${esc(w.icon)}" alt="">` : ''}<b>${esc(w.name)}</b><em>connect</em></button>`).join('')
          : ['phantom.com|Phantom|https://phantom.com/download', 'solflare.com|Solflare|https://solflare.com/download', 'backpack.app|Backpack|https://backpack.app/download'].map(s => { const [d, n, u] = s.split('|'); return `<a class="wbtn" href="${u}" target="_blank" rel="noopener"><img src="${brand(d)}" alt=""><b>${n}</b><em>install ↗</em></a>`; }).join('')}
      </div>
      <div class="m-sec"><span>EVM · for perps and hedges on Hyperliquid</span>
        ${W.evm.address ? `<button class="wbtn on" data-a="evm-off" type="button"><b>${esc(W.evm.name)}</b><em>${short(W.evm.address)} · disconnect</em></button>
            ${ag ? `<button class="wbtn on" data-a="agent-off" type="button"><b>Session key</b><em>${short(ag.address)} · forget</em></button>` : `<button class="wbtn" data-a="agent" type="button"><b>Approve session key</b><em>one signature</em></button>`}`
          : ew.length ? ew.map(d => `<button class="wbtn" data-evm="${esc(d.info.uuid)}" type="button">${d.info.icon ? `<img src="${esc(d.info.icon)}" alt="">` : ''}<b>${esc(d.info.name)}</b><em>connect</em></button>`).join('')
          : ['metamask.io|MetaMask|https://metamask.io/download', 'rabby.io|Rabby|https://rabby.io', 'phantom.com|Phantom|https://phantom.com/download'].map(s => { const [d, n, u] = s.split('|'); return `<a class="wbtn" href="${u}" target="_blank" rel="noopener"><img src="${brand(d)}" alt=""><b>${n}</b><em>install ↗</em></a>`; }).join('')}
        <a class="wbtn" href="https://app.hyperliquid.xyz/trade" target="_blank" rel="noopener"><img src="${brand('hyperliquid.xyz')}" alt=""><b>Deposit USDC on Hyperliquid</b><em>↗</em></a>
      </div>`;
  };
  draw(); m.hidden = false;
  b.onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    try {
      if (t.dataset.sol) { t.querySelector('em').textContent = 'check your wallet'; await W.connectSol(t.dataset.sol); toast('Solana wallet connected', 'ok', 3000); }
      else if (t.dataset.evm) { t.querySelector('em').textContent = 'check your wallet'; await W.connectEvm(t.dataset.evm); toast('EVM wallet connected', 'ok', 3000); }
      else if (t.dataset.a === 'sol-off') await W.disconnectSol();
      else if (t.dataset.a === 'evm-off') W.disconnectEvm();
      else if (t.dataset.a === 'agent') { t.querySelector('em').textContent = 'sign in your wallet'; await W.approveAgent(); toast('Session key approved. Perp orders now sign without popups.', 'ok'); }
      else if (t.dataset.a === 'agent-off') W.forgetAgent();
    } catch (err) { toast(esc(err.message || String(err)), 'err'); }
    draw();
  };
}
$('#mClose').onclick = () => { $('#modal').hidden = true; };
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') e.currentTarget.hidden = true; });
addEventListener('keydown', e => { if (e.key === 'Escape') $('#modal').hidden = true; });
$('#connectBtn').onclick = () => openWallets();
window.__wallets = openWallets;
const navW = () => {
  const n = (W.sol.address ? 1 : 0) + (W.evm.address ? 1 : 0);
  const label = n === 0 ? 'Connect' : n === 2 ? 'Both connected' : W.sol.address ? short(W.sol.address) : short(W.evm.address);
  for (const b of [$('#connectBtn'), $('#homeConnect')]) { b.classList.toggle('on', n > 0); b.querySelector('span').textContent = b.id === 'homeConnect' && n === 0 ? 'Connect wallet' : label; }
};
on('sol', navW); on('evm', navW);
setTimeout(async () => {                            // quiet reconnect of wallets this browser used before
  const s = store.get('bux:sol'); if (s) { const w = W.sol.list.find(x => x.name === s); if (w && w.accounts && w.accounts.length) W.connectSol(s).catch(() => {}); }
  const e = store.get('bux:evm'); if (e) { const d = W.evm.list.find(x => x.info.uuid === e); const p = d ? d.provider : W.legacyEvm(); if (p) p.request({ method: 'eth_accounts' }).then(a => { if (a && a[0]) W.connectEvm(d ? e : 'legacy').catch(() => {}); }).catch(() => {}); }
}, 900);

// ---------------------------------------------------------------- nav tools + the palette
const tools = {
  palette: () => openPalette(), alerts: () => T.openAlerts(), settings: () => T.openSettings(), vault: () => home(),
};
$('#navK').onclick = tools.palette;
$('#navSol').onclick = () => { go('trade'); setTimeout(() => window.__buxHedgePerp && window.__buxHedgePerp('SOL'), 200); };
$('#mSheet').addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (!b) return; ms.hidden = true; tools[b.dataset.act](); });
on('perps', P => { const s = P.by.SOL; if (!s) return; const b = $('#navSol'); b.querySelector('b').textContent = px(api.mids.SOL || s.mark); b.classList.toggle('dn', s.chg < 0); });
on('mids', m => { if (m.SOL) $('#navSol b').textContent = px(m.SOL); });
const goTrade = tab => { go('trade'); if (tab) setTimeout(() => { const b = $(`#sideTabs button[data-t=${tab}]`); b && b.click(); }, 60); };
const ACTIONS = [
  ['Overview', '▦', 'the dashboard: countdown, mood, movers, whales', () => go('overview')],
  ['Buy or sell', 'A', 'the coin on screen, through Jupiter', () => goTrade('ape')],
  ['Limit order', '⌖', 'buy the dip or sell the pump at your price', () => { goTrade('ape'); setTimeout(() => { const b = $('#apeType button[data-t=limit]'); b && b.click(); }, 120); }],
  ['Hedge', 'H', 'short its perp or SOL', () => goTrade('hedge')],
  ['Long or short a perp', 'P', 'anything on Hyperliquid', () => goTrade('perps')],
  ['Hedge the whole bag', '⇣', 'short SOL against everything you hold', () => { go('trade'); setTimeout(() => $('#hedgeAll').click(), 300); }],
  ['Pump.fun, live', '⚡', 'new pairs, final stretch, migrated', () => go('pump')],
  ['Trending memes', '↗', 'what the trenches are aping', () => go('trending')],
  ['Perps board', '≡', 'funding, open interest, volume', () => go('perps')],
  ['Market map', '▦', 'every meme perp, sized and coloured', () => go('market')],
  ['Whales', '◉', 'top Hyperliquid traders and their positions', () => go('whales')],
  ['Watch a wallet', '◎', 'any Solana wallet, priced live', () => { go('whales'); setTimeout(() => { const b = $('#whTab button[data-t=sol]'); b && b.click(); }, 60); }],
  ['Bag', '◧', 'your net worth, bag and positions', () => go('bag')],
  ['Hedge math', '∑', 'size a hedge before you click', () => go('hedge')],
  ['Watchlist', '★', 'coins you starred', () => { go('trade'); setTimeout(() => { const b = $('#listTab button[data-l=watch]'); b && b.click(); }, 120); }],
  ['Connect wallets', '⇄', 'Solana and Hyperliquid', () => openWallets()],
  ['Price alerts', 'L', 'ring when a coin or perp crosses a price', tools.alerts],
  ['Close all positions', '⨯', 'every Hyperliquid position, at market', () => { go('trade'); setTimeout(() => $('#closeAll').click(), 400); }],
  ['Cancel all orders', '⊘', 'every open order and trigger', () => { go('trade'); setTimeout(() => $('#cancelAll').click(), 400); }],
  ['Share this coin', '⇗', 'copy a link that opens it here', () => T.share()],
  ['Copy the mint', 'CA', 'contract address of the coin on screen', () => $('#tokCopy').click()],
  ['Full screen', 'F', 'nothing but the desk', () => T.full()],
  ['Settings', ',', 'slippage, leverage, start screen', tools.settings],
  ['Keyboard shortcuts', '?', 'every key the terminal knows', () => T.openKeys()],
  ...(CONFIG.ca ? [['Copy the $BUX CA', '$', short(CONFIG.ca), () => copy(CONFIG.ca)], ['Buy $BUX on pump.fun', '↗', 'opens pump.fun', () => window.open('https://pump.fun/coin/' + CONFIG.ca, '_blank', 'noopener')]] : []),
  ['Home screen', '◎', 'the night city', () => home()],
  ['FAQ', '?', 'questions players ask', () => go('faq')],
];
let palSel = 0, palItems = [], palSeq = 0;
function openPalette() { const p = $('#pal'), q = $('#palQ'); p.hidden = false; q.value = ''; drawPal([]); setTimeout(() => q.focus(), 20); }
function closePalette() { $('#pal').hidden = true; }
function drawPal(coins) {
  const v = $('#palQ').value.trim().toLowerCase();
  const acts = ACTIONS.filter(a => !v || (a[0] + ' ' + a[2]).toLowerCase().includes(v));
  palItems = [...coins.map(t => ({ coin: t })), ...acts.map(a => ({ act: a }))]; palSel = 0;
  $('#palList').innerHTML = (coins.length ? '<p class="ph">Coins</p>' + coins.map((t, i) => `<button type="button" data-i="${i}">${icon(t.icon, t.symbol, t.mint)}<b>${esc(t.symbol)} <span class="muted" style="font-weight:400">${esc(t.name)}</span></b><em>${usd(t.mcap)}</em></button>`).join('') : '')
    + (acts.length ? '<p class="ph">Actions</p>' + acts.map((a, i) => `<button type="button" data-i="${coins.length + i}"><span class="k">${a[1]}</span><b>${esc(a[0])}</b><em>${esc(a[2])}</em></button>`).join('') : '')
    || '<p class="ph">Nothing matches. Paste a mint to look it up.</p>';
  hlPal();
}
function hlPal() { $$('#palList button').forEach(b => b.classList.toggle('hl', +b.dataset.i === palSel)); }
function runPal(i) { const it = palItems[i]; if (!it) return; closePalette(); if (html.classList.contains('home')) { html.classList.remove('home'); boot(); if (club) club.pause(true); } if (it.coin) { go('trade'); window.__buxPick && window.__buxPick(it.coin.mint, 'ape'); } else it.act[3](); }
$('#palQ').addEventListener('input', () => {
  drawPal([]); const v = $('#palQ').value.trim(); if (v.length < 2) return;
  const my = ++palSeq; setTimeout(async () => { if (my !== palSeq) return; try { const r = (await api.search(v)).slice(0, 6); if (my === palSeq) drawPal(r); } catch {} }, 250);
});
$('#palQ').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); hlPal(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); hlPal(); }
  else if (e.key === 'Enter') { e.preventDefault(); runPal(palSel); }
  else if (e.key === 'Escape') closePalette();
});
$('#palList').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) runPal(+b.dataset.i); });
$('#pal').addEventListener('click', e => { if (e.target.id === 'pal') closePalette(); });
addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#pal').hidden ? openPalette() : closePalette(); } });

// ---------------------------------------------------------------- boot: data first, modules once the terminal is opened
api.loadPerps().catch(() => {}); setInterval(() => api.loadPerps().catch(() => {}), 30000);
api.liveMids();
T.init();
function boot() {
  if (booted) return; booted = true;
  import('./terminal.js?v=1').then(m => m.init()).catch(e => console.error(e));
  import('./pages.js?v=1').then(m => m.init(hooks, go)).then(() => { if (page && hooks[page] && hooks[page].show) hooks[page].show(); }).catch(e => console.error(e));
  import('./pump.js?v=1').then(m => m.init(hooks)).then(() => { if (page === 'pump' && hooks.pump) hooks.pump.show(); }).catch(e => console.error(e));
  import('./whales.js?v=1').then(m => m.init(hooks, go)).then(() => { if (page === 'whales' && hooks.whales) hooks.whales.show(); }).catch(e => console.error(e));
  import('./overview.js?v=1').then(m => m.init(hooks, go)).then(() => { if (page === 'overview' && hooks.overview) hooks.overview.show(); }).catch(e => console.error(e));
}
// a shared coin link, a page link or "open on terminal" skips the home screen
const skip = new URLSearchParams(location.search).has('t') || PAGES.includes(location.hash.slice(1)) || location.hash === '#market' || T.getSet().intro === false;
if (skip) { html.classList.remove('home'); boot(); go(startPage(), { push: false }); }
else makeHome();

// ---------------------------------------------------------------- the bag page borrows the terminal's desk (bag, positions, orders, net)
const desk = () => $('.desk');
hooks.bag = {
  show() { const d = desk(); if (d && d.parentElement.id !== 'bagSlot') $('#bagSlot').appendChild(d); nwDraw(); clearInterval(hooks.bag.t); hooks.bag.t = setInterval(nwDraw, 3000); },
  hide() { const d = desk(); if (d && d.parentElement.id === 'bagSlot') $('#term').appendChild(d); clearInterval(hooks.bag.t); },
};
function nwDraw() {
  const b = window.__bux && window.__bux.bag ? window.__bux.bag() : null, sol = b && W.sol.address ? b.tot : null, hl = b && b.hl ? b.hl.equity : null;
  const shortV = b && b.hl ? b.hl.pos.filter(p => p.szi < 0).reduce((s, p) => s + Math.abs(p.val || 0), 0) : 0;
  $('#nwSol').textContent = sol != null ? usd(sol) : '—'; $('#nwHL').textContent = hl != null ? usd(hl) : '—';
  $('#nwTot').textContent = sol != null || hl != null ? usd((sol || 0) + (hl || 0)) : '—';
  $('#nwHedge').textContent = sol ? Math.min(999, shortV / sol * 100).toFixed(0) + '%' : '—';
  const rows = b && b.rows ? b.rows.slice().sort((x, y) => y.usd - x.usd) : [], tot = rows.reduce((s, r) => s + r.usd, 0), COL = ['#ff2a8f', '#3fd8ff', '#8a3dff', '#ffd23f', '#2ee6a6', '#ff7a4a', '#6b6396'];
  const segs = rows.slice(0, 6).concat(rows.length > 6 ? [{ sym: 'Other', usd: rows.slice(6).reduce((s, r) => s + r.usd, 0) }] : []).filter(x => x.usd > 0);
  $('#bagAlloc').hidden = !(W.sol.address && segs.length);
  if (segs.length) { $('#baBar').innerHTML = segs.map((x, i) => `<i style="flex:${x.usd};background:${COL[i % COL.length]}" title="${esc(x.sym)} ${usd(x.usd)}"></i>`).join(''); $('#baLeg').innerHTML = segs.map((x, i) => `<span><i style="background:${COL[i % COL.length]}"></i>${esc(x.sym)} ${(x.usd / tot * 100).toFixed(1)}%</span>`).join(''); }
  const n = (W.sol.address ? 1 : 0) + (W.evm.address ? 1 : 0), bc = $('#bagConnect');
  bc.classList.toggle('on', n > 0); bc.querySelector('span').textContent = n === 2 ? 'Both wallets connected' : n ? 'Connect the other wallet' : 'Connect wallets';
}
$('#bagConnect').onclick = () => openWallets();
on('sol', () => { if (page === 'bag') nwDraw(); }); on('evm', () => { if (page === 'bag') nwDraw(); });
// GTA VI comes out on 19 November 2026
(() => {
  const at = new Date('2026-11-19T00:00:00').getTime(), el = $('#navGta b');
  const tick = () => { const s = Math.floor((at - Date.now()) / 1000); if (s <= 0) { el.textContent = 'OUT NOW'; $('#navGta').classList.add('out'); return; }
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    el.textContent = `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };
  tick(); setInterval(tick, 1000);
})();
