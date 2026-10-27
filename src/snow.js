      // ===== Writing in the snow: with a mouse, just moving over the snow floor writes; on touch screens a finger
      // drag writes. Each stroke is carved into a fine
      // "groove" texture over the floor (much finer than the snow mesh), which the snow shader turns into a
      // crisp channel: cool blue shadow inside, a bright rim, light catching its walls. Fresh snowfall slowly
      // fills the writing back in. Injected into the scene by build.py. =====
      const snowWrite = (() => {
        const TW = IS_MOBILE ? 512 : 1024, TH = Math.round(TW * SNOW_D / SNOW_W);
        const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
        const g = cv.getContext('2d');
        g.fillStyle = '#000'; g.fillRect(0, 0, TW, TH);
        const tex = new THREE.CanvasTexture(cv);
        tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
        tex.flipY = false;                                                         // canvas rows = world z as-is, so the line lands exactly under the pointer
        const trailU = { value: tex }, rectU = { value: new THREE.Vector4(SNOW_X0, SNOW_Z0, SNOW_W, SNOW_D) }, texelU = { value: new THREE.Vector2(1 / TW, 1 / TH) };
        // layer the grooves on top of the snow shader's own wind ripples and grain
        const baseCompile = snowMat.onBeforeCompile;
        snowMat.onBeforeCompile = (sh) => {
          baseCompile(sh);
          sh.uniforms.uTrail = trailU; sh.uniforms.uTrailRect = rectU; sh.uniforms.uTrailTexel = texelU;
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform sampler2D uTrail; uniform vec4 uTrailRect; uniform vec2 uTrailTexel;\nfloat trailAt(vec2 uv) { return texture2D(uTrail, uv).r; }')
            .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec2 tuv = (vSnowW.xz - uTrailRect.xy) / uTrailRect.zw;
    float gd = trailAt(tuv);
    // inside a groove: cool blue shade, deepest in the middle; just outside it: a little bright rim of pushed-up snow
    float rim = clamp((trailAt(tuv + vec2(uTrailTexel.x * 2.5, 0.0)) + trailAt(tuv - vec2(uTrailTexel.x * 2.5, 0.0)) + trailAt(tuv + vec2(0.0, uTrailTexel.y * 2.5)) + trailAt(tuv - vec2(0.0, uTrailTexel.y * 2.5))) * 0.25 - gd, 0.0, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.66, 0.86), smoothstep(0.05, 0.9, gd) * 0.62);
    diffuseColor.rgb += vec3(0.06) * rim;
  }`)
            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec2 tuv = (vSnowW.xz - uTrailRect.xy) / uTrailRect.zw;
    float tx = trailAt(tuv + vec2(uTrailTexel.x, 0.0)) - trailAt(tuv - vec2(uTrailTexel.x, 0.0));
    float tz = trailAt(tuv + vec2(0.0, uTrailTexel.y)) - trailAt(tuv - vec2(0.0, uTrailTexel.y));
    vec3 tW = vec3(-tx, 0.0, -tz) * 2.4;                                         // the groove's walls catch the light
    normal = normalize(normal - (viewMatrix * vec4(tW, 0.0)).xyz);
  }`);
        };
        snowMat.needsUpdate = true;

        const P = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
        let pen = null, hover = null, dirty = false, fadeAcc = 0, crunchT = 0;
        const toTex = (x, z) => [(x - SNOW_X0) / SNOW_W * TW, (z - SNOW_Z0) / SNOW_D * TH];
        const inside = (p) => p.x > SNOW_X0 + 1 && p.x < SNOW_X0 + SNOW_W - 1 && p.z > SNOW_Z0 + 1 && p.z < SNOW_Z0 + SNOW_D - 1 && p.z > 1.2;
        function hitAt(cx, cy) {
          ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
          ray.setFromCamera(ndc, camera);
          return snowRayHit(ray.ray, P) && inside(P) ? P : null;
        }
        const lineW = TW / SNOW_W * 0.55;                                          // a groove ~0.55 units wide
        function stroke(a, b) {
          const [x0, y0] = toTex(a.x, a.z), [x1, y1] = toTex(b.x, b.z);
          g.save();
          g.lineCap = 'round'; g.lineJoin = 'round';
          g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = lineW;
          g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = lineW * 0.6;      // soft, rounded groove profile
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
          g.restore();
          dirty = true;
        }
        function powder(p, n) {
          for (let q = 0; q < n; q++) spawn(fxNorm, { p: [p.x, p.y + 0.12, p.z], v: [rnd(-0.8, 0.8), rnd(0.6, 1.6), rnd(-0.6, 0.6)], life: rnd(0.35, 0.7), s0: 0.1, s1: 0.06, a: 1, c0: [1, 1, 1], c1: [0.9, 0.94, 1], g: -5, d: 0.6 });
        }
        // capture phase: a press on the snow writes instead of turning the camera
        container.addEventListener('pointerdown', (e) => {
          if (currentTheme !== 'snow' || pen || e.pointerType === 'mouse') return;
          const p = hitAt(e.clientX, e.clientY);
          if (!p) return;
          e.stopPropagation();
          initAudio();
          pen = { id: e.pointerId, last: p.clone(), dist: 0 };
          stroke(p, p); powder(p, 4);
          pointerActive = false;
        }, true);
        // mouse: every move over the snow carves the line from the last point (no press needed)
        window.addEventListener('pointermove', (e) => {
          if (e.pointerType !== 'mouse' || currentTheme !== 'snow' || isDragging) { if (e.pointerType === 'mouse') hover = null; return; }
          const p = hitAt(e.clientX, e.clientY);
          if (!p) { hover = null; return; }
          if (!hover) { hover = { last: p.clone(), dist: 0 }; return; }
          const d = Math.hypot(p.x - hover.last.x, p.z - hover.last.z);
          if (d < 0.05) return;
          if (d > 6) { hover.last.copy(p); return; }                          // a jump (pointer left and came back): no line across
          stroke(hover.last, p);
          hover.dist += d;
          if (hover.dist > 0.9) { hover.dist = 0; powder(p, 2); }
          if (crunchT <= 0) { crunchT = 0.09; playHover('snow', p.x, true); }
          hover.last.copy(p);
        });
        document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) hover = null; });
        window.addEventListener('pointermove', (e) => {
          if (!pen || e.pointerId !== pen.id) return;
          e.stopImmediatePropagation();                                            // no camera turn, no wall push while writing
          pointerActive = false;
          const p = hitAt(e.clientX, e.clientY);
          if (!p) return;
          const d = Math.hypot(p.x - pen.last.x, p.z - pen.last.z);
          if (d < 0.05) return;
          stroke(pen.last, p);
          pen.dist += d;
          if (pen.dist > 0.9) { pen.dist = 0; powder(p, 2); }
          if (crunchT <= 0) { crunchT = 0.09; playHover('snow', p.x, true); }
          pen.last.copy(p);
        }, true);
        const lift = (e) => { if (pen && e.pointerId === pen.id) pen = null; };
        window.addEventListener('pointerup', lift);
        window.addEventListener('pointercancel', lift);

        function update(dt) {
          crunchT -= dt;
          if (currentTheme !== 'snow') { pen = null; hover = null; return; }
          // fresh snow slowly fills the writing back in (about a minute and a half to vanish)
          fadeAcc += dt;
          if (fadeAcc > 0.5) { fadeAcc = 0; g.fillStyle = 'rgba(0,0,0,0.012)'; g.fillRect(0, 0, TW, TH); dirty = true; }
          if (dirty) { tex.needsUpdate = true; dirty = false; }
        }
        return { update, get writing() { return !!pen; } };
      })();

