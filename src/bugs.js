(function () {
  'use strict';
  // "Bugs" button: a small form (name + what went wrong) that drops a row into the "Arjuns Portfolio bugs"
  // Google Sheet through its Apps Script web app (tools/bug-sheet.gs). Plain text only; the script caps lengths.
  const BUG_URL = 'https://script.google.com/macros/s/AKfycbw45hA5r7UeMsmpWtkTBSQC1EFNXTzfvWtHmP6vcrEtwjsqpWNSSP2OmOrbIQVpx3hu/exec';   // the Apps Script web app behind the bugs sheet
  const btn = document.getElementById('lv-bug');
  if (!btn) return;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };

  const wrap = el('div', 'lv-bugs'); wrap.setAttribute('aria-hidden', 'true');
  const box = el('form', 'lv-bugs-box'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'lv-bugs-h');
  const x = el('button', 'lv-bugs-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
  const h = el('h3', null, 'Found a bug?'); h.id = 'lv-bugs-h';
  const sub = el('p', null, 'Tell me what went wrong and I’ll look into it.');
  const nameL = el('label', null, 'Your name');
  const name = el('input'); name.type = 'text'; name.maxLength = 80; name.autocomplete = 'name'; name.placeholder = 'Optional';
  nameL.appendChild(name);
  const descL = el('label', null, 'What happened?');
  const desc = el('textarea'); desc.maxLength = 2000; desc.rows = 5; desc.required = true; desc.placeholder = 'What did you do, what did you expect, what happened instead?';
  descL.appendChild(desc);
  const trap = el('input'); trap.type = 'text'; trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.className = 'lv-bugs-trap'; trap.setAttribute('aria-hidden', 'true');
  const status = el('p', 'lv-bugs-status'); status.setAttribute('role', 'status');
  const send = el('button', 'lv-bugs-send', 'Send report'); send.type = 'submit';
  box.append(x, h, sub, nameL, descL, trap, send, status);
  wrap.appendChild(box);
  document.body.appendChild(wrap);

  let lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    status.textContent = ''; status.className = 'lv-bugs-status'; send.disabled = false;
    wrap.classList.add('on'); wrap.setAttribute('aria-hidden', 'false');
    setTimeout(() => (name.value ? desc : name).focus(), 60);
  }
  function close() {
    wrap.classList.remove('on'); wrap.setAttribute('aria-hidden', 'true');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  btn.addEventListener('click', open);
  x.addEventListener('click', close);
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && wrap.classList.contains('on')) close(); });
  // keys typed in the form must not reach the 3D scene's shortcuts
  box.addEventListener('keydown', (e) => e.stopPropagation());

  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = desc.value.trim();
    if (!text) { status.textContent = 'Please describe the bug first.'; status.className = 'lv-bugs-status err'; desc.focus(); return; }
    if (!BUG_URL) { status.textContent = 'Bug reports aren’t switched on yet. Please email me instead.'; status.className = 'lv-bugs-status err'; return; }
    send.disabled = true; status.textContent = 'Sending…'; status.className = 'lv-bugs-status';
    const body = JSON.stringify({ name: name.value.trim(), description: text, website: trap.value, page: location.pathname + location.search, device: navigator.userAgent.slice(0, 300) });
    try {
      // text/plain keeps it a "simple" request (no preflight, which Apps Script can't answer)
      await fetch(BUG_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
      status.textContent = 'Thanks! Your report is in.'; status.className = 'lv-bugs-status ok';
      desc.value = '';
      setTimeout(close, 1600);
    } catch (err) {
      status.textContent = 'Couldn’t send it. Please check your connection and try again.'; status.className = 'lv-bugs-status err';
      send.disabled = false;
    }
  });
})();
