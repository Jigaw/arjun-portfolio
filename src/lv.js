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
      setTimeout(pointAtMoon, 900);   // then a hand shows where the next surprise is
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
    const bx = Math.max(10, Math.min(window.innerWidth - bw - 10, M.x - bw / 2)), by = Math.max(10, M.y - bh - 34);
    bubble.style.left = bx + 'px'; bubble.style.top = by + 'px';
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
    const want = natural >= 0 ? natural : labelHover >= 0 ? labelHover : focusIdx >= 0 ? focusIdx : touchOpen;
    S.hold = want;

    // once the stone is out of the lava its label pill appears above it; holding the hover fills the
    // pill's dot like a ring and the full card bursts out of it. Moving away closes both at once.
    const R = S.rocks[want];
    // the hold timer starts with the hover itself (not when the stone happens to be up), so the card
    // always bursts out the same moment after you settle on a stone
    if (want !== hov.i) { hov.i = want; hov.upAt = want >= 0 ? now : 0; }
    const prog = hov.upAt ? Math.min(1, (now - hov.upAt) / HOLD) : 0;
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
    if (e.target.closest && e.target.closest('.lv-card.on, .lv-track, .lv-quick, #btn-audio, #mini-ui')) return;   // swiping inside an open card keeps it
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
