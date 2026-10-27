      // ===== The moon on a rope through a hole in a rubber sky. The rope runs from the moon through the
      // hole to a Christmas gift hanging behind the sky. Pull the moon and the rope slides out until the
      // gift reaches the hole; pull harder and the rubber rim stretches, harder still and the gift pops out
      // and dangles from the moon. Tap the gift to unbox it: a note inside. Close it and the hole slurps the
      // gift back, whose weight reels the moon home. Cartoon timing, real gravity, rope and momentum.
      // Injected into the scene by build.py (uses the scene's moon, camera, container and audio). =====
      const moonTether = (() => {
        const st = {
          mode: 'rest',            // rest | drag | return | float | inhale
          gift: 'in',              // in (behind the sky) | out | squeeze (being slurped back)
          ub: 'closed', ubT: 0,    // unboxing: closed | opening | open | closing
          m: new THREE.Vector2(), mv: new THREE.Vector2(), anchor: new THREE.Vector2(),   // moon (sky-plane units around the hole)
          g: new THREE.Vector2(), gv: new THREE.Vector2(),                               // gift (when out)
          gRot: 0, gSpin: 0, gScale: 1, idleT: 0, sqT: 0, present: false, nk: 0, nkv: 0, boxK: 1,   // nk: 0 = on the sky, 1 = up close to the viewer
          px: 0, py: 0, pid: -1, stretch: 0, wobT: 9, wobA: 0, gulpT: 9, time: 0
        };
        const HR = 0.9;   // hole radius in moon radii (the moon covers it at rest)

        // ---- the hole in the rubber sky: dark space inside, a lit rubber lip, a dimple that stretches toward
        // the pull and ripples after a pop ----
        const holeMat = new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uOpen: { value: 0 }, uStretch: { value: 0 }, uWobble: { value: 0 },
            uDir: { value: new THREE.Vector2(0, -1) }, uSky: { value: new THREE.Color(1, 1, 1) } },
          vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: `
uniform float uTime; uniform float uAlpha; uniform float uOpen; uniform float uStretch; uniform float uWobble; uniform vec2 uDir; uniform vec3 uSky; varying vec2 vUv;
float hh(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
void main() {
  vec2 q = (vUv - 0.5) * 2.0 * 3.0;                         // 1.0 = one moon radius
  vec2 pq = vec2(dot(q, uDir), dot(q, vec2(-uDir.y, uDir.x)));
  pq.x -= uStretch * 0.55; pq.x /= 1.0 + uStretch * 0.9; pq.y /= 1.0 - uStretch * 0.3;   // dragged open toward the rope
  float r = length(pq), R0 = ${HR.toFixed(2)};
  float core = 1.0 - smoothstep(R0 - 0.04, R0 + 0.02, r);
  float ring = exp(-pow((r - R0) / 0.55, 2.0));
  float ripple = sin(r * 7.0 - uTime * 14.0) * uWobble * exp(-max(r - R0, 0.0) * 0.8);
  float lit = normalize(q + 1e-4).y;                         // light from above on the rubber dimple
  float lip = exp(-pow((r - R0 - 0.06) / 0.05, 2.0));
  float star = step(0.985, hh(floor(q * 9.0))) * (1.0 - r / R0);   // a few stars in the dark beyond the sky
  vec3 space = vec3(0.01, 0.012, 0.025) + vec3(0.03, 0.04, 0.09) * (1.0 - r / R0) + vec3(star * 0.8);
  vec3 rubber = uSky * (1.0 + 0.45 * lit * (ring * (0.35 + uStretch) + ripple));
  vec3 col = mix(rubber, space, core) + uSky * lip * 0.55 * (0.4 + uOpen);
  float a = max(core * smoothstep(0.02, 0.25, uOpen), clamp(ring * 0.28 * (0.15 + uStretch + abs(ripple)) + lip * 0.5 * (0.25 + uOpen), 0.0, 1.0));
  gl_FragColor = vec4(col, a * uAlpha);
}`,
          transparent: true, depthWrite: false, fog: false
        });
        const hole = new THREE.Mesh(new THREE.PlaneGeometry(MOON_R * 6, MOON_R * 6), holeMat);
        hole.renderOrder = -2;
        scene.add(hole);

        // ---- the Christmas gift: snowflake wrapping paper, gold ribbon, a bow, a lid that comes off ----
        const S = MOON_R * 1.05, HB = S * 0.78, HL = S * 0.27;
        const gift = new THREE.Group(), lid = new THREE.Group(), bow = new THREE.Group();
        const giftMats = [];
        {
          // wrapping paper: a seamless tile (flakes that cross an edge are drawn on the other side too)
          const TS = 1024, cv = document.createElement('canvas'); cv.width = cv.height = TS;
          const g = cv.getContext('2d');
          g.fillStyle = '#c3172a'; g.fillRect(0, 0, TS, TS);
          let ps = 11;
          const pr = () => { ps = (ps * 16807) % 2147483647; return ps / 2147483647; };
          for (let i = 0; i < 2600; i++) { g.fillStyle = pr() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(60,0,8,0.05)'; g.fillRect(pr() * TS, pr() * TS, 2, 2); }   // paper grain
          const wrap = (fn, x, y, s) => { for (const dx of [-TS, 0, TS]) for (const dy of [-TS, 0, TS]) if (x + dx > -s && x + dx < TS + s && y + dy > -s && y + dy < TS + s) fn(x + dx, y + dy, s); };
          const flake = (x, y, s) => {
            g.strokeStyle = '#fff6ee'; g.lineCap = 'round'; g.lineWidth = Math.max(3, s * 0.11);
            for (let k = 0; k < 6; k++) {
              const a = k * Math.PI / 3 + 0.26, c = Math.cos(a), d = Math.sin(a);
              g.beginPath(); g.moveTo(x, y); g.lineTo(x + c * s, y + d * s); g.stroke();
              for (const f of [0.42, 0.7]) {                               // two pairs of barbs per arm
                const bx = x + c * s * f, by = y + d * s * f, bl = s * (0.88 - f) * 0.75;
                g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + 0.75) * bl, by + Math.sin(a + 0.75) * bl);
                g.moveTo(bx, by); g.lineTo(bx + Math.cos(a - 0.75) * bl, by + Math.sin(a - 0.75) * bl); g.stroke();
              }
            }
            g.fillStyle = '#fff6ee'; g.beginPath(); g.arc(x, y, s * 0.12, 0, Math.PI * 2); g.fill();
          };
          const star = (x, y, s) => {
            g.fillStyle = '#ffd36a'; g.beginPath();
            for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? s * 0.42 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
            g.closePath(); g.fill();
          };
          [[150, 170, 70], [560, 110, 48], [860, 330, 74], [360, 520, 56], [120, 820, 48], [700, 760, 66], [990, 900, 40], [520, 960, 30]].forEach(([x, y, s]) => wrap(flake, x, y, s));
          [[380, 230, 16], [720, 470, 14], [250, 690, 13], [930, 600, 15], [80, 470, 12], [610, 600, 10], [880, 70, 12], [380, 880, 14]].forEach(([x, y, s]) => wrap(star, x, y, s));
          const tex = new THREE.CanvasTexture(cv);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          const paper = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.5, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.45, fog: false,
            emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 });
          // a box whose paper is mapped by real size on every face: the pattern never squashes on the short sides
          const paperBox = (w, h, d) => {
            const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
            const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // +x -x +y -y +z -z
            for (let i = 0; i < uv.count; i++) { const f = dims[Math.floor(i / 4)]; uv.setXY(i, uv.getX(i) * f[0] / S, uv.getY(i) * f[1] / S); }
            return geo;
          };
          const gold = new THREE.MeshPhysicalMaterial({ color: 0xe9b544, roughness: 0.34, metalness: 0.35, clearcoat: 0.3, fog: false, emissive: 0x5a3a08, emissiveIntensity: 0.25 });
          const inside = new THREE.MeshBasicMaterial({ color: 0x1c0707, fog: false });
          giftMats.push(paper, gold, inside);
          const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
          const y0 = -S / 2;
          add(gift, paperBox(S, HB, S), paper, 0, y0 + HB / 2, 0);
          add(gift, new THREE.BoxGeometry(S * 1.01, HB * 1.005, S * 0.17), gold, 0, y0 + HB / 2, 0);
          add(gift, new THREE.BoxGeometry(S * 0.17, HB * 1.005, S * 1.01), gold, 0, y0 + HB / 2, 0);
          const hollow = add(gift, new THREE.PlaneGeometry(S * 0.9, S * 0.9), inside, 0, y0 + HB + 0.02, 0);   // the open top (dark inside)
          hollow.rotation.x = -Math.PI / 2;
          lid.position.set(0, y0 + HB + HL / 2 - S * 0.04, 0);
          add(lid, paperBox(S * 1.08, HL, S * 1.08), paper, 0, 0, 0);
          add(lid, new THREE.BoxGeometry(S * 1.09, HL * 1.01, S * 0.18), gold, 0, 0, 0);
          add(lid, new THREE.BoxGeometry(S * 0.18, HL * 1.01, S * 1.09), gold, 0, 0, 0);
          gift.add(lid);
          bow.position.set(0, HL / 2, 0);
          // a ribbon bow: two flat satin loops resting on a knot, two tails lying across the lid (nothing cuts into anything)
          const satin = gold.clone(); satin.side = THREE.DoubleSide;
          const ribbonLoop = (dir) => {
            const N = 44, A = S * 0.42, B = S * 0.26, wd = S * 0.15, pos = [], idx = [];
            for (let i = 0; i <= N; i++) {
              const t = i / N * Math.PI * 2, x = dir * (A / 2) * (1 - Math.cos(t)), y = (B / 2) * Math.sin(t);
              pos.push(x, y, -wd / 2, x, y, wd / 2);
              if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
            return g;
          };
          [-1, 1].forEach((sd) => { const l = add(bow, ribbonLoop(sd), satin, sd * S * 0.05, S * 0.07, 0); l.rotation.set(-0.25, 0, sd * 0.5); });
          [-1, 1].forEach((sd) => { const t = add(bow, new THREE.PlaneGeometry(S * 0.11, S * 0.36), satin, sd * S * 0.1, S * 0.012, S * 0.12); t.rotation.set(-Math.PI / 2, 0, sd * 0.45); });
          add(bow, new THREE.SphereGeometry(S * 0.085, 16, 12), gold, 0, S * 0.055, 0).scale.set(1, 0.75, 1);   // the knot
          lid.add(bow);
          hollow.visible = false;   // the dark inside only exists once the lid is off
          gift.userData.hollow = hollow;
          // drawn after the backdrop (below): solid, depth-tested against itself; the first part clears the depth
          // once the backdrop is up, so nothing in the scene can poke through the box
          gift.traverse((o) => { if (o.isMesh) { o.material.transparent = true; o.renderOrder = 20; } });
          gift.children[0].renderOrder = 19.5;
          gift.children[0].onBeforeRender = (r) => {
            // once it comes at you nothing in the scene (letters, ground) can cut through it. The backdrop drawn just
            // before leaves depth writes off, and a depth clear is ignored while they are off, so turn them back on first
            if (st.nk > 0.02) { r.state.buffers.depth.setMask(true); r.clearDepth(); }
          };
        }
        gift.visible = false;
        scene.add(gift);

        // ---- when the gift comes at you the world behind fades into a still Christmas evening ----
        // the rubber sky, dragged forward out of the hole with the gift until it is the whole background
        const backdropMat = new THREE.ShaderMaterial({
          uniforms: { uK: { value: 0 }, uHole: { value: new THREE.Vector2(0.5, 0.8) }, uPull: { value: new THREE.Vector2(0.5, 0.4) }, uAspect: { value: 1 },
            uSky0: { value: new THREE.Color() }, uSky1: { value: new THREE.Color() }, uSky2: { value: new THREE.Color() } },
          vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: `
uniform float uK; uniform vec2 uHole; uniform vec2 uPull; uniform float uAspect; uniform vec3 uSky0; uniform vec3 uSky1; uniform vec3 uSky2; varying vec2 vUv;
vec3 sky(float y) { return y > 0.45 ? mix(uSky1, uSky0, smoothstep(0.45, 1.0, y)) : mix(uSky2, uSky1, smoothstep(0.0, 0.45, y)); }
void main() {
  vec2 c = mix(uHole, uPull, smoothstep(0.0, 1.0, uK));          // the membrane's peak travels from the hole to the gift
  vec2 d = (vUv - c) * vec2(uAspect, 1.0);
  float r = length(d), ang = atan(d.y, d.x);
  // stretched rubber: the sky's colours are dragged toward the peak, radial tension creases, a taut sheen
  float y = mix(vUv.y, c.y, 0.55 * exp(-r * 1.6));
  vec3 col = sky(y);
  float crease = sin(ang * 16.0 + r * 3.0) * 0.5 + 0.5;
  col *= 1.0 + (crease - 0.5) * 0.16 * smoothstep(0.04, 0.5, r);
  col += vec3(1.0) * pow(max(0.0, 1.0 - abs(r - 0.28) * 3.2), 3.0) * 0.12;   // sheen ring round the peak
  col *= 1.0 - smoothstep(0.35, 1.25, r) * 0.45;                              // pulled thin and shadowed at the edges
  col *= 1.0 - smoothstep(0.03, 0.0, r) * 0.25;
  // it spreads out of the hole: a growing disc that reaches every corner by the end
  float R = pow(uK, 1.3) * 1.9;
  float e = length((vUv - uHole) * vec2(uAspect, 1.0));
  float a = 1.0 - smoothstep(R - 0.12, R, e);
  col += vec3(1.0, 0.95, 0.9) * smoothstep(R - 0.14, R - 0.06, e) * (1.0 - smoothstep(R - 0.06, R, e)) * 0.35 * (1.0 - uK);   // the lit rubber lip of the spreading edge
  gl_FragColor = vec4(col, a * smoothstep(0.0, 0.15, uK));
}`,
          transparent: true, depthTest: false, depthWrite: false, fog: false
        });
        const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backdropMat);
        backdrop.renderOrder = 15; backdrop.frustumCulled = false; backdrop.visible = false;
        scene.add(backdrop);
        const lidHome = lid.position.clone(), lidFly = { p: new THREE.Vector3(), v: new THREE.Vector3(), spin: 0 };

        // confetti + a warm glow out of the open box
        const confetti = [];
        {
          const pal = [0xffcf52, 0xff5a5a, 0x6fe08a, 0x6fb7ff, 0xffffff, 0xff9a3d];
          const geo = new THREE.PlaneGeometry(S * 0.13, S * 0.07);
          for (let i = 0; i < 40; i++) {
            const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: pal[i % pal.length], side: THREE.DoubleSide, fog: false, transparent: true, depthTest: false }));
            m.renderOrder = 22; m.visible = false; scene.add(m);
            confetti.push({ m, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, rot: 0, spin: 0 });
          }
        }
        const glowMat = new THREE.ShaderMaterial({
          uniforms: { uA: { value: 0 } },
          vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform float uA; varying vec2 vUv; void main() { vec2 q = vUv - 0.5; float r = length(q * vec2(1.0, 1.6)); float g = exp(-r * r * 18.0); float rays = 0.9 + 0.1 * sin(atan(q.y, q.x) * 7.0); gl_FragColor = vec4(vec3(1.8, 1.4, 0.8) * g * rays, g * uA); }',
          transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(S * 3.2, S * 3.2), glowMat);
        glow.renderOrder = 21.5; glow.visible = false; scene.add(glow);

        // the note inside (real text, so it stays crisp): built with DOM calls, nothing user-supplied
        const note = document.createElement('div');
        note.id = 'gift-note'; note.setAttribute('role', 'dialog'); note.setAttribute('aria-label', 'Note from Arjun');
        {
          const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
          const close = el('button', 'gn-x', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close the note');
          const NS = 'http://www.w3.org/2000/svg';
          const svgEl = (cls, viewBox, d) => { const v = document.createElementNS(NS, 'svg'); v.setAttribute('class', cls); v.setAttribute('viewBox', viewBox); v.setAttribute('aria-hidden', 'true'); const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); v.appendChild(p); return v; };
          const EMAIL = 'arjun.haridasan.1999@gmail.com';
          const actions = el('div', 'gn-actions');
          const mail = el('a', 'gn-btn'); mail.href = 'mailto:' + EMAIL;
          mail.append(svgEl('gn-ico', '0 0 24 24', 'M3 6h18v12H3zM3 7l9 6 9-6'), document.createTextNode('Email me'));
          const copy = el('button', 'gn-btn ghost', 'Copy address'); copy.type = 'button';
          copy.addEventListener('click', () => {
            const done = () => { copy.textContent = 'Copied!'; setTimeout(() => { copy.textContent = 'Copy address'; }, 1600); };
            if (navigator.clipboard) navigator.clipboard.writeText(EMAIL).then(done, () => { copy.textContent = EMAIL; });
            else copy.textContent = EMAIL;
          });
          actions.append(mail, copy);
          const sig = el('p', 'gn-sig', '— Arjun H');
          sig.appendChild(svgEl('gn-swoosh', '0 0 120 20', 'M4 14 C 30 4, 60 18, 88 8 S 114 6, 116 10'));   // an ink swoosh under the name
          note.append(close, el('p', 'gn-hi', 'Dear recruiter,'), el('p', 'gn-big', 'Please hire me!'), sig, actions);
          close.addEventListener('click', () => closeBox());
          document.body.appendChild(note);
        }

        // ---- the rope: a camera-facing glowing strip along a (possibly sagging) curve ----
        const SEG = 32;
        const sPos = new Float32Array((SEG + 1) * 2 * 3), sSide = new Float32Array((SEG + 1) * 2), sT = new Float32Array((SEG + 1) * 2), sIdx = [];
        for (let i = 0; i <= SEG; i++) {
          sSide[i * 2] = -1; sSide[i * 2 + 1] = 1; sT[i * 2] = sT[i * 2 + 1] = i / SEG;
          if (i < SEG) { const a = i * 2; sIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const sGeo = new THREE.BufferGeometry();
        sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
        sGeo.setAttribute('aSide', new THREE.BufferAttribute(sSide, 1));
        sGeo.setAttribute('aT', new THREE.BufferAttribute(sT, 1));
        sGeo.setIndex(sIdx);
        const sMat = new THREE.ShaderMaterial({
          uniforms: { uColor: { value: new THREE.Color(1.5, 1.5, 1.6) }, uAlpha: { value: 0 } },
          vertexShader: 'attribute float aSide; attribute float aT; varying float vSide; varying float vT; void main() { vSide = aSide; vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying float vSide; varying float vT; void main() { float x = vSide; float core = exp(-x * x * 18.0); float halo = exp(-x * x * 3.0) * 0.35; gl_FragColor = vec4(uColor * (core * 1.4 + halo), (core + halo) * uAlpha * smoothstep(0.0, 0.04, vT) * smoothstep(1.0, 0.96, vT)); }',
          transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
        });
        const string = new THREE.Mesh(sGeo, sMat);
        string.frustumCulled = false; string.renderOrder = -1.5; string.visible = false;
        scene.add(string);

        // ---- sky-plane basis around the hole (world units at the moon's distance) ----
        const R = new THREE.Vector3(), U = new THREE.Vector3(), v = new THREE.Vector3(), w = new THREE.Vector3();
        const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), t2 = new THREE.Vector2(), n2 = new THREE.Vector2(), z2 = new THREE.Vector2();
        const fwd = new THREE.Vector3(), nearP = new THREE.Vector3(), top = new THREE.Vector3();
        const toWorld = (p, out) => out.copy(moonRest).addScaledVector(R, p.x).addScaledVector(U, p.y);
        const live = () => moon.visible && moonMat.uniforms.uAlpha.value > 0.05;
        function screenOf(p) { v.copy(p).project(camera); return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (0.5 - v.y * 0.5) * window.innerHeight, ok: v.z < 1 }; }
        function screenRadius(p, r) { const c = screenOf(p); const e = screenOf(w.copy(p).addScaledVector(R, r)); return { c, r: Math.hypot(e.x - c.x, e.y - c.y) }; }
        function hitMoon(x, y) {
          if (!live() || !window.__arjunIntroDone) return false;
          R.setFromMatrixColumn(camera.matrixWorld, 0);
          const s = screenRadius(moon.position, MOON_R * moon.scale.x);
          return s.c.ok && Math.hypot(x - s.c.x, y - s.c.y) < Math.max(26, s.r * 1.35);
        }
        function hitGift(x, y) {
          if (!gift.visible || st.gift !== 'out') return false;
          R.setFromMatrixColumn(camera.matrixWorld, 0);
          const s = screenRadius(gift.position, S * 0.75 * st.gScale);
          return s.c.ok && Math.hypot(x - s.c.x, y - s.c.y) < Math.max(30, s.r * 1.3);
        }
        function sound(kind, amt = 0) {
          try {
            if (!audioCtx || !audioEnabled) return;
            const tone = (type, f0, f1, peak, len, at = 0) => {
              const t0 = audioCtx.currentTime + at, o = audioCtx.createOscillator(), g = audioCtx.createGain();
              o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + len * 0.8);
              g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
              o.connect(g); g.connect(audioOut()); o.start(t0); o.stop(t0 + len + 0.05);
            };
            if (kind === 'pop') tone('sine', 780, 190, 0.12, 0.2);
            else if (kind === 'boing') tone('triangle', 150, 95, 0.06, 0.55);
            else if (kind === 'slurp') tone('sawtooth', 120, 520, 0.035, 0.32);
            else if (kind === 'creak') tone('triangle', 70 + amt * 60, 0, 0.02, 0.12);
            else if (kind === 'zip') tone('sawtooth', 300, 1400, 0.03, 0.18);
            else if (kind === 'whoosh') tone('triangle', 520, 140, 0.05, 0.35);
            else if (kind === 'tada') { tone('sine', 523, 0, 0.07, 0.5); tone('sine', 659, 0, 0.07, 0.5, 0.09); tone('sine', 784, 0, 0.08, 0.7, 0.18); tone('sine', 1047, 0, 0.05, 0.8, 0.27); }
            else if (kind === 'tap') tone('sine', 300, 220, 0.05, 0.12);
            else tone('sine', 95, 32, 0.11, 0.5);   // thunk
          } catch (e) { /* audio unavailable */ }
        }
        const buzz = (ms) => {   // phones only, and only once the visitor has really touched the page
          try { if (IS_TOUCH && navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(ms); } catch (e) { /* no haptics */ }
        };
        const swallowClick = (e) => { e.stopPropagation(); e.preventDefault(); };
        const eatNextClick = () => { window.addEventListener('click', swallowClick, { capture: true, once: true }); setTimeout(() => window.removeEventListener('click', swallowClick, true), 400); };
        // a pull that ends before the gift pops is a failed try; from the 2nd one the moon asks for more
        let fails = 0;
        function moonSays(text) {
          const b = document.createElement('div');
          b.className = 'lv-moon-note'; b.textContent = text; b.setAttribute('role', 'status');
          document.body.appendChild(b);
          const ms = screenOf(moonRest), bw = b.offsetWidth, bh = b.offsetHeight;
          const bx = Math.max(10, Math.min(window.innerWidth - bw - 10, ms.x - bw / 2));
          b.style.left = bx + 'px'; b.style.top = Math.max(10, ms.y - bh - 34) + 'px';
          b.style.setProperty('--tail', Math.max(14, Math.min(bw - 14, ms.x - bx)) + 'px');
          b.animate([
            { opacity: 0, transform: 'translateY(8px) scale(0.8) rotate(-3deg)' },
            { opacity: 1, transform: 'translateY(0) scale(1.06) rotate(-3deg)', offset: 0.14 },
            { opacity: 1, transform: 'translateY(0) scale(1) rotate(-3deg)', offset: 0.22 },
            { opacity: 1, transform: 'translateY(0) scale(1) rotate(-3deg)', offset: 0.85 },
            { opacity: 0, transform: 'translateY(-6px) scale(0.96) rotate(-3deg)' }
          ], { duration: 2400, easing: 'ease-out', fill: 'forwards' }).onfinish = () => b.remove();
        }
        function release() {
          st.pid = -1;
          if (st.gift === 'out') { st.mode = 'float'; st.anchor.copy(st.m); st.idleT = 0; }
          else {
            st.mode = 'return';
            if (st.m.length() > MOON_R * 2.5 && ++fails >= 2) setTimeout(() => moonSays(st.stretch > 0.05 || fails > 2 ? 'Pull harder!' : 'Pull harder… all the way!'), 450);
          }
          eatNextClick();   // letting go is not a click on the wall
        }
        function openBox() {
          if (st.ub !== 'closed' || st.gift !== 'out') return;
          st.ub = 'opening'; st.ubT = 0; st.idleT = 0; st.present = true;
          sound('tap'); buzz(10);
        }
        // a tap outside the note: straight back to the A, front on (no closing animation)
        function backToA() {
          note.classList.remove('on');
          st.mode = 'rest'; st.gift = 'in'; st.ub = 'closed'; st.present = false; st.nk = 0; st.nkv = 0; st.boxK = 1;
          st.m.set(0, 0); st.mv.set(0, 0); st.g.set(0, 0); st.gv.set(0, 0); st.stretch = 0; st.wobA = 0; st.idleT = 0;
          st.bowGone = st.lidOff = st.burst = st.lidBack = false;
          if (lid.parent !== gift) gift.add(lid);
          lid.position.copy(lidHome); lid.rotation.set(0, 0, 0); lid.visible = true;
          bow.scale.setScalar(1); bow.position.y = HL / 2; bow.rotation.z = 0; gift.userData.hollow.visible = false;
          confetti.forEach((c) => { c.m.visible = false; });
          fitFullWordInView();                                         // the front view of the word, snapped
          camSpherical.radius = camSpherical.targetRadius; camSpherical.theta = camSpherical.targetTheta; camSpherical.phi = camSpherical.targetPhi;
          renderer.domElement.style.cursor = '';
        }
        function closeBox() {
          if (st.ub !== 'open') return;
          st.ub = 'closing'; st.ubT = 0;
          note.classList.remove('on');
        }
        // capture phase on the container: grabs on the moon or taps on the gift never reach the camera orbit
        container.addEventListener('pointerdown', (e) => {
          if (hitGift(e.clientX, e.clientY)) { e.stopPropagation(); initAudio(); eatNextClick(); openBox(); return; }
          if (st.ub === 'open') { e.stopPropagation(); eatNextClick(); backToA(); return; }   // note is up: any tap outside it goes home
          if (!hitMoon(e.clientX, e.clientY)) return;
          e.stopPropagation();
          initAudio();
          if (st.gift === 'squeeze' || st.ub !== 'closed' && st.ub !== 'open') return;   // let a slurp / lid animation finish
          st.mode = 'drag'; st.pid = e.pointerId; st.px = e.clientX; st.py = e.clientY; pointerActive = false;
          renderer.domElement.style.cursor = 'grabbing';
        }, true);
        window.addEventListener('pointermove', (e) => {
          // while the moon is held the wall ignores the pointer (no bursting blocks under the drag)
          if (st.mode === 'drag' && e.pointerId === st.pid) { st.px = e.clientX; st.py = e.clientY; pointerActive = false; e.stopImmediatePropagation(); return; }
          if (e.pointerType === 'mouse') renderer.domElement.style.cursor = hitMoon(e.clientX, e.clientY) ? 'grab' : hitGift(e.clientX, e.clientY) && st.ub === 'closed' ? 'pointer' : '';
        });
        const up = (e) => { if (st.mode === 'drag' && e.pointerId === st.pid) { renderer.domElement.style.cursor = ''; release(); } };
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBox(); });

        function popGift(dir, D) {
          fails = 0;
          st.gift = 'out'; st.ub = 'closed'; st.present = true;   // straight out of the hole it comes at the viewer, growing
          st.g.copy(dir).multiplyScalar(MOON_R * 0.4);
          st.gv.copy(dir).multiplyScalar(D * 0.9).add(t2.set(0, D * 0.35));   // flung out toward the moon, a little up
          st.gSpin = (Math.random() < 0.5 ? -1 : 1) * 9; st.gRot = 0;
          st.gScale = 0.35; st.wobT = 0; st.wobA = 1; st.stretch = 0;
          sound('pop'); setTimeout(() => sound('boing'), 60); buzz(15);
        }
        function burstConfetti() {
          // out of the open top, in 3D around the box (wherever it is)
          confetti.forEach((c) => {
            const a = Math.PI / 2 + (Math.random() - 0.5) * 1.9, sp = S * (2.5 + Math.random() * 3);
            c.p.copy(gift.position).addScaledVector(U, S * 0.4);
            c.v.copy(R).multiplyScalar(Math.cos(a) * sp).addScaledVector(U, Math.sin(a) * sp).addScaledVector(fwd, -Math.random() * S * 1.5);
            c.life = 1.4 + Math.random() * 0.8; c.rot = Math.random() * 6; c.spin = (Math.random() - 0.5) * 18; c.m.visible = true;
          });
        }

        function step(h, D) {
          const L = D * 0.16, POP = D * 0.07, E = POP * 1.3, G = D * 1.5;
          if (st.mode === 'drag') {
            ndc.set((st.px / window.innerWidth) * 2 - 1, -(st.py / window.innerHeight) * 2 + 1);
            ray.setFromCamera(ndc, camera);
            w.copy(ray.ray.origin).addScaledVector(ray.ray.direction, D).sub(moonRest);
            t2.set(w.dot(R), w.dot(U));
            const d = t2.length();
            if (st.gift === 'in' && d > L) {
              // rope all out: the gift is jammed in the hole; the rubber rim stretches (stiffer and stiffer)
              const e = d - L;
              if (e > POP && st.m.length() > L + E * 0.45) popGift(n2.copy(t2).normalize(), D);   // the moon itself is out at the end of the rope, rim stretched
              else { t2.multiplyScalar((L + E * Math.tanh(e / E)) / d); st.stretch = Math.tanh(e / E); }
            } else if (st.gift === 'in') st.stretch = 0;
            st.mv.addScaledVector(n2.copy(t2).sub(st.m), 60 * h).multiplyScalar(Math.max(0, 1 - 15.5 * h));
            st.m.addScaledVector(st.mv, h);
          } else if (st.mode === 'return') {
            // the gift's weight pulls the rope back through the hole: a steady pull toward home
            st.stretch *= Math.exp(-h * 10);
            const d = st.m.length();
            if (d > 1e-3) st.mv.addScaledVector(n2.copy(st.m).multiplyScalar(-1 / d), D * 1.2 * h);
            st.mv.multiplyScalar(Math.exp(-h * 1.2));
            st.m.addScaledVector(st.mv, h);
            if (d < MOON_R * 0.3 || st.m.dot(st.mv) > 0 && d < MOON_R) {   // home: thunk into the hole
              st.mode = 'rest'; st.m.set(0, 0); st.mv.set(0, 0); st.gulpT = 0; st.wobT = 0; st.wobA = Math.max(st.wobA, 0.45);
              sound('thunk');
            }
          } else if (st.mode === 'float' || st.mode === 'inhale') {
            // released with the gift out: the moon floats where it was let go (bobbing on the gift's tugs)
            if (st.mode === 'float') {
              if (st.ub === 'closed') st.idleT += h;
              if (st.idleT > 20) { st.mode = 'inhale'; sound('slurp'); }
              st.mv.addScaledVector(n2.copy(st.anchor).sub(st.m), 5 * h);
            } else {
              st.gv.addScaledVector(n2.copy(st.g).multiplyScalar(-1), 26 * h).multiplyScalar(Math.exp(-h * 3));
              st.mv.addScaledVector(n2.copy(st.m).multiplyScalar(-1), 6 * h);
            }
            st.mv.multiplyScalar(Math.exp(-h * 3));
            st.m.addScaledVector(st.mv, h);
          }
          // the gift: gravity, rope (it can go slack), a cartoon jerk when it snaps taut; calm while unboxed
          if (st.gift === 'out' && st.present) {
            // presented: it flies at the viewer in real 3D (see update); its spot on the sky stays put
            st.gv.set(0, 0); st.gSpin = 0;
            st.gRot += (0 - st.gRot) * Math.min(1, h * 4);
            st.gScale += (1 - st.gScale) * Math.min(1, h * 9);
          } else if (st.gift === 'out') {
            if (st.mode !== 'inhale') st.gv.y -= G * h;
            if (st.ub !== 'closed') st.gv.multiplyScalar(Math.exp(-h * 6));
            st.g.addScaledVector(st.gv, h);
            n2.copy(st.g).sub(st.m);
            const d = n2.length();
            if (d > L && d > 1e-3) {
              n2.multiplyScalar(1 / d);
              st.g.copy(st.m).addScaledVector(n2, L);
              const vr = st.gv.dot(n2);
              if (vr > 0) {
                st.gv.addScaledVector(n2, -vr * 1.3);
                if (st.mode !== 'drag') st.mv.addScaledVector(n2, vr * 0.15);   // a floating moon bobs on the tug
                if (vr > D * 0.4) sound('creak', Math.min(1, vr / D));
              }
            }
            st.gSpin *= Math.exp(-h * 2.5);
            const target = d > 1e-3 ? Math.atan2(n2.x, -n2.y) * 0.6 : 0;      // hang under the rope (tilted a little with it)
            st.gRot += st.gSpin * h + Math.atan2(Math.sin(target - st.gRot), Math.cos(target - st.gRot)) * Math.min(1, h * 6);
            st.gScale += (1 - st.gScale) * Math.min(1, h * 9);
            if (st.mode === 'inhale' && st.g.length() < MOON_R * 0.7 && st.nk < 0.05) { st.gift = 'squeeze'; st.sqT = 0; st.wobT = 0; st.wobA = 1; sound('pop'); }
          } else if (st.gift === 'squeeze') {
            // slurped through the hole: it squashes and shrinks into the dark, the rubber stretching round it
            st.sqT += h;
            st.g.multiplyScalar(Math.exp(-h * 12));
            st.gScale = Math.max(0, 1 - st.sqT / 0.28);
            st.stretch = Math.sin(Math.min(1, st.sqT / 0.28) * Math.PI) * 0.8;
            if (st.sqT >= 0.28) { st.gift = 'in'; st.stretch = 0; if (st.mode === 'inhale' || st.mode === 'float') st.mode = 'return'; }
          }
        }

        // unboxing timeline (seconds): shake 0-0.3, bow off 0.3, lid pops 0.45, glow + confetti 0.5, note 0.65
        function updateUnbox(dt, D) {
          if (st.ub === 'closed') return { shake: 0, squash: 1 };
          st.ubT += dt;
          const t = st.ub === 'opening' ? st.ubT - 0.12 : st.ubT;   // a beat of anticipation after the tap
          if (t < 0) return { shake: 0, squash: 1 };
          let shake = 0, squash = 1;
          if (st.ub === 'opening') {
            if (t < 0.3) { shake = Math.sin(t * 62) * 0.13 * (1 - t / 0.3); squash = 1 - 0.1 * Math.sin(t / 0.3 * Math.PI); }
            if (t >= 0.3 && !st.bowGone) { st.bowGone = true; sound('zip'); }
            if (st.bowGone) { const k = Math.min(1, (t - 0.3) / 0.2); bow.scale.setScalar(1 - k); bow.position.y = HL / 2 + k * S * 0.6; bow.rotation.z = k * 3; }
            if (t >= 0.45 && !st.lidOff) {
              st.lidOff = true; gift.userData.hollow.visible = true; sound('whoosh'); buzz(12);
              scene.attach(lid);                                           // off the box: it now flies in the world
              const sx = Math.random() < 0.5 ? -1 : 1;
              lidFly.v.copy(R).multiplyScalar(sx * S * 2.4).addScaledVector(U, S * 5.5).addScaledVector(fwd, S * 6);   // sideways, up and off into the distance
              lidFly.spin = -sx * 5;
            }
            if (t >= 0.5 && !st.burst) { st.burst = true; burstConfetti(); sound('tada'); }
            if (t >= 0.65 && !note.classList.contains('on')) note.classList.add('on');
            if (t >= 0.8) st.boxK = Math.max(0, st.boxK - dt / 0.35);   // the note is out: the box drops away
            if (t >= 1.0) st.ub = 'open';
          } else if (st.ub === 'open') {
            st.boxK = Math.max(0, st.boxK - dt / 0.35);                   // keeps dropping until it is gone
          } else if (st.ub === 'closing') {
            // the note sinks back in, the lid drops back on with a bounce, the bow pops back
            st.boxK = Math.min(1, st.boxK + dt / 0.3);                    // the box rises back up to catch the note
            if (lid.parent !== gift) { gift.attach(lid); lid.visible = false; }
            if (t < 0.55) { lid.visible = false; }
            else {
              lid.visible = true; lidFly.v.set(0, 0, 0);
              const k = Math.min(1, (t - 0.55) / 0.3), e = 1 - Math.pow(1 - k, 3);
              lid.position.copy(lidHome); lid.position.y += (1 - e) * S * 1.4 - Math.sin(k * Math.PI) * 0.06 * S;
              lid.rotation.set(0, 0, 0);
              if (k >= 1 && !st.lidBack) { st.lidBack = true; sound('tap'); squash = 0.88; }
            }
            if (st.lidBack) { const k = Math.min(1, (t - 0.85) / 0.2); bow.scale.setScalar(k < 1 ? 1.25 * Math.sin(k * Math.PI * 0.5 + 0.0001) : 1); bow.position.y = HL / 2; bow.rotation.z = 0; }
            if (t >= 1.15) {
              st.ub = 'closed'; st.boxK = 1; st.bowGone = st.lidOff = st.burst = st.lidBack = false; gift.userData.hollow.visible = false;
              bow.scale.setScalar(1); bow.position.y = HL / 2;
              st.mode = 'inhale'; st.present = false; st.fromD = 0; sound('slurp');   // shrinks back as the hole slurps it
            }
          }
          if (st.lidOff && st.ub !== 'closing') {
            // the lid tumbles away under gravity (in the gift's own frame)
            lidFly.v.addScaledVector(U, -S * 14 * dt);                  // falls away under gravity, spinning flat to the screen
            lid.position.addScaledVector(lidFly.v, dt);
            lid.rotateOnWorldAxis(fwd, lidFly.spin * dt);
            lid.visible = lid.position.clone().sub(gift.position).dot(U) > -S * 9;
          }
          return { shake, squash };
        }

        function update(dt) {
          st.time += dt;
          const on = live();
          if (!on && (st.mode !== 'rest' || st.gift !== 'in')) {
            st.mode = 'rest'; st.gift = 'in'; st.ub = 'closed'; st.m.set(0, 0); st.mv.set(0, 0); st.stretch = 0; note.classList.remove('on');
            st.bowGone = st.lidOff = st.burst = st.lidBack = false; if (lid.parent !== gift) gift.add(lid); lid.position.copy(lidHome); lid.rotation.set(0, 0, 0); lid.visible = true; bow.scale.setScalar(1); bow.position.y = HL / 2;
          }
          R.setFromMatrixColumn(camera.matrixWorld, 0); U.setFromMatrixColumn(camera.matrixWorld, 1);
          const D = camera.position.distanceTo(moonRest);
          if (st.mode !== 'rest' || st.gift !== 'in') { const n = Math.min(30, Math.ceil(dt * 120)); for (let i = 0; i < n; i++) step(dt / n, D); }
          const fx = updateUnbox(dt, D);
          moonPull.busy = st.mode !== 'rest' || st.gift !== 'in';
          toWorld(st.m, moon.position);
          // out of its hole everything is drawn over the scene so nothing vanishes behind the letters
          if (moonMat.depthTest === moonPull.busy) {
            moonMat.depthTest = sMat.depthTest = !moonPull.busy;
            moon.renderOrder = moonPull.busy ? 10 : -1;
            string.renderOrder = moonPull.busy ? 9 : -1.5;
          }
          st.gulpT += dt;
          moon.scale.setScalar(1 - 0.18 * Math.sin(Math.PI * Math.min(1, st.gulpT / 0.45)));
          st.wobT += dt;
          const L = D * 0.16, mlen = st.m.length();
          hole.visible = on;
          if (on) {
            hole.position.copy(moonRest); hole.quaternion.copy(camera.quaternion);
            const u = holeMat.uniforms;
            u.uTime.value = st.time;
            u.uAlpha.value = Math.min(1, moonMat.uniforms.uAlpha.value * 1.6);
            u.uOpen.value = Math.min(1, Math.max(mlen, st.gift !== 'in' ? MOON_R * 2.2 : 0) / (MOON_R * 2.2));
            u.uStretch.value = st.stretch;
            u.uWobble.value = st.wobA * Math.exp(-st.wobT * 3.5);
            if (mlen > 1e-3 && st.gift === 'in') u.uDir.value.copy(st.m).multiplyScalar(1 / mlen);
            u.uSky.value.copy(scene.fog.color).multiplyScalar(1.1);
          }
          // the gift (a gentle bob while it waits to be opened)
          gift.visible = on && st.gift !== 'in';
          camera.getWorldDirection(fwd);
          {
            // the flight to the viewer: a slightly bouncy spring from its spot on the sky to a point up close
            // (same box, real size: perspective makes it grow, fastest at the end, like anything flying at you)
            const tgt = st.present && st.gift === 'out' ? 1 : 0;
            if (st.gift === 'in') { st.nk = 0; st.nkv = 0; }
            const n = Math.min(20, Math.ceil(dt * 120));
            for (let i = 0; i < n; i++) { const h = dt / n; st.nkv += ((tgt - st.nk) * 49 - st.nkv * 10) * h; st.nk += st.nkv * h; }
          }
          {
            const a = Math.max(0, Math.min(1, (st.nk - 0.15) / 0.75)), ea = a * a * (3 - 2 * a);
            const bu = backdropMat.uniforms;
            bu.uK.value = ea;
            backdrop.visible = on && ea > 0.002;
            if (backdrop.visible) {
              const dB = 30, hB = 2 * dB * Math.tan(camera.fov * Math.PI / 360);
              backdrop.position.copy(camera.position).addScaledVector(fwd, dB); backdrop.quaternion.copy(camera.quaternion);
              backdrop.scale.set(hB * camera.aspect, hB, 1);
              const uvOf = (p, out) => { v.copy(p).project(camera); return out.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5); };
              uvOf(moonRest, bu.uHole.value);
              if (gift.visible) uvOf(gift.position, bu.uPull.value);
              bu.uAspect.value = camera.aspect;
              const sk = (THEMES[currentTheme] || THEMES.fire).sky;           // the current theme's own sky colours
              bu.uSky0.value.set(sk[0]); bu.uSky1.value.set(sk[1]); bu.uSky2.value.set(sk[2]);
            }
            // the CV stones stand down while the gift is up (a tap on the box must not open a stone's card)
            const up = on && st.gift !== 'in' && st.nk > 0.02;
            window.__pfScene = window.__pfScene || { hold: -1, rocks: [], pop: [] };
            { const ms = screenOf(moonRest); window.__pfScene.moonAt = { x: ms.x, y: ms.y, ok: on && ms.ok && !moonPull.busy }; }   // for the "pull the moon" hint
            (window.__pfScene = window.__pfScene || { hold: -1, rocks: [], pop: [] }).giftUp = up;
            if (up !== document.documentElement.hasAttribute('data-gift-up')) document.documentElement.toggleAttribute('data-gift-up', up);
            // the moon and its rope stay below the backdrop, so they fade away with the world as the gift comes
          }
          if (gift.visible) {
            const tn = 2 * Math.tan(camera.fov * Math.PI / 360);
            const dNear = Math.max(S * 1.25 / (0.36 * tn), S * 1.25 / (0.6 * tn * camera.aspect));   // ~36% of the screen tall, 60% wide at most
            nearP.copy(camera.position).addScaledVector(fwd, dNear).addScaledVector(U, -0.17 * dNear * tn);
            const k = Math.max(0, Math.min(1.08, st.nk));
            toWorld(st.g, gift.position).lerp(nearP, k);
            gift.position.addScaledVector(U, Math.sin(Math.PI * Math.min(1, k)) * dNear * tn * 0.12);   // a little arc on the way
            gift.quaternion.copy(camera.quaternion);
            const bob = st.mode === 'float' && st.ub === 'closed' ? Math.sin(st.time * 3) * 0.06 : 0;
            gift.rotateZ(st.gRot + fx.shake + bob);
            gift.rotateX(0.24); gift.rotateY(-0.5 + (1 - Math.min(1, k)) * Math.PI * 1.4 * (st.present ? 1 : -1));   // three-quarter view; tumbles in flight
            const sq = st.gift === 'squeeze' ? 1 + st.stretch * 0.6 : 1;   // squashed thin while squeezing through
            gift.scale.set(st.gScale / sq * (2 - fx.squash), st.gScale * sq * fx.squash, st.gScale);
            const eb = st.boxK * st.boxK * (3 - 2 * st.boxK);
            if (eb < 1) { gift.position.addScaledVector(U, -(1 - eb) * S * 2.6); gift.scale.multiplyScalar(0.6 + 0.4 * eb); }
            if (st.boxK <= 0.01) gift.visible = false;
          }
          // glow + confetti
          const glowA = st.burst ? Math.max(0, 1 - (st.ubT - 0.5) / 1.2) * (st.ub === 'closing' ? 0 : 1) + (st.ub === 'open' ? 0.35 : 0) : 0;
          glow.visible = gift.visible && st.boxK > 0.3 && glowA > 0.01;
          if (glow.visible) { glow.position.copy(gift.position).addScaledVector(U, S * 0.45); glow.quaternion.copy(camera.quaternion); glowMat.uniforms.uA.value = Math.min(1, glowA); }
          confetti.forEach((c) => {
            if (!c.m.visible) return;
            c.life -= dt;
            if (c.life <= 0 || !on) { c.m.visible = false; return; }
            c.v.addScaledVector(U, -S * 6 * dt).multiplyScalar(Math.exp(-dt * 1.6));
            c.p.addScaledVector(c.v, dt); c.rot += c.spin * dt;
            c.m.position.copy(c.p); c.m.quaternion.copy(camera.quaternion); c.m.rotateZ(c.rot); c.m.rotateX(c.rot * 0.7);
            c.m.material.opacity = Math.min(1, c.life * 2);
          });
          // the note rides just above the open box
          if (note.classList.contains('on') && gift.visible && st.boxK > 0.97) {
            const s = screenRadius(gift.position, S * 0.62 * st.gScale);
            const nw = note.offsetWidth || 300, nh = note.offsetHeight || 260;
            const x = Math.max(10, Math.min(window.innerWidth - nw - 10, s.c.x - nw / 2));
            const y = Math.max(14, Math.min(window.innerHeight - nh - 14, s.c.y - s.r - nh + 18));   // rising out of the open box
            note.style.setProperty('--x', x.toFixed(1) + 'px'); note.style.setProperty('--y', y.toFixed(1) + 'px');
          }
          // the rope: hole -> moon while the gift is inside (taut under its weight), moon -> gift once it is out
          const ropeOut = st.gift !== 'in';
          let b = st.m;
          if (ropeOut) {
            // the box's top as seen from the camera, carried back out to the sky's distance (stays tied on screen)
            top.copy(gift.position).addScaledVector(U, S * 0.55 * st.gScale).sub(camera.position).normalize();
            w.copy(camera.position).addScaledVector(top, D).sub(moonRest);
            b = t2.set(w.dot(R), w.dot(U));
          }
          const a = ropeOut ? st.m : z2.set(0, 0);
          const span = n2.copy(b).sub(a).length();
          string.visible = on && (ropeOut || mlen > MOON_R * 0.95);
          if (!string.visible) return;
          const sag = ropeOut && span < L ? Math.sqrt(L * L - span * span) * 0.45 : 0;   // a slack rope hangs
          const k = Math.min(1, span / L);
          const width = MOON_R * (0.2 - 0.1 * (ropeOut ? 0 : k));
          sMat.uniforms.uAlpha.value = 0.75 + 0.25 * k;
          for (let i = 0; i <= SEG; i++) {
            const t = i / SEG;
            const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t);
            v.copy(moonRest).addScaledVector(R, x).addScaledVector(U, y);
            const tx = b.x - a.x, ty = (b.y - a.y) - sag * 4 * (1 - 2 * t);           // curve tangent in the plane
            w.copy(R).multiplyScalar(-ty).addScaledVector(U, tx).normalize().multiplyScalar(width * 0.5);
            sPos.set([v.x - w.x, v.y - w.y, v.z - w.z, v.x + w.x, v.y + w.y, v.z + w.z], i * 6);
          }
          sGeo.attributes.position.needsUpdate = true;
        }
        return { update };
      })();

