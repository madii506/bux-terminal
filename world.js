// BUX · the world behind the B: Vice at night, drawn live on one canvas.
// Stars, searchlights sweeping the sky, a skyline whose windows flicker on under neon signs, a neon grid sea that mirrors
// the city, palms that sway, a police helicopter on patrol, and a slow rain of BUX bills.
const rnd = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const ease = t => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const SKY = [[0, '#05031a'], [.34, '#0d0730'], [.6, '#250c52'], [.8, '#511266'], [.93, '#8a1d6e'], [1, '#c22c74']];
const SEA = [[0, '#5a1468'], [.08, '#331052'], [.4, '#160737'], [1, '#07031a']];
const WIN = ['#ffd67a', '#ff7fd0', '#7fe8ff'];
const BILLS = [['#ff6fb5', '#ff2a8f', '#b23dff'], ['#ffc24a', '#ff7a4a', '#ff3d7f'], ['#ffe58a', '#ffc23a', '#e0861c'], ['#b77bff', '#8a3dff', '#4a12c9'], ['#6ff0ff', '#14c4ea', '#2f6bff']];

function palm(g, x, y, h, lean, col) {
  const tx = x + lean * h, ty = y - h, wb = h * .055, wt = h * .022;
  g.fillStyle = col; g.beginPath();
  g.moveTo(x - wb, y); g.quadraticCurveTo(x - wb + lean * h * .2, y - h * .55, tx - wt, ty); g.lineTo(tx + wt, ty); g.quadraticCurveTo(x + wb + lean * h * .25, y - h * .5, x + wb, y); g.closePath(); g.fill();
  const L = h * .46;
  for (const [a, k] of [[-172, .95], [-148, 1], [-120, .82], [-92, .7], [-62, .84], [-34, 1], [-8, .92], [18, .7], [-198, .7]]) {
    const r = a * Math.PI / 180, len = L * k, droop = len * .38 * Math.abs(Math.cos(r)) + len * .08;
    const ex = tx + Math.cos(r) * len, ey = ty + Math.sin(r) * len + droop;
    const mx = tx + Math.cos(r) * len * .5, my = ty + Math.sin(r) * len * .5 - len * .12, nx = -Math.sin(r) * len * .13, ny = Math.cos(r) * len * .13;
    g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(mx + nx, my + ny, ex, ey); g.quadraticCurveTo(mx - nx, my - ny + len * .1, tx, ty); g.fill();
  }
  g.beginPath(); g.arc(tx, ty + h * .01, h * .035, 0, Math.PI * 2); g.fill();
}

export function startWorld(cv, { reduced = false } = {}) {
  const g = cv.getContext('2d');
  const S = { t0: performance.now(), w: 0, h: 0, dpr: 1, hz: 0, mx: 0, my: 0, tmx: 0, tmy: 0, paused: false, heli: { x: -1, dir: -1, next: 3 }, sparks: [], shoot: null, rain: [], zoom: 1, zoomTo: 1, zr: .08, dim: 0, dimTo: 0, skip: 0 };
  let L = {};
  const mk = (cw, ch, dpr = S.dpr) => { const c = document.createElement('canvas'); c.width = Math.ceil(cw * dpr); c.height = Math.ceil(ch * dpr); const x = c.getContext('2d'); x.scale(dpr, dpr); return [c, x]; };

  function bill(e) {                                    // a small BUX bill for the rain
    const w = 64, h = 28, [c, x] = mk(w, h, 2);
    const gr = x.createLinearGradient(0, 0, w, h); e.forEach((s, i) => gr.addColorStop(i / 2, s)); x.fillStyle = gr; x.beginPath(); x.roundRect(0, 0, w, h, 2.5); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1; x.strokeRect(2.5, 2.5, w - 5, h - 5);
    x.fillStyle = 'rgba(20,6,40,.85)'; x.beginPath(); x.arc(w * .24, h / 2, h * .3, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.font = `${h * .45}px Anton, Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('B', w * .24, h * .54);
    x.font = `${h * .42}px Anton, Impact, sans-serif`; x.fillText('100', w * .7, h * .56);
    return { c, w, h };
  }
  function layers() {
    const { w, h, hz } = S, R = rnd(7);
    const [sky, sx] = mk(w, hz); let gr = sx.createLinearGradient(0, 0, 0, hz); SKY.forEach(([o, c]) => gr.addColorStop(o, c)); sx.fillStyle = gr; sx.fillRect(0, 0, w, hz);
    const [sea, ex] = mk(w, h - hz + 2); gr = ex.createLinearGradient(0, 0, 0, h - hz); SEA.forEach(([o, c]) => gr.addColorStop(o, c)); ex.fillStyle = gr; ex.fillRect(0, 0, w, h - hz + 2);
    const stars = []; for (let i = 0; i < (S.wide ? 260 : 140); i++) stars.push({ x: R() * w, y: -h * .44 + Math.pow(R(), 1.3) * (hz * .72 + h * .44), r: .4 + R() * 1.1, ph: R() * 6.28, sp: .6 + R() * 2.2, d: R() });
    const city = (seed, far) => {
      const RR = rnd(seed), lh = hz * (far ? .36 : .52), [c, x] = mk(w, lh), wins = [], signs = [], bodies = [];
      const side = (x0, x1, tallAt) => {
        let xx = x0;
        while (xx < x1) {
          const bw = (far ? 18 : 26) + RR() * (far ? 34 : 52), d = Math.abs((xx + bw / 2) - tallAt) / Math.abs(x1 - x0);
          const bh = lh * (far ? .35 + RR() * .55 : clamp(.95 - d * .9 + RR() * .25, .22, .98));
          bodies.push({ x: xx, w: Math.min(bw, x1 - xx + 4), h: bh, type: RR() });
          xx += bw - (far ? 2 : 0) + (RR() < .2 ? 6 + RR() * 12 : 0);
        }
      };
      if (far) { side(-10, w * .42, w * .18); side(w * .58, w + 10, w * .82); side(w * .38, w * .62, w * .5); }
      else { side(-10, w * (S.wide ? .33 : .25), 0); side(w * (S.wide ? .67 : .75), w + 10, w); }
      for (const b of bodies) {
        const top = lh - b.h;
        if (far) x.fillStyle = 'rgba(70,24,120,.75)';
        else { const bg = x.createLinearGradient(0, top, 0, lh); bg.addColorStop(0, '#24094a'); bg.addColorStop(1, '#10042a'); x.fillStyle = bg; }
        x.beginPath();
        if (b.type < .3) { const s1 = b.w * .18; x.moveTo(b.x, lh); x.lineTo(b.x, top + 14); x.lineTo(b.x + s1, top + 14); x.lineTo(b.x + s1, top + 6); x.lineTo(b.x + b.w - s1, top + 6); x.lineTo(b.x + b.w - s1, top + 14); x.lineTo(b.x + b.w, top + 14); x.lineTo(b.x + b.w, lh); x.fill(); x.fillRect(b.x + b.w / 2 - 1.5, top - 18, 3, 26); }
        else if (b.type < .55) { x.moveTo(b.x, lh); x.lineTo(b.x, top + b.w * .5); x.quadraticCurveTo(b.x, top, b.x + b.w * .5, top); x.lineTo(b.x + b.w, top); x.lineTo(b.x + b.w, lh); x.fill(); }
        else { x.rect(b.x, top, b.w, b.h); x.fill(); }
        if (far) { for (let k = 0; k < b.w * b.h / 140; k++) if (RR() < .5) wins.push({ x: b.x + 3 + RR() * (b.w - 6), y: top + 8 + RR() * (b.h - 10), c: RR() < .7 ? 0 : RR() < .5 ? 1 : 2, ph: RR() * 6.28, sp: .1 + RR() * .6, th: .2 + RR() * .9, s: 2 }); continue; }
        x.save(); x.shadowColor = b.type < .5 ? '#ff2a8f' : '#3fd8ff'; x.shadowBlur = 10; x.strokeStyle = b.type < .5 ? '#ff6fc0' : '#8ff0ff'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(b.x + 2, top + (b.type < .3 ? 14 : 2)); x.lineTo(b.x + b.w - 2, top + (b.type < .3 ? 14 : 2)); x.stroke(); x.restore();
        const cols = Math.max(1, Math.floor((b.w - 8) / 8)), rows = Math.floor((b.h - 22) / 10), ox = b.x + (b.w - cols * 8) / 2 + 2;
        for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
          const wx = ox + k * 8, wy = top + 20 + r * 10;
          x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(wx, wy, 4, 5);
          if (RR() < .5) wins.push({ x: wx, y: wy, c: RR() < .66 ? 0 : RR() < .6 ? 1 : 2, ph: RR() * 6.28, sp: .2 + RR() * 1.4, th: .2 + RR() * .9, s: 4 });
        }
        if (b.h > lh * .55 && RR() < .6 && signs.length < 3) signs.push({ x: b.x + b.w * .5, y: top + 30, word: ['BANK', 'BUX', 'CLUB', 'MOTEL', 'HOTEL'][(signs.length + seed) % 5], col: RR() < .5 ? '#ff2a8f' : '#3fd8ff' });
      }
      const sg = signs.map(s => { const fs = 13, [sc, sx2] = mk(fs + 22, s.word.length * (fs + 3) + 22); sx2.font = `${fs}px Anton, Impact, sans-serif`; sx2.textAlign = 'center'; sx2.shadowColor = s.col; sx2.shadowBlur = 12; sx2.fillStyle = '#fff';
        [...s.word].forEach((ch, i) => sx2.fillText(ch, (fs + 22) / 2, 11 + fs + i * (fs + 3))); return { ...s, c: sc, cw: fs + 22, ch: s.word.length * (fs + 3) + 22 }; });
      return { c, lh, wins, signs: sg };
    };
    L = { sky, sea, stars, far: city(11, true), near: city(23, false), bills: BILLS.map(bill) };
    const P = rnd(5); L.shore = [];
    for (let i = 0; i < 9; i++) { const left = i < 5, xx = left ? w * (.02 + P() * .3) : w * (.68 + P() * .3); L.shore.push({ x: xx, h: hz * (.16 + P() * .14), lean: (P() - .5) * .3, ph: P() * 6 }); }
    // searchlights behind the skyline
    L.beams = [[.16, -.35, .23], [.5, .05, .17], [.84, .32, .21]].map(([fx, a0, sp], i) => ({ x: w * fx, a0, sp, ph: i * 2.1 }));
    // the rain starts spread over the screen
    const n = reduced ? 0 : S.wide ? 11 : 7; S.rain = [];
    for (let i = 0; i < n; i++) S.rain.push(newBill(P, true));
  }
  function newBill(R, spread) {
    const z = .4 + R() * .6;
    return { x: R() * S.w, y: spread ? R() * S.h : -40 - R() * S.h * .3, z, vy: 18 + 26 * z, vx: (R() - .5) * 10, rot: R() * 6.28, rs: (R() - .5) * 1.4, fl: R() * 6.28, fs: 1.6 + R() * 2.2, k: Math.floor(R() * 5) };
  }

  function resize() {
    const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight;
    S.w = w; S.h = h; S.wide = w >= 760; S.dpr = Math.min(devicePixelRatio || 1, S.wide ? 1.5 : 2);
    cv.width = Math.round(w * S.dpr); cv.height = Math.round(h * S.dpr);
    S.hz = Math.round(h * (S.wide ? .66 : .62));
    layers();
  }
  addEventListener('resize', () => { clearTimeout(S.rt); S.rt = setTimeout(resize, 120); });
  addEventListener('pointermove', e => { S.tmx = (e.clientX / innerWidth - .5) * 2; S.tmy = (e.clientY / innerHeight - .5) * 2; }, { passive: true });
  resize();

  const B = rnd(99);
  function frame(now) {
    requestAnimationFrame(frame);
    if (S.paused || document.hidden) return;
    const t = reduced ? 30 : (now - S.t0) / 1000, { w, h, hz } = S;
    S.mx += (S.tmx - S.mx) * .05; S.my += (S.tmy - S.my) * .05;
    S.zoom += (S.zoomTo - S.zoom) * S.zr; S.dim += (S.dimTo - S.dim) * .06;
    if (S.dim > .3 && S.zoomTo < 1.2 && (S.skip = (S.skip + 1) % 2)) return;
    const px = k => -S.mx * k;
    const z = S.zoom, zx = w / 2, zy = hz * .62, pan = reduced ? 0 : (1 - easeIO(clamp((t - .15) / 2.6, 0, 1))) * h * .42;
    g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); g.fillStyle = SKY[0][1]; g.fillRect(0, 0, w, h);
    g.setTransform(S.dpr * z, 0, 0, S.dpr * z, S.dpr * zx * (1 - z), S.dpr * (zy * (1 - z) + pan * z));
    const kSky = ease(t / .9), kCity = ease((t - 1.0) / 1.3), kWin = clamp((t - 1.7) / 1.3, 0, 1), kGrid = ease((t - 1.6) / 1.2), kPalm = ease((t - 2.0) / 1.2), kBeam = ease((t - .6) / 1.4);
    g.fillStyle = SKY[0][1]; g.fillRect(0, -h * .5, w, h * .5 + 2); g.drawImage(L.sky, 0, 0, w, hz);
    // stars
    g.fillStyle = '#fff';
    for (const s of L.stars) { const a = (.35 + .65 * (.5 + .5 * Math.sin(t * s.sp + s.ph))) * kSky; g.globalAlpha = a; g.beginPath(); g.arc(s.x + px(2) * (1 + s.d), s.y, s.r, 0, 6.283); g.fill(); }
    g.globalAlpha = 1;
    shooting(t);
    // searchlights sweeping from behind the skyline
    if (kBeam > 0) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const b of L.beams) {
        const a = b.a0 + Math.sin(t * b.sp + b.ph) * .42, len = hz * 1.25, bx = b.x + px(5);
        g.save(); g.translate(bx, hz); g.rotate(a);
        const lg = g.createLinearGradient(0, 0, 0, -len); lg.addColorStop(0, `rgba(190,220,255,${.2 * kBeam})`); lg.addColorStop(1, 'rgba(190,220,255,0)');
        g.fillStyle = lg; g.beginPath(); g.moveTo(-4, 0); g.lineTo(4, 0); g.lineTo(len * .1, -len); g.lineTo(-len * .1, -len); g.closePath(); g.fill(); g.restore();
      }
      g.restore();
    }
    // far skyline with its own tiny lights, then the helicopter, then the near skyline
    g.save(); g.beginPath(); g.rect(0, 0, w, hz); g.clip();
    const fy = hz - L.far.lh + (1 - kCity) * L.far.lh, fx = px(6);
    g.drawImage(L.far.c, fx, fy, w, L.far.lh);
    for (let c = 0; c < 3; c++) { g.fillStyle = WIN[c]; g.globalAlpha = .7 * kWin; for (const wn of L.far.wins) { if (wn.c !== c || Math.sin(t * wn.sp + wn.ph) < wn.th - .7) continue; g.fillRect(wn.x + fx, wn.y + fy, 2, 2); } }
    g.globalAlpha = 1;
    heli(t, px);
    const ny = hz - L.near.lh + (1 - ease((t - 1.2) / 1.3)) * L.near.lh, nx = px(12);
    g.drawImage(L.near.c, nx, ny, w, L.near.lh);
    const wave = kWin * w * 1.2;
    for (let c = 0; c < 3; c++) { g.fillStyle = WIN[c]; for (const wn of L.near.wins) { if (wn.c !== c || wn.x > wave) continue; if (Math.sin(t * wn.sp + wn.ph) < wn.th - .6) continue; g.fillRect(wn.x + nx, wn.y + ny, 4, 5); } }
    for (const s of L.near.signs) { const fl = Math.sin(t * 13 + s.x) > .93 ? .35 : 1; g.globalAlpha = kWin * fl; g.drawImage(s.c, s.x - s.cw / 2 + nx, s.y + ny, s.cw, s.ch); }
    g.globalAlpha = 1;
    for (const p of L.shore) palm(g, p.x + px(16), hz + 2 + (1 - kCity) * p.h * 1.2, p.h, p.lean + Math.sin(t * .9 + p.ph) * .025, '#0c0322');
    g.restore();
    // the sea mirrors the city
    g.drawImage(L.sea, 0, hz, w, h - hz + 2);
    seaFx(t, kWin, kGrid, px);
    // the rain of bills (behind the foreground palms)
    rain(t, px);
    const big = h * (S.wide ? .78 : .36), sw = reduced ? 0 : Math.sin(t * .7) * .02;
    palm(g, w * (S.wide ? .035 : -.02) + px(26) - (1 - kPalm) * w * .2, h * 1.04, big, .13 + sw, '#05010f');
    palm(g, w * (S.wide ? .11 : .1) + px(24) - (1 - kPalm) * w * .2, h * 1.05, big * .62, .05 + sw * 1.3, '#0c0322');
    palm(g, w * (S.wide ? .975 : 1.02) + px(26) + (1 - kPalm) * w * .2, h * 1.04, big * 1.05, -.14 - sw, '#05010f');
    palm(g, w * (S.wide ? .9 : .9) + px(24) + (1 - kPalm) * w * .2, h * 1.05, big * .58, -.04 - sw * 1.2, '#0c0322');
    sparks(t);
    if (kSky < 1) { g.fillStyle = `rgba(5,3,26,${1 - kSky})`; g.fillRect(0, -h * .5, w, h * 1.5); }
    g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    if (S.dim > .005) { g.fillStyle = `rgba(8,5,26,${S.dim})`; g.fillRect(0, 0, w, h); }
  }

  function seaFx(t, kWin, kGrid, px) {
    const { w, h, hz } = S, depth = h - hz;
    // the skyline's lights, smeared into the water
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const R = rnd(i * 7 + 3), x = (i < 13 ? R() * .33 : .67 + R() * .33) * w + px(12), col = R() < .55 ? '255,120,200' : R() < .5 ? '120,230,255' : '255,214,122';
      const len = depth * (.18 + R() * .3), wob = Math.sin(t * (1.4 + R()) + i) * 3;
      for (let k = 0; k < 7; k++) { const y = hz + 3 + k * len / 7; g.fillStyle = `rgba(${col},${(.22 - k * .028) * kWin})`; g.fillRect(x + wob * (k % 2 ? 1 : -1), y, 3 + R() * 6, len / 14); }
    }
    g.restore();
    g.save(); g.globalAlpha = kGrid;
    const vx = w / 2 + px(10), z0 = (t * .55) % 1;
    for (let i = 0; i < 18; i++) {
      const z = (i + 1 - z0) / 18, y = hz + depth * Math.pow(z, 2.3); if (y < hz + 2) continue;
      g.strokeStyle = `rgba(63,216,255,${.05 + z * .4})`; g.lineWidth = .6 + z * 1.6; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    for (let i = -14; i <= 14; i++) {
      const x1 = vx + i * w * .09, x0 = vx + i * w * .006;
      const lg = g.createLinearGradient(0, hz, 0, h); lg.addColorStop(0, 'rgba(255,42,143,0)'); lg.addColorStop(1, 'rgba(255,60,160,.5)');
      g.strokeStyle = lg; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0, hz); g.lineTo(x1, h); g.stroke();
    }
    g.restore();
    const lg = g.createLinearGradient(0, h - depth * .55, 0, h); lg.addColorStop(0, 'rgba(5,3,26,0)'); lg.addColorStop(1, 'rgba(5,3,26,.6)'); g.fillStyle = lg; g.fillRect(0, h - depth * .55, w, depth * .55);
  }

  function rain(t, px) {
    const { h } = S, k = reduced ? 1 : ease((t - 2.4) / 1.2); if (k <= 0) return;
    for (const b of S.rain) {
      b.y += b.vy / 60; b.x += (b.vx + Math.sin(t * .8 + b.fl) * 8) / 60; b.rot += b.rs / 60;
      if (b.y > h + 40) Object.assign(b, newBill(B, false));
      const sp = L.bills[b.k], sc = b.z, flip = Math.cos(t * b.fs + b.fl);
      g.save(); g.translate(b.x + px(14 * b.z), b.y); g.rotate(b.rot); g.scale(sc * (.25 + .75 * Math.abs(flip)), sc);
      g.globalAlpha = clamp(.2 + b.z * .55, 0, .8) * k; g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h); g.restore();
    }
    g.globalAlpha = 1;
  }

  function shooting(t) {
    const { w, hz } = S;
    if (!S.shoot && !reduced && B() < .0025) S.shoot = { x: w * (.15 + B() * .7), y: hz * (.05 + B() * .25), born: t, v: 420 + B() * 200, a: .35 + B() * .25 };
    if (!S.shoot) return;
    const s = S.shoot, u = (t - s.born) / .9; if (u > 1) { S.shoot = null; return; }
    const x = s.x + Math.cos(s.a) * s.v * u * .9, y = s.y + Math.sin(s.a) * s.v * u * .9, lg = g.createLinearGradient(x, y, x - Math.cos(s.a) * 90, y - Math.sin(s.a) * 90);
    lg.addColorStop(0, `rgba(255,255,255,${.9 * Math.sin(u * Math.PI)})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = lg; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(s.a) * 90, y - Math.sin(s.a) * 90); g.stroke();
  }

  function heli(t, px) {
    const H = S.heli, { w, hz } = S;
    if (H.x < -0.5 && t > H.next && !reduced) { H.dir = B() < .5 ? -1 : 1; H.x = H.dir < 0 ? w + 60 : -60; H.y = hz * (.14 + B() * .14); H.v = 60 + B() * 40; }
    if (H.x < -0.5) return;
    H.x += H.dir * H.v / 60;
    if (H.x < -80 || H.x > w + 80) { H.x = -1; H.next = t + 14 + B() * 14; return; }
    const x = H.x + px(8), y = H.y + Math.sin(t * 2) * 3, sw = Math.sin(t * .9) * .35, len = S.h;
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y + 6); g.rotate(sw);
    const lg = g.createLinearGradient(0, 0, 0, len); lg.addColorStop(0, 'rgba(255,250,220,.34)'); lg.addColorStop(1, 'rgba(255,250,220,0)');
    g.fillStyle = lg; g.beginPath(); g.moveTo(-3, 0); g.lineTo(3, 0); g.lineTo(len * .16, len); g.lineTo(-len * .16, len); g.closePath(); g.fill(); g.restore();
    g.save(); g.translate(x, y); g.scale(H.dir < 0 ? 1 : -1, 1); g.fillStyle = '#05010f';
    g.beginPath(); g.ellipse(0, 0, 17, 8, 0, 0, 6.283); g.fill(); g.fillRect(10, -3, 30, 4); g.fillRect(36, -9, 4, 10);
    g.fillRect(-14, 9, 26, 2); g.fillRect(-9, 6, 2, 4); g.fillRect(5, 6, 2, 4);
    g.fillStyle = 'rgba(160,230,255,.7)'; g.beginPath(); g.ellipse(-8, -1, 6, 4, 0, 0, 6.283); g.fill();
    const rot = (t * 40) % 1; g.fillStyle = 'rgba(5,1,15,.7)'; g.fillRect(-24 + rot * 4, -11, 48 - rot * 8, 2); g.fillRect(-1, -11, 2, 4);
    g.fillStyle = Math.floor(t * 3) % 2 ? '#ff2a4a' : '#2a6bff'; g.beginPath(); g.arc(2, -8, 2.6, 0, 6.283); g.fill();
    g.restore();
  }

  function sparks(t) {
    const { w, h } = S;
    if (!reduced && S.sparks.length < 10 && B() < .08) S.sparks.push({ x: w * (.25 + B() * .5), y: h * (.12 + B() * .6), born: t, life: .8 + B() * 1.2, s: 3 + B() * 5 });
    g.fillStyle = '#fff';
    S.sparks = S.sparks.filter(p => {
      const u = (t - p.born) / p.life; if (u > 1) return false;
      const a = Math.sin(u * Math.PI), s = p.s * a;
      g.globalAlpha = a * .85; g.beginPath(); g.moveTo(p.x, p.y - s); g.quadraticCurveTo(p.x, p.y, p.x + s, p.y); g.quadraticCurveTo(p.x, p.y, p.x, p.y + s); g.quadraticCurveTo(p.x, p.y, p.x - s, p.y); g.quadraticCurveTo(p.x, p.y, p.x, p.y - s); g.fill();
      return true;
    });
    g.globalAlpha = 1;
  }

  requestAnimationFrame(frame);
  return {
    dive() { S.zr = .055; S.zoomTo = 2.3; },
    reset() { S.zr = 1; S.zoom = S.zoomTo = 1; S.dim = S.dimTo = 0; S.t0 = performance.now() - 4200; },
    skip() { const t = (performance.now() - S.t0) / 1000; if (t < 3.6) S.t0 = performance.now() - 3600; },
    pause(p) { S.paused = !!p; },
  };
}
