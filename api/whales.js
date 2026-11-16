// BUX · Hyperliquid's public leaderboard, boiled down at the edge. The raw file is ~48K rows and takes ~10 s to pull;
// this keeps the parsed copy warm in memory, answers with the top 100 for one window and sort (or a name/address search),
// and lets the CDN serve it for a minute.
const SRC = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';
const WINS = ['day', 'week', 'month', 'allTime'], SORTS = ['pnl', 'roi', 'vlm'];
let cache = null, inflight = null;

async function rows() {
  if (cache && Date.now() - cache.at < 5 * 60e3) return cache.rows;
  if (inflight) return inflight;
  inflight = (async () => {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 25000);
    try {
      const r = await fetch(SRC, { signal: c.signal, headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error('leaderboard ' + r.status);
      const d = await r.json();
      const out = (d.leaderboardRows || []).map(x => {
        const w = {}; for (const [k, v] of x.windowPerformances || []) w[k] = [+v.pnl || 0, +v.roi || 0, +v.vlm || 0];
        return { a: x.ethAddress, n: x.displayName || '', v: +x.accountValue || 0, w };
      }).filter(x => x.a);
      cache = { at: Date.now(), rows: out };
      return out;
    } finally { clearTimeout(t); inflight = null; }
  })();
  return inflight;
}

module.exports = async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x'), win = WINS.includes(u.searchParams.get('win')) ? u.searchParams.get('win') : 'month';
    const sort = SORTS.includes(u.searchParams.get('sort')) ? u.searchParams.get('sort') : 'pnl', q = (u.searchParams.get('q') || '').trim().toLowerCase().slice(0, 64);
    const all = await rows(), si = SORTS.indexOf(sort);
    let L = q ? all.filter(x => x.a.toLowerCase().includes(q) || x.n.toLowerCase().includes(q)) : all.filter(x => x.v >= 10000 && x.w[win]);
    L = L.slice().sort((a, b) => ((b.w[win] || [])[si] || 0) - ((a.w[win] || [])[si] || 0)).slice(0, 100);
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=600');
    res.setHeader('access-control-allow-origin', '*');
    res.end(JSON.stringify({ total: all.length, at: cache ? cache.at : Date.now(), win, sort, rows: L.map(x => ({ a: x.a, n: x.n, v: x.v, p: (x.w[win] || [0, 0, 0]) })) }));
  } catch (e) {
    res.statusCode = 502; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({ error: 'The Hyperliquid leaderboard is not answering right now.' }));
  }
};
