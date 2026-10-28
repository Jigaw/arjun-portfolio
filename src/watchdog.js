(function () {
  'use strict';
  // Loading safety net: if the 3D scene throws before it is up, takes too long, or the graphics card drops
  // the WebGL context, the loading screen never hangs forever. It steps aside for the 2D version of the CV
  // (the cards still open from the dots at the bottom) with a note offering to try the 3D scene again.
  const boot = document.getElementById('boot');
  if (!boot) return;
  const up = () => !document.getElementById('boot') || boot.classList.contains('done');
  let shown = false;
  function fail(why) {
    if (shown || (why !== 'lost' && up())) return;
    shown = true;
    document.documentElement.classList.add('pf-fail');
    if (!document.documentElement.dataset.theme) document.documentElement.dataset.theme = 'fire';   // the CV layer shows for the Fire theme
    if (boot.isConnected) { boot.classList.add('done'); setTimeout(() => boot.remove(), 600); }
    const note = document.createElement('div');
    note.id = 'pf-note'; note.setAttribute('role', 'status');
    const msg = document.createElement('p');
    msg.textContent = why === 'slow' ? 'The 3D scene is taking a while on this connection.' : 'The 3D scene couldn’t start on this device.';
    const sub = document.createElement('small');
    sub.textContent = why === 'lost' ? 'Your device ran short of graphics memory.' : 'The CV is still here: tap the dots below.';
    const again = document.createElement('button');
    again.type = 'button'; again.textContent = 'Try again';
    again.addEventListener('click', () => location.reload());
    const cv = document.createElement('a');
    cv.href = 'Arjun_H_CV.pdf'; cv.download = 'Arjun_H_CV.pdf'; cv.textContent = 'Download CV';
    const row = document.createElement('div'); row.append(again, cv);
    note.append(msg, sub, row);
    document.body.appendChild(note);
    // no stones to hover: the tracker's dots open the sections, and the note steps aside once one is opened
    const hint = document.getElementById('lv-msg');
    if (hint) hint.textContent = 'Tap a dot to open each section';
    const dots = document.getElementById('lv-dots');
    if (dots) dots.addEventListener('click', () => note.remove(), { once: true });
    // a late start (slow network, a hiccup that didn't stop the scene) still wins: the note goes once the scene is up
    if (why !== 'lost') {
      const iv = setInterval(() => {
        if (window.__pfScene && window.__pfScene.rocks && window.__pfScene.rocks.length) {
          clearInterval(iv); note.remove(); document.documentElement.classList.remove('pf-fail');
        }
      }, 500);
    }
  }
  window.addEventListener('error', (e) => { if (e.target === window || e.target == null || (e.target.tagName === 'SCRIPT')) fail('error'); }, true);
  window.addEventListener('unhandledrejection', () => fail('error'));
  setTimeout(() => fail('slow'), 35000);
  // the scene's canvas losing its context (out of graphics memory on a phone) leaves a frozen or black page
  // (the browser often hands it back by itself, so only say something if it doesn't within a few seconds)
  let restored = false;
  document.addEventListener('webglcontextrestored', () => { restored = true; }, true);
  document.addEventListener('webglcontextlost', () => { restored = false; setTimeout(() => { if (!restored) fail('lost'); }, 4000); }, true);
})();
