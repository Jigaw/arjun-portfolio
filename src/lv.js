(function () {
  'use strict';
  // The scene (updateFireRocks) writes each stone's screen position into window.__pfScene every frame
  // and reads back `hold` (keep that stone up) and `pop` (stones to throw up once).
  const S = (window.__pfScene = window.__pfScene || { hold: -1, rocks: [], pop: [] });
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fireOn = () => !S.theme || S.theme === 'fire';   // the scene sets S.theme on every theme change
  // highest a label or card may float: just below the name and the top-right buttons
  const uiTop = (vw) => (vw < 700 ? 64 : 70);

  const NAMES = ['Education', 'Projects', 'Skills', 'Experience', 'Languages'];
  const N = NAMES.length;
  const cards = NAMES.map((_, i) => $('.lv-card[data-i="' + i + '"]'));
  const path = $('#lv-path'), grad = $('#lv-grad');
  const lvRoot = $('#lv');
  const labelsEl = $('#lv-labels'), dotsEl = $('#lv-dots'), track = $('#lv-track'), msg = $('#lv-msg');

  // ---------- labels + tracker dots ----------
  const labels = NAMES.map((n, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lv-label'; b.dataset.i = i;
    b.setAttribute('aria-label', n + ': reveal');
    const pill = document.createElement('span'); pill.className = 'lv-pill lv-mono';
    const dot = document.createElement('span'); dot.className = 'dot';
    const num = document.createElement('i'); num.textContent = '0' + (i + 1);
    const t = document.createElement('span'); t.textContent = n;
    pill.append(dot, num, t);
    const stem = document.createElement('span'); stem.className = 'lv-stem';
    b.append(pill, stem);
    labelsEl.appendChild(b);
    return b;
  });
  const dots = NAMES.map((n, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.i = i; b.title = n; b.setAttribute('aria-label', n);
    dotsEl.appendChild(b);
    return b;
  });

  const HOLD = 850;   // ms of hovering before the full card bursts out of the stone's label

  // ---------- state ----------
  let labelHover = -1, focusIdx = -1;
  const hov = { i: -1, upAt: 0 };
  let active = -1, shownAt = 0, introDone = false, fallback = false;
  const seen = new Array(N).fill(false);
  const pos = cards.map(() => ({ x: 0, y: 0, init: false, side: 0 }));
  // element sizes are cached and re-measured only on show / resize (reading them every frame forced
  // a layout recalculation per label per frame)
  const size = new Map();
  const measure = (el) => { const s = { w: el.offsetWidth, h: el.offsetHeight }; size.set(el, s); return s; };
  const sizeOf = (el) => size.get(el) || measure(el);
  window.addEventListener('resize', () => size.clear());
  const fadeMore = (sc) => sc.classList.toggle('more', sc.scrollHeight - sc.scrollTop - sc.clientHeight > 4);

  function toast(t) {
    const el = $('#lv-toast');
    el.textContent = t; el.classList.add('on');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 1800);
  }
  function countUp(el) {
    const end = Number(el.dataset.count), suf = el.dataset.suffix || '';
    if (reduce) { el.textContent = end + suf; return; }
    const t0 = performance.now();
    (function tick(t) {
      const k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 4);
      el.textContent = Math.round(end * e) + (k < 1 ? '' : suf);
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function rockAt(x, y) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < N; i++) {
      const R = S.rocks[i];
      if (!R || !R.vis) continue;
      const d = Math.min(Math.hypot(x - R.x, y - R.y), Math.hypot(x - R.lx, y - R.ly - 10));
      if (d < Math.max(30, R.r * 1.4) && d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function showCard(i) {
    if (active === i) return;
    if (active >= 0) {
      const old = cards[active];
      old.classList.remove('on', 'pinned');
      old.classList.add('out');
      old.setAttribute('aria-hidden', 'true');
      setTimeout(() => { if (!old.classList.contains('on')) old.classList.remove('out'); }, 460);
    }
    active = i;
    if (i < 0) { path.classList.remove('on'); return; }
    const c = cards[i];
    c.classList.remove('out');
    void c.offsetWidth;
    c.classList.add('on');
    c.setAttribute('aria-hidden', 'false');
    pos[i].init = false; pos[i].side = 0;
    size.delete(c);
    shownAt = performance.now();
    $$('[data-count]', c).forEach(countUp);
    const sc = $('.lv-scroll', c);
    if (sc) { sc.scrollTop = 0; requestAnimationFrame(() => fadeMore(sc)); }
  }

  function markSeen(i) {
    if (seen[i]) return;
    seen[i] = true;
    labels[i].classList.add('seen'); dots[i].classList.add('seen');
    const n = seen.filter(Boolean).length;
    if (n < N) {
      msg.textContent = '';
      const b = document.createElement('b'); b.textContent = n + ' / ' + N;
      msg.append(b, document.createTextNode(' uncovered · keep digging'));
    } else {
      msg.textContent = 'All five uncovered.';
      track.classList.add('done');
      const sw = document.getElementById('btn-shockwave'); // the scene's own shockwave: the wall erupts
      if (sw) setTimeout(() => sw.click(), 300);
      // then a hand shows where the next surprise is, once the visitor has closed the card they are reading
      (function waitForClear(n) { if (active >= 0 && n < 120) { setTimeout(() => waitForClear(n + 1), 250); return; } setTimeout(pointAtMoon, 700); })(0);
    }
  }

  // after all five: a hand rises toward the moon, taps it, gives a little pull, and is gone; the moon says "Try pulling me!" (~2.6 s)
  function pointAtMoon() {
    const M = S.moonAt;
    if (!M || !M.ok) { toast('All five uncovered. Thanks for exploring!'); return; }
    const NS = 'http://www.w3.org/2000/svg';
    const hand = document.createElement('div');
    hand.className = 'lv-hand'; hand.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 24 24');
    // "pointer" hand from the Lucide icon set (ISC licence)
    ['M22 14a8 8 0 0 1-8 8', 'M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2', 'M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1', 'M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10',
     'M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'].forEach((d) => {
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); svg.appendChild(p);
    });
    hand.appendChild(svg);
    document.body.appendChild(hand);
    // the moon's own little note
    const bubble = document.createElement('div');
    bubble.className = 'lv-moon-note'; bubble.textContent = 'Try pulling me!';
    document.body.appendChild(bubble);
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    const bx = Math.max(10, Math.min(window.innerWidth - bw - 10, M.x - bw / 2));
    const below = M.y - bh - 34 < 70;                               // no room above (phones): sit under the moon instead
    bubble.classList.toggle('below', below);
    bubble.style.left = bx + 'px'; bubble.style.top = (below ? M.y + 34 : M.y - bh - 34) + 'px';
    bubble.style.setProperty('--tail', Math.max(14, Math.min(bw - 14, M.x - bx)) + 'px');
    bubble.animate([
      { opacity: 0, transform: 'translateY(8px) scale(0.8) rotate(-3deg)' },
      { opacity: 1, transform: 'translateY(0) scale(1) rotate(-3deg)', offset: 0.18 },
      { opacity: 1, transform: 'translateY(0) scale(1) rotate(-3deg)', offset: 0.85 },
      { opacity: 0, transform: 'translateY(-6px) scale(0.96) rotate(-3deg)' }
    ], { duration: reduce ? 1 : 2600, easing: 'ease-out', fill: 'forwards' }).onfinish = () => bubble.remove();
    // the fingertip (top-left of the icon) aims at the moon from the middle of the screen
    const cx = window.innerWidth / 2, cy = window.innerHeight * 0.62;
    let dx = M.x - cx, dy = M.y - cy;
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const ang = Math.atan2(dy, dx) * 180 / Math.PI + 90 + 18;   // the icon's finger points up and a little left
    const at = (k) => [M.x - dx * k - 28, M.y - dy * k - 6];      // the hand's box, k px back from the moon
    const [x0, y0] = at(170), [x1, y1] = at(42), [x2, y2] = at(30);
    const tf = (x, y, s) => 'translate(' + x + 'px,' + y + 'px) rotate(' + ang + 'deg) scale(' + s + ')';
    const a = hand.animate([
      { transform: tf(x0, y0, 0.7), opacity: 0 },
      { transform: tf(x1, y1, 1), opacity: 1, offset: 0.35 },
      { transform: tf(x2, y2, 0.88), opacity: 1, offset: 0.5 },     // tap
      { transform: tf(x1, y1, 1), opacity: 1, offset: 0.6 },
      { transform: tf(x1, y1 + 34, 1), opacity: 1, offset: 0.85 },  // a little pull down
      { transform: tf(x1, y1 + 40, 0.95), opacity: 0 }
    ], { duration: reduce ? 1 : 2600, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)', fill: 'forwards' });
    a.onfinish = () => hand.remove();
  }

  function setTether(ax, ay, bx, by, side) {
    const f = (v) => v.toFixed(1);
    const d = side
      ? 'M' + f(ax) + ' ' + f(ay) + ' C' + f((ax + bx) / 2) + ' ' + f(ay) + ' ' + f((ax + bx) / 2) + ' ' + f(by) + ' ' + f(bx) + ' ' + f(by)
      : 'M' + f(ax) + ' ' + f(ay) + ' C' + f(ax) + ' ' + f((ay + by) / 2) + ' ' + f(bx) + ' ' + f((ay + by) / 2) + ' ' + f(bx) + ' ' + f(by);
    path.setAttribute('d', d);
    grad.setAttribute('x1', bx); grad.setAttribute('y1', by); grad.setAttribute('x2', ax); grad.setAttribute('y2', ay);
    path.classList.add('on');
  }

  // ---------- Projects: titles grouped by studio with platform logos; hover / tap one for a Steam-style panel ----------
  const PROJ = /*PROJECTS*/null;   // filled in by build.py from src/projects.json
  // PlayStation, Steam, Nintendo Switch, Steam Deck and ROG marks: Simple Icons (CC0); Xbox and PC are simple drawn marks
  const ICONS = {
    ps: { name: 'PlayStation', fill: 'M8.984 2.596v17.547l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.18.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.152 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.39-1.502zm4.656 16.241l6.296-2.275c.715-.258.826-.625.246-.818-.586-.192-1.637-.139-2.357.123l-4.205 1.5V14.98l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.785.03 5.437.661 1.848.601 2.04 1.472 1.576 2.072-.465.6-1.622 1.036-1.622 1.036l-8.544 3.107V18.86zM1.807 18.6c-1.9-.545-2.214-1.668-1.352-2.32.801-.586 2.16-1.052 2.16-1.052l5.615-2.013v2.313L4.205 17c-.705.271-.825.632-.239.826.586.195 1.637.15 2.343-.12L8.247 17v2.074c-.12.03-.256.044-.39.073-1.939.331-3.996.196-6.038-.479z' },
    steam: { name: 'Steam', fill: 'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z' },
    xbox: { name: 'Xbox', stroke: 'M12 2.5a9.5 9.5 0 1 0 0 19a9.5 9.5 0 0 0 0-19zM7.2 6.4c1.9 1.1 3.5 2.6 4.8 4.4 1.3-1.8 2.9-3.3 4.8-4.4M6.6 17.2c1.4-2.3 3.2-4.3 5.4-6 2.2 1.7 4 3.7 5.4 6' },
    pc: { name: 'PC', stroke: 'M3 4.5h18v11.5H3zM8.5 20h7M12 16v4' },
    ns: { name: 'Nintendo Switch', fill: 'M14.176 24h3.674c3.376 0 6.15-2.774 6.15-6.15V6.15C24 2.775 21.226 0 17.85 0H14.1c-.074 0-.15.074-.15.15v23.7c-.001.076.075.15.226.15zm4.574-13.199c1.351 0 2.399 1.125 2.399 2.398 0 1.352-1.125 2.4-2.399 2.4-1.35 0-2.4-1.049-2.4-2.4-.075-1.349 1.05-2.398 2.4-2.398zM11.4 0H6.15C2.775 0 0 2.775 0 6.15v11.7C0 21.226 2.775 24 6.15 24h5.25c.074 0 .15-.074.15-.149V.15c.001-.076-.075-.15-.15-.15zM9.676 22.051H6.15c-2.326 0-4.201-1.875-4.201-4.201V6.15c0-2.326 1.875-4.201 4.201-4.201H9.6l.076 20.102zM3.75 7.199c0 1.275.975 2.25 2.25 2.25s2.25-.975 2.25-2.25c0-1.273-.975-2.25-2.25-2.25s-2.25.977-2.25 2.25z' },
    deck: { name: 'Steam Deck', fill: 'M8.999 0v4.309c4.242 0 7.694 3.45 7.694 7.691s-3.452 7.691-7.694 7.691V24c6.617 0 12-5.383 12-12s-5.383-12-12-12Zm0 6.011c-3.313 0-6 2.687-5.998 6a5.999 5.999 0 1 0 5.998-6z' },
    rog: { name: 'ROG Ally', fill: 'M21.3906 5.5833c-1.3467.0115-3.4338.19541-5.9375.97657-1.6024.49851-3.916 2.74203-8.22459 6.90823-.56973.3204-2.67017-.8912-3.88085-1.461 0 0 1.9929 3.1699 2.70507 4.0957 1.06825 1.46 3.02735 2.3145 3.02735 2.3145-.17804-.1781-1.53019-1.6029-1.92188-2.4219-.24926-.3917.03418-.9624 1.95703-2.3867C10.86 12.3268 17.0569 7.09358 23.0391 5.66924c0 0-.601-.09488-1.6485-.08593V5.5833ZM24 7.7708c-2.0653.21366-4.06.81878-5.9473 1.70899C14.2783 11.2602 7.9043 15.8177 7.9043 15.8177c.28486.178.5706.3556.85546.498 3.06234 1.3531 7.58484 2.1716 8.43944 1.8867 2.3858-.7833 5.056-5.8026 5.875-8.1172 0 0-2.4933.9968-5.0215 2.1719-2.1009.9971-4.414 2.1368-4.414 2.1368l5.875-1.7813s-1.5676 3.7036-3.6328 4.1309c-2.0653.4273-5.6973-1.0332-5.6973-1.0332.2849-.2493 4.1302-3.0629 13.1035-6.73051.3917-.28487.6417-.74608.7129-1.20898V7.7708ZM0 11.2942c.35608.9615.8194 1.8525 1.35352 2.7071.64094.819 3.27477 1.4952 3.63086 1.5664C3.34638 14.4282 0 11.2942 0 11.2942Z' }
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  function platIcon(spec) {
    const [kind, note] = spec.split(':');                       // e.g. 'deck:Verified' (Valve's Steam Deck rating)
    const I = ICONS[kind]; if (!I) return null;
    const label = note ? I.name + ': ' + note : I.name;
    const v = document.createElementNS(SVGNS, 'svg'); v.setAttribute('viewBox', '0 0 24 24'); v.setAttribute('class', 'lv-plat');
    v.setAttribute('role', 'img'); v.setAttribute('aria-label', label);
    const tt = document.createElementNS(SVGNS, 'title'); tt.textContent = label; v.appendChild(tt);
    const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', I.fill || I.stroke);
    if (I.stroke) p.setAttribute('class', 'st');
    v.appendChild(p);
    return v;
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const projBox = $('#lv-projects'), steamEl = document.getElementById('lv-steam');
  let cardHover = -1, panelHover = false, panelFor = null, lastWantAt = 0, lastInsideAt = 0;
  const sentiment = (s) => /positive/i.test(s) ? 'pos' : /mixed/i.test(s) ? 'mix' : 'neg';
  function fillPanel(it) {
    steamEl.textContent = '';
    const x = el('button', 'lv-steam-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', hidePanel); steamEl.appendChild(x);
    if (it.id) {
      const img = el('img', 'lv-steam-img'); img.src = 'assets/steam/' + it.id + '.jpg'; img.alt = it.name; img.width = 460; img.height = 215;
      steamEl.appendChild(img);
    } else {
      const ph = el('div', 'lv-steam-code'); ph.append(el('b', null, it.name), el('span', 'lv-mono', 'Codename project'));
      steamEl.appendChild(ph);
    }
    const body = el('div', 'lv-steam-body');
    body.appendChild(el('p', 'lv-steam-desc', it.short));
    if (it.id) {
      const tbl = el('div', 'lv-steam-rows');
      const row = (k, v) => { const r = el('div', 'lv-steam-row'); r.appendChild(el('span', 'lv-steam-k', k)); r.appendChild(v); tbl.appendChild(r); };
      (it.reviews || []).forEach((rv) => {
        const v = el('span', 'lv-steam-v'); const s = el('b', 'rev ' + sentiment(rv.summary), rv.summary); s.title = rv.tip || '';
        v.appendChild(s); if (rv.count) v.appendChild(el('span', 'cnt', ' (' + rv.count + ')'));
        row(rv.label, v);
      });
      row('Release date', el('span', 'lv-steam-v', it.release));
      row('Developer', el('span', 'lv-steam-v link', it.dev));
      row('Publisher', el('span', 'lv-steam-v link', it.pub));
      body.appendChild(tbl);
      if (it.tags && it.tags.length) {
        const tg = el('div', 'lv-steam-tags'); tg.appendChild(el('small', null, 'Popular user-defined tags for this product:'));
        const wrap = el('div', 'chips'); it.tags.forEach((x) => wrap.appendChild(el('span', null, x))); tg.appendChild(wrap);
        body.appendChild(tg);
      }
      const foot = el('div', 'lv-steam-foot');
      const a = el('a', null, 'View on Steam ↗'); a.href = 'https://store.steampowered.com/app/' + it.id + '/'; a.target = '_blank'; a.rel = 'noopener noreferrer';
      foot.appendChild(a);
      body.appendChild(foot);
    }
    steamEl.appendChild(body);
  }
  function showPanel(it, row) {
    if (panelFor !== it) { fillPanel(it); panelFor = it; steamEl.scrollTop = 0; }
    projBox.querySelectorAll('.lv-proj.on').forEach((r) => r.classList.remove('on'));
    if (row) row.classList.add('on');
    steamEl.classList.add('on'); steamEl.setAttribute('aria-hidden', 'false');
  }
  function hidePanel() {
    if (!steamEl.classList.contains('on')) return;
    steamEl.classList.remove('on'); steamEl.setAttribute('aria-hidden', 'true');
    projBox.querySelectorAll('.lv-proj.on').forEach((r) => r.classList.remove('on'));
  }
  if (PROJ && projBox) {
    PROJ.groups.forEach((g, gi) => {
      const grp = el('div', 'lv-proj-grp rv'); grp.style.setProperty('--d', String(2 + gi));
      const head = el('div', 'lv-co');
      if (g.logo) { const lg = el('span', 'lv-co-logo ' + g.logo); lg.setAttribute('role', 'img'); lg.setAttribute('aria-label', g.co); head.appendChild(lg); }
      else head.appendChild(el('b', null, g.co));
      if (g.note) head.appendChild(el('small', 'lv-mono', g.note));
      if (g.logo2) { const l2 = el('span', 'lv-co-logo ' + g.logo2); l2.setAttribute('role', 'img'); l2.setAttribute('aria-label', g.logo2.toUpperCase()); head.appendChild(l2); }
      grp.appendChild(head);
      g.items.forEach((it) => {
        const row = el('button', 'lv-proj'); row.type = 'button';
        if (it.id) { const im = el('img', 'lv-proj-img'); im.src = 'assets/steam/' + it.id + '-s.jpg'; im.alt = ''; im.width = 92; im.height = 35; im.loading = 'lazy'; row.appendChild(im); }
        else row.appendChild(el('span', 'lv-proj-img code lv-mono', 'Code'));
        const txt = el('span', 'lv-proj-txt');
        txt.appendChild(el('span', 'lv-proj-name', it.name));
        const pl = el('span', 'lv-plats'); it.plats.forEach((k) => { const ic = platIcon(k); if (ic) pl.appendChild(ic); }); txt.appendChild(pl);
        row.appendChild(txt);
        row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showPanel(it, row); });
        row.addEventListener('focus', () => showPanel(it, row));
        row.addEventListener('click', () => showPanel(it, row));
        grp.appendChild(row);
      });
      projBox.appendChild(grp);
    });
  }
  // the card (and its floating stone) stays while the pointer is on it or on its Steam panel. Leaving either waits a
  // moment before hiding the panel, so the pointer can cross the gap between them (and reach "View on Steam")
  let hideTimer = 0;
  const hideSoon = () => { clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (cardHover !== 1 && !panelHover) hidePanel(); }, 900); };
  cards.forEach((c, i) => {
    c.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { cardHover = i; clearTimeout(hideTimer); } });
    c.addEventListener('pointerleave', () => { if (cardHover === i) { cardHover = -1; hideSoon(); } });
  });
  steamEl.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { panelHover = true; clearTimeout(hideTimer); } });
  steamEl.addEventListener('pointerleave', () => { panelHover = false; hideSoon(); });
  // the panel sits beside the Projects card (phones: a centred pop-up over it)
  (function placePanel() {
    requestAnimationFrame(placePanel);
    if (!steamEl.classList.contains('on')) return;
    if (active !== 1 || !fireOn() || S.giftUp) { hidePanel(); return; }
    const vw = window.innerWidth, vh = window.innerHeight, cr = cards[1].getBoundingClientRect();
    const pw = steamEl.offsetWidth, ph = steamEl.offsetHeight;
    let x, y;
    if (vw < 700) { x = 10; y = Math.max(64, (vh - ph) / 2); }   // phones: a centred pop-up over the card (closes with ×)
    else {
      x = cr.right + 8 + pw <= vw - 10 ? cr.right + 8 : Math.max(10, cr.left - 8 - pw);
      y = Math.max(70, Math.min(vh - ph - 12, cr.top));
    }
    steamEl.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
  })();

  // ---------- frame loop: place labels, cards and the steam tether ----------
  function frame(now) {
    requestAnimationFrame(frame);
    const vw = window.innerWidth, vh = window.innerHeight;
    fallback = S.rocks.length < N && now > 9000;   // no 3D scene (WebGL failed): cards open centred from the tracker
    if (fallback !== lvRoot.classList.contains('nogl')) lvRoot.classList.toggle('nogl', fallback);
    // the stones only exist in the Fire theme; elsewhere their last positions are stale, so nothing shows
    if (!fireOn() || S.giftUp) {
      S.hold = -1; hov.i = -1; hov.upAt = 0; touchOpen = -1;
      if (active >= 0) showCard(-1);
      labels.forEach((L) => L.classList.remove('show', 'ghost'));
      return;
    }

    // which stone does the visitor want up?
    let natural = -1;
    for (let i = 0; i < N; i++) if (S.rocks[i] && S.rocks[i].vis && S.rocks[i].over) { natural = i; break; }
    // hover only: the card is there while the stone (or its label) is under the pointer and goes the
    // moment it leaves. Touch has no hover, so a tap on a stone shows it until the next tap.
    // while a Steam panel is open, the Projects card and the panel are one zone: stones underneath can't take over,
    // and there's time to travel between the two by any route (e.g. down to "View on Steam")
    const panelOpen = steamEl.classList.contains('on');
    if (cardHover === 1 || panelHover) lastInsideAt = now;
    let want = panelOpen && now - lastInsideAt < 900 ? 1
      : natural >= 0 ? natural : labelHover >= 0 ? labelHover : focusIdx >= 0 ? focusIdx : cardHover >= 0 ? cardHover : panelHover ? 1 : touchOpen;
    if (want >= 0) lastWantAt = now;                                          // last real hover / tap
    else if (active >= 0 && now - lastWantAt < 600) want = active;           // a moment's grace to move from the stone onto its card
    S.hold = want;

    // once the stone is out of the lava its label pill appears above it; holding the hover fills the
    // pill's dot like a ring and the full card bursts out of it. Moving away closes both at once.
    const R = S.rocks[want];
    // the hold timer starts with the hover itself (not when the stone happens to be up), so the card
    // always bursts out the same moment after you settle on a stone
    if (want !== hov.i) { hov.i = want; hov.upAt = want >= 0 ? now : 0; }
    // a tap is a deliberate pick: its card opens quicker than a mouse hover's (which waits out passing pointers)
    const prog = hov.upAt ? Math.min(1, (now - hov.upAt) / (want >= 0 && want === touchOpen ? 320 : HOLD)) : 0;
    const held = prog >= 1;
    showCard(held ? want : -1);
    if (active >= 0 && now - shownAt > 700) markSeen(active);

    // labels: all five pills float just above their stones (stem pointing down) and ride up with them;
    // the hovered one lights up and fills its ring, and once its card bursts out it steps aside
    for (let i = 0; i < N; i++) {
      const L = labels[i], r = S.rocks[i];
      const vis = !!r && r.vis;
      // once the card bursts out, the pill stays as an invisible hover target so the pointer resting on
      // it keeps the card open (hiding it would end the hover and slam the card shut)
      const ghost = i === want && held && vis;
      const on = vis && !ghost;
      if (on !== L.classList.contains('show')) {
        L.classList.toggle('show', on);
        if (ghost) { L.classList.add('pop'); setTimeout(() => L.classList.remove('pop'), 240); }
      }
      L.classList.toggle('ghost', ghost);
      L.classList.toggle('hot', on && i === want);
      if (!vis) continue;
      const ls = sizeOf(L), lw = ls.w || 120, lh = ls.h || 54;
      const ay = r.y - Math.max(8, r.r * 0.85);
      L.style.transform = 'translate3d(' + Math.round(Math.max(8, Math.min(vw - lw - 8, r.x - lw / 2))) + 'px,' + Math.round(Math.max(uiTop(vw), ay - 4 - lh)) + 'px,0)';
      L.style.setProperty('--p', (i === want ? prog : 0).toFixed(3));
    }

    if (active < 0) return;
    // the active card floats just above its own stone and follows it as it rises on the steam; a short
    // steam tether joins the two. Hover-only cards can't be scrolled, so on desktop a card is never
    // shrunk: when there isn't room above the stone it floats beside it instead (phones scroll by swipe).
    const c = cards[active], p = pos[active], r = S.rocks[active];
    const narrow = vw < 700, top = uiTop(vw), bottom = vh - 80;
    let cs = sizeOf(c);
    let tx, ty, ax = null, ay = null;
    if (r && r.vis && !fallback) {
      ax = r.x; ay = r.y - Math.max(8, r.r * 0.85);                 // top of the stone
      const room = Math.round(ay - 22 - top);
      const mh = narrow ? Math.max(120, Math.min(420, room - 96)) : 2000;
      if (c._mh !== mh) { c._mh = mh; c.style.setProperty('--mh', mh + 'px'); size.delete(c); cs = sizeOf(c); }
      if (!narrow && cs.h > room) {
        if (!p.side) p.side = ax > vw / 2 ? -1 : 1;                 // chosen once per opening: no jumping
        const gap = r.r + 26;
        tx = Math.max(10, Math.min(vw - cs.w - 10, p.side > 0 ? ax + gap : ax - gap - cs.w));
        ty = Math.max(top, Math.min(bottom - cs.h, r.y - cs.h * 0.55));
      } else {
        p.side = 0;
        tx = Math.max(10, Math.min(vw - cs.w - 10, ax - cs.w / 2));
        ty = Math.max(top, ay - 22 - cs.h);
      }
    } else {
      if (c._mh !== 420) { c._mh = 420; c.style.setProperty('--mh', '420px'); size.delete(c); cs = sizeOf(c); }
      tx = (vw - cs.w) / 2; ty = Math.max(70, (vh - cs.h) / 2 - 20);
    }
    if (!p.init) { p.x = tx; p.y = ty + 14; p.init = true; }
    const k = reduce ? 1 : 0.16;
    p.x += (tx - p.x) * k; p.y += (ty - p.y) * k;
    c.style.setProperty('--x', p.x.toFixed(1) + 'px');
    c.style.setProperty('--y', p.y.toFixed(1) + 'px');
    if (ax === null) { path.classList.remove('on'); return; }
    if (p.side) {                                                   // beside the stone: a sideways tether
      const sx = r.x + p.side * r.r * 0.9, bx = p.side > 0 ? p.x + 2 : p.x + cs.w - 2;
      const by = Math.max(p.y + 30, Math.min(p.y + cs.h - 30, r.y));
      if (Math.abs(bx - sx) > 12) setTether(sx, r.y, bx, by, 1); else path.classList.remove('on');
      return;
    }
    const bx = Math.max(p.x + 26, Math.min(p.x + cs.w - 26, ax)), by = p.y + cs.h - 2;
    if (ay - by > 10) setTether(ax, ay, bx, by, 0);
    else path.classList.remove('on');
  }
  requestAnimationFrame(frame);
  // never leave the loading screen up if the 3D scene fails to start
  setTimeout(() => { const b = document.getElementById('boot'); if (b) { b.classList.add('done', 'gone'); setTimeout(() => b.remove(), 700); } }, 15000);

  // ---------- intro: once the camera glide settles, the five stones erupt one after another ----------
  (function intro() {
    const t0 = performance.now();
    (function wait() {
      const ready = fireOn() && S.rocks.length >= N && S.rocks.slice(0, N).every((r) => r && r.vis);
      // wait for the scene's opening camera glide to finish (it flags window.__arjunIntroDone)
      if ((!ready || !window.__arjunIntroDone) && performance.now() - t0 < 14000) { setTimeout(wait, 150); return; }
      setTimeout(() => {
        introDone = true;
        if (ready) for (let i = 0; i < N; i++) setTimeout(() => S.pop.push(i), 200 + i * 230);
      }, ready ? 250 : 0);
    })();
  })();

  // ---------- input ----------
  // touch: tap a stone to show its card, tap anywhere else to hide it (mouse users just hover)
  let downAt = null, touchOpen = -1;
  window.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'mouse' || !fireOn() || S.giftUp) return;
    if (e.target.closest && e.target.closest('.lv-card.on, .lv-track, .lv-quick, #btn-audio, #mini-ui, #lv-steam')) return;   // swiping inside an open card keeps it
    const i = e.target.closest && e.target.closest('.lv-label') ? Number(e.target.closest('.lv-label').dataset.i) : rockAt(e.clientX, e.clientY);
    touchOpen = i >= 0 && touchOpen !== i ? i : -1;
  }, true);
  // a click on a stone shouldn't also send a shockwave through the wall
  window.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('#lv')) return;
    if (fireOn() && !S.giftUp && downAt && rockAt(downAt.x, downAt.y) >= 0) e.stopPropagation();
  }, true);

  // phones: the theme picker is folded to the current theme; the first tap opens it, a pick closes it
  const picker = document.getElementById('mini-ui');
  const folded = () => window.matchMedia('(max-width: 700px) and (orientation: portrait)').matches;
  if (picker) {
    picker.addEventListener('click', (e) => {
      if (!folded()) return;
      const b = e.target.closest('.theme-btn');
      if (!b) return;
      if (!picker.classList.contains('open')) { picker.classList.add('open'); e.stopImmediatePropagation(); return; }
      picker.classList.remove('open');
    }, true);
    window.addEventListener('pointerdown', (e) => { if (picker.classList.contains('open') && !picker.contains(e.target)) picker.classList.remove('open'); }, true);
  }

  // other themes: one tap back to Fire, where the stones hold the CV
  $('#lv-back').addEventListener('click', () => {
    // switch the scene's theme directly (pressing the Fire button would only unfold the phone picker)
    const sel = document.getElementById('select-theme');
    if (!sel || sel.value === 'fire') return;
    sel.value = 'fire';
    sel.dispatchEvent(new Event('change'));
    const pk = document.getElementById('mini-ui');
    if (pk) pk.classList.remove('open');
  });

  labels.forEach((L, i) => {
    L.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') labelHover = i; });
    L.addEventListener('pointerleave', () => { if (labelHover === i) labelHover = -1; });
    L.addEventListener('focus', () => { focusIdx = i; });
    L.addEventListener('blur', () => { if (focusIdx === i) focusIdx = -1; });
  });
  dots.forEach((d, i) => {
    d.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') labelHover = i; });
    d.addEventListener('pointerleave', () => { if (labelHover === i) labelHover = -1; });
    d.addEventListener('focus', () => { focusIdx = i; });
    d.addEventListener('blur', () => { if (focusIdx === i) focusIdx = -1; });
  });
  cards.forEach((c) => c.setAttribute('aria-hidden', 'true'));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.activeElement && document.activeElement.blur) document.activeElement.blur();
  });

  $('#lv-mail').addEventListener('click', () => {
    const email = 'arjun.haridasan.1999@gmail.com';
    if (navigator.clipboard) navigator.clipboard.writeText(email).then(() => toast('Email copied: ' + email), () => toast(email));
    else toast(email);
  });
})();
