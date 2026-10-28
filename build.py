# Builds index.html from the original scene (original.html: the ARJUN themes page) + the lava-stone
# portfolio UI in src/lv.*. Fire is the portfolio (stones carry the CV); the other themes stay one click away.
s = open('original.html', encoding='utf8').read()
css = open('src/lv.css', encoding='utf8').read()
html = open('src/lv.html', encoding='utf8').read()
js = open('src/lv.js', encoding='utf8').read()
# the Projects card data (Steam details, platforms) goes into lv.js
import json as _json
js = js.replace('/*PROJECTS*/null', _json.dumps(_json.load(open('src/projects.json', encoding='utf8')), ensure_ascii=False))


def sub1(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:70], s.count(old))
    s = s.replace(old, new)


# title / description
sub1('<title>ARJUN</title>', '<title>Arjun H · QA at Kwalee</title>\n  <meta name="description" content="Arjun H, QA at Kwalee (game testing). An interactive 3D portfolio: hover the stones in the lava.">\n  <meta name="theme-color" content="#150a06">')

# the theme picker stays (restyled into a left strip by lv.css); Fire button first = the portfolio
s = s.replace('<!-- themes: icon buttons along the bottom', '<!-- themes: a slim strip on the left (Fire = the lava-stone portfolio)')

sub1('<h1 id="hero-title" class="sr-only">ARJUN // IGLOO BLOCK MONUMENT</h1>',
     '<h1 id="hero-title" class="sr-only">Arjun H, QA at Kwalee: interactive portfolio</h1>\n' + html)

# always open on Fire (the portfolio); a theme picked during the visit isn't remembered
sub1("""      let savedTheme = 'fire';
      try { savedTheme = localStorage.getItem('arjunTheme') || 'fire'; } catch (e) { /* storage unavailable */ }
      if (!THEMES[savedTheme]) savedTheme = 'fire';
      document.getElementById('select-theme').value = savedTheme;
      syncThemeBtns(savedTheme);
      applyTheme(savedTheme);""", """      document.getElementById('select-theme').value = 'fire';
      syncThemeBtns('fire');
      applyTheme('fire');   // the portfolio opens on Fire; the other themes are a click away""")
sub1("        try { localStorage.setItem('arjunTheme', name); } catch (e) { /* storage unavailable */ }\n", "")
sub1("      let currentTheme = 'snow';", "      let currentTheme = 'fire';")
# tell the portfolio layer which theme is showing (the CV stones only exist in Fire)
sub1("""        currentTheme = name;
        const t = THEMES[name];""", """        currentTheme = name;
        document.documentElement.dataset.theme = name;
        (window.__pfScene = window.__pfScene || { hold: -1, rocks: [], pop: [] }).theme = name;
        const t = THEMES[name];""")

# ---- CPU tier: no GPU (software WebGL: SwiftShader, llvmpipe, Microsoft Basic Render) or ?lite ----
# GPU devices keep their full settings; only software rendering gets fewer pixels and lighter effects
sub1("""      const LOW_END = IS_MOBILE && ((navigator.deviceMemory || 4) <= 3 || (navigator.hardwareConcurrency || 4) <= 4);
      const Q = {""", """      const CPU_GL = /[?&]lite\\b/.test(location.search) || (() => {
        try {
          const gl = document.createElement('canvas').getContext('webgl');
          if (!gl) return false;
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
          const lose = gl.getExtension('WEBGL_lose_context');
          if (lose) lose.loseContext();
          return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
        } catch (e) { return false; }
      })();
      const LOW_END = CPU_GL || IS_MOBILE && ((navigator.deviceMemory || 4) <= 3 || (navigator.hardwareConcurrency || 4) <= 4);
      const Q = CPU_GL ? { dpr: 0.5, msaa: 0, shadow: 512, fx: 0.25, seaSeg: 48, bloomLevels: 3, seg: 0.35, tex: 256 } : {""")
sub1("        const minDpr = IS_MOBILE ? 0.75 : 1;", "        const minDpr = CPU_GL ? 0.35 : IS_MOBILE ? 0.75 : 1;")
sub1("      const STORM_N = IS_MOBILE ?", "      const STORM_N = CPU_GL ? 1500 : IS_MOBILE ?")

# ---- lava stones carry the CV: the UI reads stone screen positions and asks stones to stay up ----
# 1) a shared object, and the "natural" hover (before the UI's hold request) per stone
sub1("""      function updateFireRocks(dt, time) {
        // stones only jump when you hover them, and stay up while the pointer stays on them
        let hitSt = null;""", """      function updateFireRocks(dt, time) {
        // stones only jump when you hover them, and stay up while the pointer stays on them
        // (window.__pfScene: the portfolio UI reads each stone's screen spot and can hold one up)
        const PF = (window.__pfScene = window.__pfScene || { hold: -1, rocks: [], pop: [] });
        let hitSt = null;""")
sub1("""          st.hoverAge = over ? 0 : (st.hoverAge || 0) + dt;""",
     """          st.pfOver = over && !st.mobileHidden;
          if (PF.hold >= 0 && rockStates[PF.hold] === st) over = true;   // the UI keeps it up (pinned / card hovered)
          st.hoverAge = over ? 0 : (st.hoverAge || 0) + dt;""")
# 2) requested pops: the held stone, and the intro eruption
sub1("""          popRock(hitSt);
        }
        let glowSt = null;""", """          popRock(hitSt);
        }
        { const hs = rockStates[PF.hold]; if (hs && hs.phase === 'rest' && hs.cd <= 0) popRock(hs); }
        while (PF.pop.length) { const ps = rockStates[PF.pop.shift()]; if (ps && ps.phase === 'rest' && !ps.mobileHidden) { ps.cd = 0; popRock(ps, Math.sqrt(2 * 22 * 2.4)); } }
        let glowSt = null;""")
# the UI drives which stones jump; no random pops on the five CV stones while one is being read
sub1("""        nextAutoPop -= dt;""", """        nextAutoPop -= PF.hold >= 0 ? 0 : dt;""")
# 3) publish screen positions
sub1("""        if (glowSt) { pitLight.position.set(glowSt.rest.x, glowSt.rest.y + 1.2, glowSt.rest.z); pitLight.intensity = glowSt.open * 6 + Math.sin(time * 11) * 0.4 * glowSt.open + (glowSt.flash || 0) * 3.5; }
      }""", """        if (glowSt) { pitLight.position.set(glowSt.rest.x, glowSt.rest.y + 1.2, glowSt.rest.z); pitLight.intensity = glowSt.open * 6 + Math.sin(time * 11) * 0.4 * glowSt.open + (glowSt.flash || 0) * 3.5; }
        const PW = renderer.domElement.clientWidth, PH = renderer.domElement.clientHeight, camX = _rkR.setFromMatrixColumn(camera.matrixWorld, 0).clone();
        rockStates.forEach((st, i) => {
          const R = PF.rocks[i] || (PF.rocks[i] = {});
          const re = st.m.userData.r * Math.max(st.m.scale.x, st.m.scale.z);
          _rkV.copy(st.m.position).project(camera);
          R.x = (_rkV.x * 0.5 + 0.5) * PW; R.y = (0.5 - _rkV.y * 0.5) * PH;
          R.vis = st.m.visible && !st.mobileHidden && _rkV.z < 1 && Math.abs(_rkV.x) < 1.05;
          _rkV.copy(st.m.position).addScaledVector(camX, re).project(camera);
          R.r = Math.hypot((_rkV.x * 0.5 + 0.5) * PW - R.x, (0.5 - _rkV.y * 0.5) * PH - R.y);
          _rkV.set(st.rest.x, st.ground + re * 0.9 + 0.35, st.rest.z).project(camera);   // label anchor just above the pit
          R.lx = (_rkV.x * 0.5 + 0.5) * PW; R.ly = (0.5 - _rkV.y * 0.5) * PH;
          R.up = st.y; R.phase = st.phase; R.over = !!st.pfOver;
        });
      }""")
# a hovered stone floats lower (it used to climb to 5.5 units), so its card stays mid-screen where the eye is
sub1("        st.vy = vy || rnd(7, 10.5) / (0.6 + r * 0.5);           // smaller stones fly higher",
     "        st.vy = vy || Math.min(8.4, rnd(7, 10.5) / (0.6 + r * 0.5));   // smaller stones fly higher (a hover hop peaks ~1.6)")
sub1("            const topY = st.holdY + (5.5 - st.holdY) * st.pressure;",
     "            const topY = st.holdY + ((MOBILE_A ? 1.8 : 2.6) - st.holdY) * st.pressure;")
# handwritten font for the note in the gift box
s = s.replace('&amp;family=Syne:wght@800&amp;display=swap', '&amp;family=Syne:wght@800&amp;family=Caveat:wght@600;700&amp;display=swap')
# ---- the moon on a rubber band (src/moon.js): pull it out of its black hole, it snaps back ----
moon_js = open('src/moon.js', encoding='utf8').read()
sub1("      moon.renderOrder = -1;\n      scene.add(moon);",
     "      moon.renderOrder = -1;\n      scene.add(moon);\n      const moonRest = new THREE.Vector3(), moonPull = { busy: false };   // resting spot (in the black hole); busy while pulled")
sub1("        moon.position.set(focusX + Math.sin(yaw) * dist, 0.7 + Math.tan(elev) * dist, fitRadius - Math.cos(yaw) * dist);",
     "        moonRest.set(focusX + Math.sin(yaw) * dist, 0.7 + Math.tan(elev) * dist, fitRadius - Math.cos(yaw) * dist);\n        if (!moonPull.busy) moon.position.copy(moonRest);")
sub1("      container.addEventListener('pointerdown', (e) => {\n        initAudio();",
     moon_js + "      container.addEventListener('pointerdown', (e) => {\n        initAudio();")
sub1("        moon.quaternion.copy(camera.quaternion);",
     "        moon.quaternion.copy(camera.quaternion);\n        moonTether.update(wallDt);")
# phones: a calmer wall (slower, gentler auto wave; a tap only nudges a few blocks)
sub1("        waveSpeed: 0.45,", "        waveSpeed: MOBILE_A ? 0.28 : 0.45,   // phones: a slower sweep (~14 s a cycle)")
sub1("          if (waveOn) pushFrom(waveFocusX, waveFocusY, forceRadius * (MOBILE_A ? 0.8 : 1.05), 0.7, MOBILE_A ? 0.45 : 1);",
     "          if (waveOn) pushFrom(waveFocusX, waveFocusY, forceRadius * (MOBILE_A ? 0.65 : 1.05), 0.7, MOBILE_A ? 0.25 : 1);")
sub1("        const swR = MOBILE_A ? 8 : 22, swK = MOBILE_A ? 7 : 22;", "        const swR = MOBILE_A ? 6 : 22, swK = MOBILE_A ? 4 : 22;")
# instant loading screen as the first thing in <body> (the ~3.5 MB of embedded data follows it), faded with the intro veil
import re as _re
s, _n = _re.subn(r'(<body[^>]*>)', lambda m: m.group(1) + '\n  <div id="boot" aria-hidden="true"><b>Arjun H</b><span>QA · Kwalee</span><i></i></div>\n<script>' + open('src/watchdog.js', encoding='utf8').read() + '</script>', s, count=1)
assert _n == 1
sub1("              introVeil.style.opacity = '0';",
     "              introVeil.style.opacity = '0';\n              { const boot = document.getElementById('boot'); if (boot) { boot.classList.add('done'); setTimeout(() => boot.classList.add('gone'), 260); setTimeout(() => boot.remove(), 950); } }")
# lava pits drape over the ground (a flat disc on a slope sank into the uphill side and got clipped)
sub1("""      function layoutRocksForMobile() {""", """      function conformPit(pit) {
        // a disc with radial rings, every vertex lifted to the ground beneath it plus a hair
        if (!pit.userData.flat) {
          const g = new THREE.RingGeometry(0.0001, pit.geometry.parameters.radius, 40, 6);   // same uv layout as the circle
          g.rotateX(-Math.PI / 2);
          pit.geometry.dispose(); pit.geometry = g; pit.rotation.set(0, 0, 0);
          pit.userData.flat = g.attributes.position.array.slice();
        }
        const a = pit.geometry.attributes.position, f = pit.userData.flat, s = pit.scale.x;
        for (let i = 0; i < a.count; i++) a.setY(i, (duneY(pit.position.x + f[i * 3] * s, pit.position.z + f[i * 3 + 2] * s) + 0.06 - pit.position.y) / s);
        a.needsUpdate = true;
        pit.geometry.computeBoundingSphere();
      }
      function layoutRocksForMobile() {""")
sub1("          st.pit.position.set(hit.x, st.ground + 0.04, hit.z);", "          st.pit.position.set(hit.x, st.ground + 0.04, hit.z);\n          conformPit(st.pit);")
# the pyramid's polished cap sampled one tiny spot of the texture (a flat, plain tip): map it like the courses below
sub1("            pos.push(...A, ...B, ...C); uv.push(0.5, 0.93, 0.52, 0.93, 0.51, 0.95);",
     "            pos.push(...A, ...B, ...C); uv.push(-wc / U, capFrom / 4, wc / U, capFrom / 4, 0, courses / 4);")
# a jumping stone vents steam: a burst as it leaves the hole, and steam from the open hole while it is airborne
sub1("        st.phase = 'fly';\n        const c = st.rest;",
     "        st.phase = 'fly';\n        const c = st.rest;\n"
     "        for (let q = 0; q < 9; q++) spawn(fxMist, { p: [c.x + rnd(-0.35, 0.35) * r, st.ground + 0.15, c.z + rnd(-0.35, 0.35) * r], v: [rnd(-0.4, 0.4), rnd(2.2, 3.6), rnd(-0.4, 0.4)], life: rnd(1.4, 2.2), s0: rnd(0.6, 1.0) * (0.7 + r), s1: rnd(3.5, 5) * (0.7 + r), a: 0.42, c0: [0.96, 0.92, 0.86], c1: [0.78, 0.74, 0.7], d: 0.6 });")
sub1("            st.vy -= 22 * dt;\n            st.y += st.vy * dt;", "            st.vy -= 22 * dt;\n            st.y += st.vy * dt;\n            if (st.y > 0.05) emitSteam(st, dt, 0.5);   // the open hole vents while the stone is up")
# the bottom course stays planted: no push-out, wobble or shockwave kick (the rest of the wall still reacts)
sub1("          const pushAmt = b.push * b.pushReach;",
     "          if (t.y < wordMinY + 0.5) { b.push = 0; b.dispX = b.dispY = b.dispZ = 0; b.velX = b.velY = b.velZ = 0; b.rotBoost = 0; }\n"
     "          const pushAmt = b.push * b.pushReach;")
# phones: lighter rendering (no MSAA, 1.1x pixels, 4 bloom levels) and a touch more contrast/saturation (they looked washed out)
sub1("        dpr: IS_MOBILE ? (LOW_END ? 1.0 : 1.25) : 2,", "        dpr: IS_MOBILE ? (LOW_END ? 1.0 : 1.1) : 2,")
sub1("        msaa: IS_MOBILE ? (LOW_END ? 0 : 2) : 4,", "        msaa: IS_MOBILE ? 0 : 4,")
sub1("        bloomLevels: IS_MOBILE ? 5 : 6,", "        bloomLevels: IS_MOBILE ? 4 : 6,")
sub1("bloom.grade.uSat.value = gr.sat; bloom.grade.uContrast.value = gr.con;",
     "bloom.grade.uSat.value = gr.sat * (IS_MOBILE ? 1.08 : 1); bloom.grade.uContrast.value = gr.con * (IS_MOBILE ? 1.06 : 1);")
# the camera tracks a dragging finger closely (the slow follow read as lag on phones), and still glides after release
sub1("          const camK = 1 - Math.pow(1 - 0.08, wallDt * 60);   // normal follow (frame-rate independent)",
     "          const camK = 1 - Math.pow(1 - (isDragging ? (IS_TOUCH ? 0.3 : 0.16) : 0.08), wallDt * 60);   // tight while dragging, smooth glide after (frame-rate independent)")
# Stone and Electric: the stones in front wear the letter blocks' own material (same texture, carving, glow)
sub1("        desertRocks.children.forEach((m) => { m.material = name === 'fire' ? fireRockMat : rockMat; });",
     "        desertRocks.children.forEach((m, k) => {\n"
     "          const blockMat = (name === 'stone' || name === 'electric') && bricks.length ? bricks[(k * 7) % bricks.length].mesh.material : null;\n"
     "          m.material = name === 'fire' ? fireRockMat : blockMat || rockMat;\n"
     "        });")
# the page's own images (Steam capsules in assets/steam) may load
s = s.replace("img-src data: blob:;", "img-src 'self' data: blob:;", 1)
# writing in the snow (src/snow.js): press and drag carves crisp grooves; hover no longer ploughs by accident
snow_js = open('src/snow.js', encoding='utf8').read()
sub1("      let lastFurrow = null;\n      function updateSnow(dt, time) {",
     snow_js + "      let lastFurrow = null;\n      function updateSnow(dt, time) {\n        snowWrite.update(dt);")
sub1("        let ploughed = false;\n        if (pointerActive) {", "        let ploughed = false;\n        if (false && pointerActive) {   // replaced by press-and-drag writing (snowWrite)")
# no white portal ring when the scroll bursts the letters apart (the burst itself stays)
sub1("        portalRing.visible = portalDisc.visible = flare > 0.01;", "        portalRing.visible = portalDisc.visible = false;")
# phones: the five stones sit in the open lava in front of the big A (3 + 2, above the tracker), never behind its legs
sub1("      const MOBILE_ROCK_SPOTS = [[-0.6, -0.44], [0.1, -0.48], [0.62, -0.42], [-0.32, -0.62], [0.4, -0.64]];",
     "      const MOBILE_ROCK_SPOTS = [[-0.58, -0.5], [0, -0.47], [0.58, -0.5], [-0.3, -0.7], [0.3, -0.7]];   // 3 + 2 in the open lava below the A\n"
     "      const PHONE_ZOOM = 1.2, PHONE_LOOK_Y = -1.8;   // phones: a smaller A, framed higher, leaves the lower third to the lava field")
sub1("        const fitR = computeFitRadius();\n        fitRadius = fitR;",
     "        const fitR = computeFitRadius() * (MOBILE_A ? PHONE_ZOOM : 1);\n        fitRadius = fitR;")
sub1("        cam.lookAt(fx, 0.7, 0); cam.updateMatrixWorld(true);", "        cam.lookAt(fx, MOBILE_A ? PHONE_LOOK_Y : 0.7, 0); cam.updateMatrixWorld(true);")
sub1("        camera.lookAt(camFocusX, 0.7, 0);", "        camera.lookAt(camFocusX, MOBILE_A ? PHONE_LOOK_Y : 0.7, 0);")
# 4) lay the five CV stones out on desktop too (phones already get five fixed spots), hide the rest
sub1("""      function layoutRocksForMobile() {
        if (!MOBILE_A) return;""", """      // desktop: five CV stones in an arc across the lava field in front of the word
      const DESKTOP_ROCK_SPOTS = [[-0.62, -0.44], [-0.31, -0.64], [0.02, -0.5], [0.35, -0.64], [0.66, -0.44]];
      function layoutRocksForMobile() {
        const spots = MOBILE_A ? MOBILE_ROCK_SPOTS : DESKTOP_ROCK_SPOTS;""")
sub1("""          const spot = MOBILE_ROCK_SPOTS[i];""", """          const spot = spots[i];""")
sub1("""          if (!st.mobileScaled) {
            const k = 0.42;""", """          if (!st.mobileScaled) {
            const k = (MOBILE_A ? 0.9 : 1.5) / (st.m.userData.r * Math.max(st.m.scale.x, st.m.scale.z));   // even-sized CV stones""")
sub1("""        if (MOBILE_A) { camSpherical.targetRadius = fitR; layoutRocksForMobile(); }""",
     """        camSpherical.targetRadius = fitR; layoutRocksForMobile();""")

# attach styles + script
sub1('</head>', '<style>\n' + css + '\n</style>\n</head>')
assert s.count('</body>') == 1
s = s.replace('</body>', '<script>\n' + js + '\n</script>\n</body>')
# the Bugs form (posts to the Apps Script web app behind the bugs sheet)
s = s.replace('</body>', '<script>\n' + open('src/bugs.js', encoding='utf8').read() + '\n</script>\n</body>')



# ---------- loading: the heavy data lives in its own cached files instead of inside the page ----------
# (the page itself drops from ~4 MB to a few hundred KB, so it shows up fast; the files download in parallel)
_i = s.index('<!-- ARJUN_BLENDER_ASSETS'); _j = s.index('<script>', _i); _k = s.index('</script>', _j) + len('</script>')
s = s[:_j] + ("<script>window.__ARJUN_BLOCKS_URL = 'assets/blocks.bin';\n"
              "window.__ARJUN_TEX = { albedo: 'assets/tex/albedo.jpg', normal: 'assets/tex/normal.jpg', height: 'assets/tex/height.jpg', crack: 'assets/tex/crack.jpg' };</script>") + s[_k:]
sub1("""        const b64 = window.__ARJUN_BLOCKS_GZ_B64;
        if (!b64) return null;
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));""",
"""        let bin;
        if (window.__ARJUN_BLOCKS_URL) {
          const r = await fetch(window.__ARJUN_BLOCKS_URL);
          if (!r.ok) return null;
          bin = new Uint8Array(await r.arrayBuffer());
        } else {
          const b64 = window.__ARJUN_BLOCKS_GZ_B64;
          if (!b64) return null;
          bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        }""")
# three.js from the site itself (some networks / blockers stop cdnjs); same file, same integrity hash
sub1('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"', '<script src="assets/js/three.min.js"')
s = s.replace("script-src 'unsafe-inline' https://cdnjs.cloudflare.com;", "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;", 1)
s = s.replace("connect-src data: blob:;", "connect-src 'self' data: blob: https://script.google.com https://script.googleusercontent.com;", 1)   # + the Bugs form
# start the big downloads straight away
sub1('<meta name="theme-color" content="#150a06">', '<meta name="theme-color" content="#150a06">\n  <link rel="preload" href="assets/blocks.bin" as="fetch" crossorigin>\n  <link rel="preload" href="assets/tex/albedo.jpg" as="image">\n  <link rel="preload" href="assets/tex/normal.jpg" as="image">')

# the moon over the lava: a warm white rather than orange (its glow and rope take the same colour)
sub1("fire: { c: [1.35, 0.8, 0.48], a: 0.85, g: 0.55 },", "fire: { c: [1.32, 1.12, 0.94], a: 0.9, g: 0.55 },")

# stones leaping out of / landing in the lava: soft, soothing tones in place of the bursting / splashing noises
sub1("""        tone(d, t, 'sine', rndA(70, 90), rndA(190, 240), 0.16, 0.01, 0.18);           // thick bubble bursting
        tone(d, t + 0.05, 'sine', rndA(140, 170), rndA(60, 80), 0.08, 0.005, 0.22);
        nz(d, t, 'bandpass', 350, 1400, 1.6, 0.06, 0.01, 0.25, 0.6);                  // gurgle
        nz(d, t + 0.02, 'lowpass', 900, 250, 0.8, 0.07, 0.004, 0.18);                 // rock scraping loose
        nz(d, t + 0.06, 'highpass', 3000, 5000, 0.7, 0.03, 0.05, 0.5);                // hiss of escaping heat
        for (let i = 0; i < 4; i++) nz(d, t + 0.08 + R() * 0.3, 'bandpass', rndA(1800, 4500), rndA(1500, 3500), 2.5, rndA(0.025, 0.05), 0.001, rndA(0.01, 0.025));""",
"""        const n = [261.6, 293.7, 329.6, 392, 440][Math.floor(R() * 5)];            // a soft rising bloom on a pentatonic note
        tone(d, t, 'sine', n * 0.98, n, 0.05, 0.05, 0.7);
        tone(d, t + 0.06, 'sine', n * 1.5, n * 1.5, 0.022, 0.06, 0.8);              // a gentle fifth above""")
sub1("""        tone(d, t, 'sine', rndA(170, 210) - k * 50, rndA(70, 90) - k * 20, 0.06 + k * 0.08, 0.004, 0.14 + k * 0.12); // plop, deeper for big falls
        nz(d, t, 'lowpass', 700, 200, 0.8, 0.03 + k * 0.05, 0.004, 0.14 + k * 0.1);
        if (k > 0.7) nz(d, t + 0.02, 'bandpass', 900, 300, 1.2, 0.05 * k, 0.02, 0.4);   // the heavy slosh of a big splash
        nz(d, t + 0.04, 'highpass', 2600, 4200, 0.7, 0.018, 0.08, 0.55);              // soft sizzle
        for (let i = 0; i < 2; i++) nz(d, t + 0.05 + R() * 0.25, 'bandpass', rndA(2000, 4000), 2200, 2.5, 0.02, 0.001, 0.015);""",
"""        tone(d, t, 'sine', 130.8, 128, 0.03 + k * 0.025, 0.03, 0.6 + k * 0.3);       // a warm, muffled settle""")

open('index.html', 'w', encoding='utf8').write(s)
print('ok', len(s))
