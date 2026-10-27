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
  const lvRoot = $('#lv'), dimEl = $('#lv-dim');
  const labelsEl = $('#lv-labels'), dotsEl = $('#lv-dots'), track = $('#lv-track'), msg = $('#lv-msg');

  // ---------- labels + tracker dots ----------
  const labels = NAMES.map((n, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lv-label'; b.dataset.i = i;
    b.setAttribute('aria-label', n + ': reveal');
    const pill = document.createElement('span'); pill.className = 'lv-pill lv-mono';
    const t = document.createElement('span'); t.textContent = n;
    pill.append(t);
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
    if (i === 2 && skillsBox) requestAnimationFrame(() => openOrbit(SKILL_GROUPS[0], true));
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
  function pointAtMoon(tries) {
    // a card opened in the meantime: wait until it's closed again (the hint never sits over a card)
    if ((active >= 0 || S.hold >= 0) && (tries || 0) < 240) { setTimeout(() => pointAtMoon((tries || 0) + 1), 500); return; }
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
    steamEl.classList.add('on'); steamEl.setAttribute('aria-hidden', 'false'); document.body.classList.add('lv-steam-on');
  }
  function hidePanel() {
    if (!steamEl.classList.contains('on')) return;
    steamEl.classList.remove('on'); steamEl.setAttribute('aria-hidden', 'true'); document.body.classList.remove('lv-steam-on');
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

  // ---------- Skills: group hubs; hover / tap one and its skills pop out in a circle around a centre disc ----------
  // tool logos: Simple Icons (CC0) in their brand colours; MS Office and ComfyUI are simple drawn marks
  const SKILL_LOGOS = {"jira": {"name": "Jira", "hex": "#0052CC", "d": "M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z"}, "testrail": {"name": "TestRail", "hex": "#65C179", "d": "M7.27 23.896 4.5 21.124a.352.352 0 0 1 0-.5l2.772-2.77a.352.352 0 0 1 .5 0l2.772 2.772a.352.352 0 0 1 0 .5l-2.772 2.77a.352.352 0 0 1-.5 0H7.27zm4.48-4.48-2.772-2.772a.352.352 0 0 1 0-.498l2.772-2.772a.352.352 0 0 1 .5 0l2.77 2.772a.352.352 0 0 1 0 .5l-2.77 2.77a.352.352 0 0 1-.499 0zm4.48-4.48-2.77-2.772a.352.352 0 0 1 0-.498l2.771-2.772a.352.352 0 0 1 .5 0l2.77 2.772a.352.352 0 0 1 0 .498l-2.772 2.772a.352.352 0 0 1-.5 0h.002zm-8.876.084-2.772-2.77a.352.352 0 0 1 0-.499l2.772-2.773a.352.352 0 0 1 .5 0l2.772 2.772a.352.352 0 0 1 0 .498l-2.772 2.774a.352.352 0 0 1-.5 0v-.002zm4.48-4.48L9.062 7.77a.352.352 0 0 1 0-.5l2.772-2.772a.352.352 0 0 1 .5 0l2.77 2.772a.352.352 0 0 1 0 .498l-2.77 2.772a.352.352 0 0 1-.499 0v-.002.001zM7.44 6.15 4.666 3.37a.352.352 0 0 1 0-.5L7.44.104a.352.352 0 0 1 .5 0l2.772 2.772a.352.352 0 0 1 0 .5L7.938 6.142a.352.352 0 0 1-.5 0l.002.006v.001z"}, "selenium": {"name": "Selenium", "hex": "#43B02A", "d": "M23.174 3.468l-7.416 8.322a.228.228 0 0 1-.33 0l-3.786-3.9a.228.228 0 0 1 0-.282L12.872 6a.228.228 0 0 1 .366 0l2.106 2.346a.228.228 0 0 0 .342 0l5.94-8.094A.162.162 0 0 0 21.5 0H.716a.174.174 0 0 0-.174.174v23.652A.174.174 0 0 0 .716 24h22.566a.174.174 0 0 0 .174-.174V3.6a.162.162 0 0 0-.282-.132zM6.932 21.366a5.706 5.706 0 0 1-4.05-1.44.222.222 0 0 1 0-.288l.882-1.236a.222.222 0 0 1 .33-.036 4.338 4.338 0 0 0 2.964 1.158c1.158 0 1.722-.534 1.722-1.098 0-1.752-5.7-.552-5.7-4.278 0-1.65 1.428-3 3.756-3a5.568 5.568 0 0 1 3.708 1.242.222.222 0 0 1 0 .3l-.906 1.2a.222.222 0 0 1-.318.036 4.29 4.29 0 0 0-2.706-.936c-.906 0-1.41.402-1.41.996 0 1.572 5.688.522 5.688 4.2.006 1.812-1.284 3.18-3.96 3.18zm12.438-3.432a.192.192 0 0 1-.192.192h-5.202a.06.06 0 0 0-.06.066 1.986 1.986 0 0 0 2.106 1.638 3.264 3.264 0 0 0 1.8-.6.192.192 0 0 1 .276.042l.636.93a.198.198 0 0 1-.042.264 4.71 4.71 0 0 1-2.892.9 3.726 3.726 0 0 1-3.93-3.87 3.744 3.744 0 0 1 3.81-3.852c2.196 0 3.684 1.644 3.684 4.05zm-3.684-2.748a1.758 1.758 0 0 0-1.8 1.56.06.06 0 0 0 .06.066h3.492a.06.06 0 0 0 .06-.066 1.698 1.698 0 0 0-1.812-1.56Z"}, "openjdk": {"name": "Java", "hex": "#E76F00", "d": "M11.915 0 11.7.215C9.515 2.4 7.47 6.39 6.046 10.483c-1.064 1.024-3.633 2.81-3.711 3.551-.093.87 1.746 2.611 1.55 3.235-.198.625-1.304 1.408-1.014 1.939.1.188.823.011 1.277-.491a13.389 13.389 0 0 0-.017 2.14c.076.906.27 1.668.643 2.232.372.563.956.911 1.667.911.397 0 .727-.114 1.024-.264.298-.149.571-.33.91-.5.68-.34 1.634-.666 3.53-.604 1.903.062 2.872.39 3.559.704.687.314 1.15.664 1.925.664.767 0 1.395-.336 1.807-.9.412-.563.631-1.33.72-2.24.06-.623.055-1.32 0-2.066.454.45 1.117.604 1.213.424.29-.53-.816-1.314-1.013-1.937-.198-.624 1.642-2.366 1.549-3.236-.08-.748-2.707-2.568-3.748-3.586C16.428 6.374 14.308 2.394 12.13.215zm.175 6.038a2.95 2.95 0 0 1 2.943 2.942 2.95 2.95 0 0 1-2.943 2.943A2.95 2.95 0 0 1 9.148 8.98a2.95 2.95 0 0 1 2.942-2.942zM8.685 7.983a3.515 3.515 0 0 0-.145.997c0 1.951 1.6 3.55 3.55 3.55 1.95 0 3.55-1.598 3.55-3.55 0-.329-.046-.648-.132-.951.334.095.64.208.915.336a42.699 42.699 0 0 1 2.042 5.829c.678 2.545 1.01 4.92.846 6.607-.082.844-.29 1.51-.606 1.94-.315.431-.713.651-1.315.651-.593 0-.932-.27-1.673-.61-.741-.338-1.825-.694-3.792-.758-1.974-.064-3.073.293-3.821.669-.375.188-.659.373-.911.5s-.466.2-.752.2c-.53 0-.876-.209-1.16-.64-.285-.43-.474-1.101-.545-1.948-.141-1.693.176-4.069.823-6.614a43.155 43.155 0 0 1 1.934-5.783c.348-.167.749-.31 1.192-.425zm-3.382 4.362a.216.216 0 0 1 .13.031c-.166.56-.323 1.116-.463 1.665a33.849 33.849 0 0 0-.547 2.555 3.9 3.9 0 0 0-.2-.39c-.58-1.012-.914-1.642-1.16-2.08.315-.24 1.679-1.755 2.24-1.781zm13.394.01c.562.027 1.926 1.543 2.24 1.783-.246.438-.58 1.068-1.16 2.08a4.428 4.428 0 0 0-.163.309 32.354 32.354 0 0 0-.562-2.49 40.579 40.579 0 0 0-.482-1.652.216.216 0 0 1 .127-.03z"}, "n8n": {"name": "n8n", "hex": "#EA4B71", "d": "M21.4737 5.6842c-1.1772 0-2.1663.8051-2.4468 1.8947h-2.8955c-1.235 0-2.289.893-2.492 2.111l-.1038.623a1.263 1.263 0 0 1-1.246 1.0555H11.289c-.2805-1.0896-1.2696-1.8947-2.4468-1.8947s-2.1663.8051-2.4467 1.8947H4.973c-.2805-1.0896-1.2696-1.8947-2.4468-1.8947C1.1311 9.4737 0 10.6047 0 12s1.131 2.5263 2.5263 2.5263c1.1772 0 2.1663-.8051 2.4468-1.8947h1.4223c.2804 1.0896 1.2696 1.8947 2.4467 1.8947 1.1772 0 2.1663-.8051 2.4468-1.8947h1.0008a1.263 1.263 0 0 1 1.2459 1.0555l.1038.623c.203 1.218 1.257 2.111 2.492 2.111h.3692c.2804 1.0895 1.2696 1.8947 2.4468 1.8947 1.3952 0 2.5263-1.131 2.5263-2.5263s-1.131-2.5263-2.5263-2.5263c-1.1772 0-2.1664.805-2.4468 1.8947h-.3692a1.263 1.263 0 0 1-1.246-1.0555l-.1037-.623A2.52 2.52 0 0 0 13.9607 12a2.52 2.52 0 0 0 .821-1.4794l.1038-.623a1.263 1.263 0 0 1 1.2459-1.0555h2.8955c.2805 1.0896 1.2696 1.8947 2.4468 1.8947 1.3952 0 2.5263-1.131 2.5263-2.5263s-1.131-2.5263-2.5263-2.5263m0 1.2632a1.263 1.263 0 0 1 1.2631 1.2631 1.263 1.263 0 0 1-1.2631 1.2632 1.263 1.263 0 0 1-1.2632-1.2632 1.263 1.263 0 0 1 1.2632-1.2631M2.5263 10.7368A1.263 1.263 0 0 1 3.7895 12a1.263 1.263 0 0 1-1.2632 1.2632A1.263 1.263 0 0 1 1.2632 12a1.263 1.263 0 0 1 1.2631-1.2632m6.3158 0A1.263 1.263 0 0 1 10.1053 12a1.263 1.263 0 0 1-1.2632 1.2632A1.263 1.263 0 0 1 7.579 12a1.263 1.263 0 0 1 1.2632-1.2632m10.1053 3.7895a1.263 1.263 0 0 1 1.2631 1.2632 1.263 1.263 0 0 1-1.2631 1.2631 1.263 1.263 0 0 1-1.2632-1.2631 1.263 1.263 0 0 1 1.2632-1.2632"}, "github": {"name": "GitHub", "hex": "#181717", "d": "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"}, "huggingface": {"name": "Hugging Face", "hex": "#FFB000", "d": "M1.4446 11.5059c0 1.1021.1673 2.1585.4847 3.1563-.0378-.0028-.0691-.0058-.1058-.0058-.4209 0-.8015.16-1.0704.4512-.3454.3737-.4984.8335-.4316 1.293a1.576 1.576 0 0 0 .2148.5978c-.2319.1864-.4018.4456-.4844.7578-.0646.2448-.131.7543.2149 1.2794a1.4552 1.4552 0 0 0-.0625.1055c-.208.3923-.2207.8372-.0371 1.25.2783.6258.9696 1.1175 2.3126 1.6467.8356.3292 1.5988.5411 1.6056.543 1.1046.2847 2.104.4277 2.969.4277 1.4173 0 2.4754-.3849 3.1525-1.1446 1.538.2651 2.791.1403 3.592.006.6773.7555 1.7332 1.1387 3.1467 1.1387.8649 0 1.8643-.143 2.969-.4278.0068-.0019.77-.2138 1.6056-.543 1.343-.5292 2.0343-1.0208 2.3126-1.6466.1836-.4129.171-.8577-.037-1.25a1.4685 1.4685 0 0 0-.0626-.1056c.346-.525.2795-1.0346.2149-1.2793-.0826-.3122-.2525-.5714-.4844-.7579.11-.1816.1831-.3788.2148-.5977.0669-.4595-.0862-.9193-.4316-1.293-.2688-.2913-.6495-.4513-1.0704-.4513-.0209 0-.0376.0008-.0588.0018.3162-.9966.4846-2.0518.4846-3.1523 0-5.807-4.7362-10.5144-10.5789-10.5144-5.8426 0-10.5788 4.7073-10.5788 10.5144Zm10.5788-9.4831c5.2727 0 9.5476 4.246 9.5476 9.483a9.4201 9.4201 0 0 1-.2696 2.2365c-.0039-.0047-.0079-.011-.0117-.0156-.274-.3255-.6679-.5059-1.1075-.5059-.352 0-.714.1155-1.0763.3438-.2403.1517-.5058.422-.7793.7598-.2534-.3492-.608-.5832-1.0137-.6465a1.5174 1.5174 0 0 0-.2344-.0176c-.9263 0-1.4828.7993-1.6935 1.5177-.1046.2426-.6065 1.3482-1.3614 2.0978-1.1681 1.1601-1.4458 2.3534-.8396 3.6382-.843.1029-1.5836.0927-2.365-.006.5906-1.212.3626-2.4388-.8426-3.6322-.755-.7496-1.2568-1.8552-1.3614-2.0978-.2107-.7184-.7673-1.5177-1.6935-1.5177-.078 0-.1568.0054-.2344.0176-.4057.0633-.7604.2973-1.0137.6465-.2735-.3379-.539-.6081-.7794-.7598-.3622-.2283-.7243-.3438-1.0762-.3438-.4266 0-.8094.171-1.0821.4786a9.4208 9.4208 0 0 1-.2598-2.1936c0-5.237 4.2749-9.483 9.5475-9.483zM8.6443 7.0036c-.4838.0043-.9503.2667-1.1934.7227-.3536.6633-.1006 1.4873.5645 1.84.351.1862.4883-.5261.836-.6485.3107-.1095.841.399 1.0078.086.3536-.6634.1025-1.4874-.5625-1.84a1.3659 1.3659 0 0 0-.6524-.1602Zm6.8403 0c-.2199-.002-.4426.05-.6504.1602-.665.3526-.9181 1.1766-.5645 1.84.1669.313.6971-.1955 1.0079-.086.3476.1224.4867.8347.838.6485.6649-.3527.916-1.1767.5624-1.84-.243-.456-.7096-.7184-1.1934-.7227Zm-9.7565 1.418a.8768.8768 0 0 0-.877.877c0 .4846.3925.877.877.877a.8768.8768 0 0 0 .877-.877.8768.8768 0 0 0-.877-.877zm12.6434 0c-.4845 0-.879.3925-.879.877 0 .4846.3945.877.879.877a.8768.8768 0 0 0 .877-.877.8768.8768 0 0 0-.877-.877zM8.7927 11.459c-.179-.003-.2793.1107-.2793.416 0 .8097.3874 2.125 1.4279 2.924.207-.7123 1.3453-1.2832 1.5079-1.2012.2315.1167.2191.4417.6074.7266.3884-.285.374-.6098.6056-.7266.1627-.082 1.3009.4889 1.5079 1.2012 1.0404-.799 1.4278-2.1144 1.4278-2.924 0-1.2212-1.583.6402-3.5413.6485-1.4686-.0061-2.7266-1.0558-3.2639-1.0645zM4.312 14.4768c.5792.365 1.6964 2.2751 2.1056 3.0177.1371.2488.371.3536.582.3536.4188 0 .7465-.4138.0391-.9395-1.0636-.791-.6914-2.0846-.1836-2.1642a.4302.4302 0 0 1 .0664-.004c.4616 0 .666.7892.666.7892s.5959 1.4898 1.6213 2.508c.942.9356 1.062 1.703.4961 2.6661-.0164-.004-.0159.0236-.1484.2149-.1853.2673-.4322.4688-.7188.6152-.5062.2269-1.1397.2696-1.7833.2696-1.037 0-2.1017-.1824-2.6975-.336-.0293-.0075-3.6505-.9567-3.1916-1.8224.0771-.1454.2033-.2031.3633-.2031.6463 0 1.823.9551 2.3283.9551.113 0 .196-.0865.2285-.2031.2249-.8045-3.2787-1.0522-2.9846-2.1642.0519-.1967.193-.2757.3907-.2754.854 0 2.7704 1.4923 3.172 1.4923.0307 0 .0525-.0085.0645-.0274.2012-.3227.1096-.5865-1.3087-1.4395-1.4182-.8533-2.4315-1.329-1.8653-1.9416.0651-.0707.1574-.1015.2695-.1015.8611.0002 2.8948 1.84 2.8948 1.84s.5487.5683.8809.5683c.0762 0 .1416-.0315.1855-.1054.2355-.3946-2.1858-2.2183-2.3224-2.971-.0926-.51.0641-.7676.3555-.7676-.0006.008.1701-.0285.4942.1759zm16.2257.5918c-.1366.7526-2.5579 2.5764-2.3224 2.9709.044.074.1092.1055.1855.1055.3321 0 .881-.5684.881-.5684s2.0336-1.8397 2.8947-1.84c.1121 0 .2044.0308.2695.1016.5662.6125-.447 1.0882-1.8653 1.9415-1.4183.853-1.51 1.1168-1.3087 1.4396.012.0188.0337.0273.0644.0273.4016 0 2.3181-1.4923 3.1721-1.4923.1977-.0002.3388.0787.3907.2754.294 1.112-3.2095 1.3597-2.9846 2.1642.0325.1166.1156.2032.2285.2032.5054 0 1.682-.9552 2.3283-.9552.16 0 .2862.0577.3633.2032.459.8656-3.1623 1.8149-3.1916 1.8224-.5958.1535-1.6605.336-2.6975.336-.6351 0-1.261-.0409-1.7638-.2599-.2949-.1472-.5488-.3516-.7383-.625-.0411-.0682-.1026-.1476-.1426-.205-.5726-.9679-.455-1.7371.4903-2.676 1.0254-1.0182 1.6212-2.508 1.6212-2.508s.2044-.7891.666-.7891a.4318.4318 0 0 1 .0665.0039c.5078.0796.88 1.3732-.1836 2.1642-.7074.5257-.3797.9395.039.9395.211 0 .445-.1047.5821-.3535.4092-.7426 1.5264-2.6527 2.1056-3.0178.5588-.3524.99-.1816.8497.5918z"}, "davinciresolve": {"name": "DaVinci Resolve", "hex": "#233A51", "d": "M17.621 0 5.977.004c-1.37 0-2.756.345-3.762 1.11a4.925 4.925 0 0 0-1.61 2.003C.233 3.93 0 5.02 0 5.951l.012 12.2c.002 1.604.479 3.057 1.461 4.112.984 1.056 2.462 1.683 4.331 1.691L16.856 24c1.26.005 3.095-.036 4.303-.714 1.075-.605 2.025-1.556 2.497-2.984.278-.84.345-2.084.344-3.147l-.021-11.13c-.002-.888-.15-2.023-.547-2.934-.425-.976-1.181-1.815-2.322-2.425C20.353.26 19.123 0 17.622 0zm0 .93c1.378 0 2.538.295 3.04.565.977.523 1.544 1.166 1.889 1.96.315.721.47 1.793.473 2.572l.018 11.13c.002 1.013-.097 2.257-.298 2.86-.396 1.202-1.146 1.946-2.063 2.462-.814.457-2.612.593-3.82.588l-11.05-.044c-1.657-.007-2.832-.534-3.626-1.386-.792-.851-1.212-2.06-1.212-3.485L.999 5.95c0-.829.196-1.827.474-2.437.345-.757.75-1.207 1.365-1.674C3.585 1.27 4.868.97 6.08.97zm-5.66 3.423c-1.976.089-3.204 1.658-3.214 3.29.019 1.443 1.635 3.481 2.884 4.53.12.099.154.109.33.18.062.025.198-.047.327-.135.36-.245.993-.947 1.648-1.738a7.67 7.67 0 0 0 1.031-1.683c.409-.89.261-1.599.235-1.888a3.983 3.983 0 0 0-.99-1.692 3.36 3.36 0 0 0-2.251-.864zm4.172 7.922a10.185 10.185 0 0 0-3.244.61c-.15.058-.26.1-.374.17-.057.036-.11.135-.105.292.017.433.29 1.278.624 2.27.384 1.135 1.066 2.27 1.844 2.74a3.23 3.23 0 0 0 2.53.342c.832-.243 1.595-.868 1.962-1.546.986-1.818.19-3.548-1.121-4.417-.447-.296-1.133-.445-1.89-.46-.074 0-.15-.002-.226-.001zm-8.432.038a6.201 6.201 0 0 0-.752.047c-.596.078-.932.273-1.29.51a3.177 3.177 0 0 0-1.365 1.979c-.075.552-.086 1.053.033 1.507.433 1.389 1.326 2.222 2.847 2.452.636.028 1.37-.063 1.99-.45 1.269-.782 2.08-3.17 2.412-4.742.053-.176.035-.357-.013-.42-.005-.067-.044-.113-.19-.183-.398-.192-1.32-.417-2.375-.6a7.68 7.68 0 0 0-1.297-.1z"}, "canva": {"name": "Canva", "hex": "#00C4CC", "d": "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zM6.962 7.68c.754 0 1.337.549 1.405 1.2.069.583-.171 1.097-.822 1.406-.343.171-.48.172-.549.069-.034-.069 0-.137.069-.206.617-.514.617-.926.548-1.508-.034-.378-.308-.618-.583-.618-1.2 0-2.914 2.674-2.674 4.629.103.754.549 1.646 1.509 1.646.308 0 .65-.103.96-.24.5-.264.799-.47 1.097-.8-.073-.885.704-2.046 1.851-2.046.515 0 .926.205.96.583.068.514-.377.582-.514.582s-.378-.034-.378-.17c-.034-.138.309-.07.275-.378-.035-.206-.24-.274-.446-.274-.72 0-1.131.994-1.029 1.611.035.275.172.549.447.549.205 0 .514-.31.617-.755.068-.308.343-.514.583-.514.102 0 .17.034.205.171v.138c-.034.137-.137.548-.102.651 0 .069.034.171.17.171.092 0 .436-.18.777-.459.117-.59.253-1.298.253-1.357.034-.24.137-.48.617-.48.103 0 .171.034.205.171v.138l-.136.617c.445-.583 1.097-.994 1.508-.994.172 0 .309.102.309.274 0 .103 0 .274-.069.446-.137.377-.309.96-.412 1.474 0 .137.035.274.207.274.171 0 .685-.206 1.096-.754l.007-.004c-.002-.068-.007-.134-.007-.202 0-.411.035-.754.104-.994.068-.274.411-.514.617-.514.103 0 .205.069.205.171 0 .035 0 .103-.034.137-.137.446-.24.857-.24 1.269 0 .24.034.582.102.788 0 .034.035.069.07.069.068 0 .548-.445.89-1.028-.308-.206-.48-.549-.48-.96 0-.72.446-1.097.858-1.097.343 0 .617.24.617.72 0 .308-.103.65-.274.96h.102a.77.77 0 0 0 .584-.24.293.293 0 0 1 .134-.117c.335-.425.83-.74 1.41-.74.48 0 .924.205.959.582.068.515-.378.618-.515.618l-.002-.002c-.138 0-.377-.035-.377-.172 0-.137.309-.068.274-.376-.034-.206-.24-.275-.446-.275-.686 0-1.13.891-1.028 1.611.034.275.171.583.445.583.206 0 .515-.308.652-.754.068-.274.343-.514.583-.514.103 0 .17.034.205.171 0 .069 0 .206-.137.652-.17.308-.171.48-.137.617.034.274.171.48.309.583.034.034.068.102.068.102 0 .069-.034.138-.137.138-.034 0-.068 0-.103-.035-.514-.205-.72-.548-.789-.891-.205.24-.445.377-.72.377-.445 0-.89-.411-.96-.926a1.609 1.609 0 0 1 .075-.649c-.203.13-.422.203-.623.203h-.17c-.447.652-.927 1.098-1.27 1.303a.896.896 0 0 1-.377.104c-.068 0-.171-.035-.205-.104-.095-.152-.156-.392-.193-.667-.481.527-1.145.805-1.453.805-.343 0-.548-.206-.582-.55v-.376c.102-.754.377-1.2.377-1.337a.074.074 0 0 0-.069-.07c-.24 0-1.028.824-1.166 1.373l-.103.445c-.068.309-.377.515-.582.515-.103 0-.172-.035-.206-.172v-.137l.046-.233c-.435.31-.87.508-1.075.508-.308 0-.48-.172-.514-.412-.206.274-.445.412-.754.412-.352 0-.696-.24-.862-.593-.244.275-.523.553-.852.764-.48.309-1.028.549-1.68.549-.582 0-1.097-.309-1.371-.583-.412-.377-.651-.96-.686-1.509-.205-1.68.823-3.84 2.4-4.8.378-.205.755-.343 1.132-.343zm9.77 3.291c-.104 0-.172.172-.172.343 0 .274.137.583.309.755a1.74 1.74 0 0 0 .102-.583c0-.343-.137-.515-.24-.515z"}, "affinity": {"name": "Affinity", "hex": "#222324", "d": "M9.368 1.08h3.778l.318.55h1.082L24 18.004v.001l-2.036 3.47H13.69l.84 1.445h-.365l-.84-1.446H3.057l-.526-.923h-.652L0 17.298l.002-.001 2.41-4.176 2.23-1.288 3.69-6.39-.742-1.285L9.368 1.08zm2.224 5.652L5.066 18.008h6.25l-.723-1.246 6.808.006-5.809-10.036Z"}, "office": {"name": "MS Office · Teams", "hex": "#D83B01", "d": "M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z"}, "comfyui": {"name": "ComfyUI", "hex": "#1F1F1F", "text": "Comfy"}};
  const SKILL_GROUPS = [
    { k: 'game', name: 'Game testing', icon: 'M6 9h4M8 7v4M15 10h.01M18 8h.01M7.5 4.5h9a5 5 0 0 1 4.9 6l-1 5.2a2.6 2.6 0 0 1-4.6 1.1L14.5 15h-5l-1.3 1.8a2.6 2.6 0 0 1-4.6-1.1l-1-5.2a5 5 0 0 1 4.9-6z',
      items: ['Manual', 'Functionality', 'Regression', 'Smoke', 'Sanity', 'Ad-hoc', 'Re-testing', 'Compliance TRC/XR'] },
    { k: 'process', name: 'Process', icon: 'M4 6h6M4 12h10M4 18h6M17 4l3 3-3 3M14 17l3 3 3-3',
      items: ['SDLC', 'STLC', 'Test suites', 'Bug tracking', 'P0–P3 triage'] },
    { k: 'tools', name: 'Tools', icon: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
      logos: ['jira', 'testrail', 'selenium', 'openjdk', 'n8n', 'github', 'huggingface', 'office'] },
    { k: 'creative', name: 'Creative & AI', icon: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
      logos: ['comfyui', 'davinciresolve', 'canva', 'affinity'] },
    { k: 'people', name: 'People', icon: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 20a6.5 6.5 0 0 0-3-5.5',
      items: ['Team management', 'Task management', 'Communication', 'Adaptability', 'Problem-solving'] }
  ];
  const skillsBox = $('#lv-skills');
  let orbitFor = null;
  function svgIcon(d, cls, stroke) {
    const v = document.createElementNS(SVGNS, 'svg'); v.setAttribute('viewBox', '0 0 24 24'); v.setAttribute('class', cls); v.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); if (stroke) p.setAttribute('class', 'st'); v.appendChild(p);
    return v;
  }
  function logoBadge(key) {
    const L = SKILL_LOGOS[key];
    const b = el('span', 'lv-orb logo'); b.title = L.name; b.setAttribute('role', 'img'); b.setAttribute('aria-label', L.name);
    if (L.text) b.appendChild(el('b', 'lv-orb-txt', L.text));
    else { const v = svgIcon(L.d, 'lv-orb-svg'); v.style.color = L.hex; b.appendChild(v); }
    b.appendChild(el('span', 'lv-orb-tip', L.name));
    return b;
  }
  // the chosen group is the big centre circle with its skills in a ring around it; under it, a row of all five
  // (hover / tap one to open it). Hovering the centre circle and moving left steps to the group on the left
  // (right: the right), round and round; on touch, a swipe across it does the same.
  let skillIdx = 0;
  function openOrbit(g, force) {
    if (!skillsBox || (orbitFor === g && !force)) return;
    orbitFor = g; skillIdx = SKILL_GROUPS.indexOf(g);
    const strip = skillsBox.querySelector('.lv-strip'), box = skillsBox.querySelector('.lv-orbit');
    const sw = strip.clientWidth || 320, n = SKILL_GROUPS.length, gap = Math.min(54, sw / 6.5);
    strip.querySelectorAll('.lv-hub').forEach((x, k) => {
      x.classList.toggle('on', k === skillIdx);
      x.style.left = (sw / 2 + (k - (n - 1) / 2) * gap) + 'px';
    });
    box.querySelectorAll('.lv-orb').forEach((o) => o.remove());
    const core = box.querySelector('.lv-orbit-core'); core.textContent = '';
    core.append(svgIcon(g.icon, 'lv-core-ico', true), el('b', null, g.name));
    const nodes = g.logos ? g.logos.map(logoBadge) : g.items.map((x) => el('span', 'lv-orb chip', x));
    nodes.forEach((o) => box.appendChild(o));
    const w = box.clientWidth || 320, h = box.clientHeight || 280, hx = w / 2, hy = h / 2;
    let hh = 0;
    const half = nodes.map((o) => { hh = Math.max(hh, o.offsetHeight / 2); return o.offsetWidth / 2; });
    const rx = g.logos ? Math.min(140, w * 0.36) : Math.min(160, w * 0.38), ry = Math.min(h / 2 - hh - (g.logos ? 24 : 8), g.logos ? 100 : 108);   // logos: room for the name underneath
    // an even ring, clockwise from the top; an item that would touch the card's edge is nudged inward
    nodes.forEach((o, i) => {
      const r = -Math.PI / 2 + (i / nodes.length) * Math.PI * 2;
      o.style.setProperty('--x', Math.max(half[i] + 2, Math.min(w - half[i] - 2, hx + Math.cos(r) * rx)).toFixed(1) + 'px');
      o.style.setProperty('--y', (hy + Math.sin(r) * ry).toFixed(1) + 'px');
      o.style.setProperty('--i', String(i));
    });
    box.style.setProperty('--rx', rx + 'px'); box.style.setProperty('--ry', ry + 'px');
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');   // replay the pop-out
  }
  const stepSkill = (d) => openOrbit(SKILL_GROUPS[(skillIdx + d + SKILL_GROUPS.length) % SKILL_GROUPS.length]);
  if (skillsBox) {
    const strip = el('div', 'lv-strip');
    strip.setAttribute('role', 'tablist'); strip.setAttribute('aria-label', 'Skill groups');
    SKILL_GROUPS.forEach((g) => {
      const b = el('button', 'lv-hub'); b.type = 'button'; b.dataset.k = g.k; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', g.name); b.title = g.name;
      b.append(svgIcon(g.icon, 'lv-hub-ico', true), el('span', 'lv-hub-name', g.name));
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') openOrbit(g); });
      b.addEventListener('focus', () => openOrbit(g));
      b.addEventListener('click', () => openOrbit(g));
      strip.appendChild(b);
    });
    const box = el('div', 'lv-orbit'), core = el('div', 'lv-orbit-core');
    box.appendChild(core);
    // the centre circle: every ~30 px of sideways travel over it is one step that way
    let lastX = null, sx = null;
    core.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (lastX == null) { lastX = e.clientX; return; }
      const d = e.clientX - lastX;
      if (Math.abs(d) >= 30) { stepSkill(d < 0 ? -1 : 1); lastX = e.clientX; }
    });
    core.addEventListener('pointerleave', () => { lastX = null; });
    // touch: a swipe across it (finger left = the group on the left); a plain tap steps right
    core.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sx = e.clientX; });
    core.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx; sx = null;
      stepSkill(Math.abs(dx) > 24 && dx < 0 ? -1 : 1);
    });
    skillsBox.append(box, strip);
  }

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
    dimEl.classList.toggle('on', active >= 0 && fireOn() && !S.giftUp);

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
