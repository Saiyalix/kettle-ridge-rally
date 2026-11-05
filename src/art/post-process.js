  /* ---------- post-process, console style ----------
     The scene renders at a lower internal resolution and is scaled up, with a soft bloom on bright areas,
     a little extra saturation and contrast, a vignette, and radial motion blur at high speed. */
  const RENDER_SCALE = 0.72;
  // the scene is drawn here in linear light (half float, so bright highlights are not clipped before the tone mapping); a plain 8-bit target if the phone can't
  const rtColor = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: hdrOk ? THREE.HalfFloatType : THREE.UnsignedByteType });
  const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: rtColor.texture }, res: { value: new THREE.Vector2(1, 1) }, blur: { value: 0 },
      // colour grade per stage look (applyGrade): tint multiplies, lift adds to the shadows, bloom = glow on bright areas above `thresh`
      tint: { value: new THREE.Vector3(1, 1, 1) }, lift: { value: new THREE.Vector3(0, 0, 0) }, sat: { value: 1.14 }, con: { value: 1.05 },
      bloom: { value: 0.4 }, bloom2: { value: 0 }, thresh: { value: 0.86 }, vig: { value: 0.32 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tColor; uniform vec2 res; uniform float blur; uniform vec3 tint; uniform vec3 lift; uniform float sat; uniform float con; uniform float bloom; uniform float bloom2; uniform float thresh; uniform float vig; varying vec2 vUv;
      void main(){
        vec2 dir = vUv - 0.5;
        vec3 c = texture2D(tColor, vUv).rgb;
        if (blur > 0.001) {
          vec3 acc = c;
          for (int i = 1; i < 7; i++) acc += texture2D(tColor, vUv - dir * (float(i) / 7.0) * blur * 0.07).rgb;
          c = mix(c, acc / 7.0, smoothstep(0.12, 0.5, length(dir)));
        }
        vec2 o = 2.5 / res; vec3 b = vec3(0.0);
        b += max(texture2D(tColor, vUv + vec2(o.x, o.y)).rgb - thresh, 0.0);
        b += max(texture2D(tColor, vUv + vec2(-o.x, o.y)).rgb - thresh, 0.0);
        b += max(texture2D(tColor, vUv + vec2(o.x, -o.y)).rgb - thresh, 0.0);
        b += max(texture2D(tColor, vUv + vec2(-o.x, -o.y)).rgb - thresh, 0.0);
        c += b * bloom;
        if (bloom2 > 0.0) {                                    // wider, softer glow (night and sunset on high quality)
          vec2 w = 8.0 / res; vec3 b2 = vec3(0.0);
          b2 += max(texture2D(tColor, vUv + vec2(w.x, 0.0)).rgb - thresh, 0.0);
          b2 += max(texture2D(tColor, vUv + vec2(-w.x, 0.0)).rgb - thresh, 0.0);
          b2 += max(texture2D(tColor, vUv + vec2(0.0, w.y)).rgb - thresh, 0.0);
          b2 += max(texture2D(tColor, vUv + vec2(0.0, -w.y)).rgb - thresh, 0.0);
          c += b2 * bloom2;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        c = gl_FragColor.rgb;                                  // from here on: display (sRGB) values, the grade works like it always did
        c = c * tint + lift;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, sat);
        c = (c - 0.5) * con + 0.5;
        c *= 1.0 - vig * dot(dir, dir);
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthWrite: false, depthTest: false,
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  let gradeWide = 0;
  function applyGrade(L) {
    const G = L.grade || {}, u = postMat.uniforms;
    u.tint.value.set(...(G.tint || [1, 1, 1])); u.lift.value.set(...(G.lift || [0, 0, 0]));
    u.sat.value = G.sat != null ? G.sat : 1.14; u.con.value = G.con != null ? G.con : 1.05;
    u.bloom.value = G.bloom != null ? G.bloom : 0.4; u.thresh.value = G.thresh != null ? G.thresh : 0.86; u.vig.value = G.vig != null ? G.vig : 0.32;
    gradeWide = G.bloom2 || 0;
  }
  /* Shader pre-warm. three.js builds a shader program the first time a material is drawn; that is a hitch of a few ms to 100+ ms,
     and it used to happen when the first rival car (or a new material) came into view. renderer.compile() builds the programs of every
     material in the scene, visible or not (three 0.186 traverses invisible objects too), so after a stage loads or the quality changes we
     dress all rivals, upload their pictures and compile once. It runs inside the first rendered frame, while the menu / pause menu is up.
     The work the rivals needed anyway (painting 14 liveries, one per frame) is done here at once instead. */
  let prewarmFor = null, prewarmQ = null;
  function prewarm() {
    dressAllRivals();
    renderer.setRenderTarget(rtColor);                              // programs depend on the target (tone mapping and colour space differ on screen): compile for the one the scene is really drawn into
    renderer.compile(scene, camera);
    renderer.setRenderTarget(null);
  }
  function renderFrame(dt) {
    if (stageGroup && (prewarmFor !== stageGroup || prewarmQ !== quality)) { prewarmFor = stageGroup; prewarmQ = quality; prewarm(); }
    updateSky(dt); updateNight(); cullFar(); updateRivalLOD();
    if (envDirty && envPM && quality === 'high') envPMREM();                 // new stage: refresh the car paint's reflection of the sky
    postMat.uniforms.bloom2.value = quality === 'low' ? 0 : gradeWide;      // the wide glow costs 4 more taps: high quality only
    glowPointMat.uniforms.uScale.value = rtColor.height * 0.5;
    const kmh = car.speed * 3.6;
    postMat.uniforms.blur.value = state === 'menu' ? 0 : clamp((kmh - 100) / 70, 0, 1) * (camMode === 3 ? 0.6 : 1);
    renderer.setRenderTarget(rtColor); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (isTouch && h > w && state === 'running') togglePause();          // turned to portrait mid-stage
    renderer.setSize(w, h, false);
    const sc = (quality === 'low' ? 0.55 : RENDER_SCALE) * Math.min(window.devicePixelRatio || 1, 1.5), W = Math.max(320, Math.floor(w * sc)), Hh = Math.max(240, Math.floor(h * sc));
    rtColor.setSize(W, Hh);
    postMat.uniforms.res.value.set(W, Hh);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    pMat.uniforms.uScale.value = Hh * 0.5;
  }
  window.addEventListener('resize', resize);
  resize();

