/* ============================================
   ABN STUDIO — INTERACTIONS + WEBGL FLUID SHADER
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ========================================
     WEBGL FLUID GRADIENT SHADER
     ======================================== */
  const canvas = document.getElementById('hero-canvas');
  if (canvas) {
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (gl) {
      // --- Resize ---
      function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      window.addEventListener('resize', resize);
      resize();

      // --- Shaders ---
      const vertSrc = `
        attribute vec2 a_position;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      const fragSrc = `
        precision highp float;

        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;

        /* ---- noise helpers ---- */
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float f = 0.0;
          float amp = 0.5;
          float freq = 1.0;
          for (int i = 0; i < 6; i++) {
            f += amp * noise(p * freq);
            freq *= 2.0;
            amp *= 0.5;
          }
          return f;
        }

        void main() {
          vec2 uv = gl_FragCoord.xy / u_resolution;
          float aspect = u_resolution.x / u_resolution.y;
          vec2 p = uv;
          p.x *= aspect;

          float t = u_time * 0.08;

          /* ---- mouse fluid distortion ---- */
          vec2 m = u_mouse;
          m.x *= aspect;
          vec2 toMouse = p - m;
          float mouseDist = length(toMouse);
          float mouseForce = smoothstep(0.8, 0.0, mouseDist);
          // Gentle push away from mouse — like a warm breeze
          p += normalize(toMouse + 0.001) * mouseForce * 0.05;
          // Subtle swirl around cursor
          float swirlAngle = mouseForce * 0.35;
          vec2 swirl = vec2(
            toMouse.x * cos(swirlAngle) - toMouse.y * sin(swirlAngle),
            toMouse.x * sin(swirlAngle) + toMouse.y * cos(swirlAngle)
          );
          p += (swirl - toMouse) * mouseForce * 0.15;

          /* ---- domain warping (Inigo Quilez style) ---- */
          vec2 q = vec2(
            fbm(p * 2.5 + vec2(0.0, 0.0) + t * 0.6),
            fbm(p * 2.5 + vec2(5.2, 1.3) + t * 0.5)
          );

          vec2 r = vec2(
            fbm(p * 2.5 + q * 3.5 + vec2(1.7, 9.2) + t * 0.35),
            fbm(p * 2.5 + q * 3.5 + vec2(8.3, 2.8) + t * 0.4)
          );

          float f = fbm(p * 2.5 + r * 3.0 + t * 0.15);

          /* ---- secondary warp layer for extra depth ---- */
          float f2 = fbm(p * 1.8 + vec2(f * 2.0, r.x * 1.5) + t * 0.2);

          float blend = f * 0.65 + f2 * 0.35;

          /* ---- color palette ---- */
          vec3 black      = vec3(0.015, 0.008, 0.004);
          vec3 darkBrown  = vec3(0.18, 0.04, 0.01);
          vec3 deepOrange = vec3(0.55, 0.14, 0.02);
          vec3 orange     = vec3(0.96, 0.49, 0.11);
          vec3 amber      = vec3(1.0, 0.68, 0.18);
          vec3 hotAmber   = vec3(1.0, 0.82, 0.38);

          vec3 col = black;
          col = mix(col, darkBrown,  smoothstep(0.0,  0.25, blend));
          col = mix(col, deepOrange, smoothstep(0.2,  0.42, blend));
          col = mix(col, orange,     smoothstep(0.38, 0.62, blend));
          col = mix(col, amber,      smoothstep(0.58, 0.78, blend));
          col = mix(col, hotAmber,   smoothstep(0.75, 0.95, blend));

          /* ---- brightness from warping intensity ---- */
          float warpIntensity = length(q) + length(r) * 0.5;
          col *= 0.85 + 0.4 * smoothstep(0.5, 1.5, warpIntensity);

          /* ---- edge darkening / vignette ---- */
          float vig = 1.0 - 0.35 * pow(length(uv - vec2(0.45, 0.45)) * 1.2, 2.0);
          col *= max(vig, 0.0);



          /* ---- gamma correction ---- */
          col = pow(col, vec3(0.92));

          gl_FragColor = vec4(col, 1.0);
        }
      `;

      // --- Compile shaders ---
      function createShader(type, source) {
        const s = gl.createShader(type);
        gl.shaderSource(s, source);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.error('Shader error:', gl.getShaderInfoLog(s));
          gl.deleteShader(s);
          return null;
        }
        return s;
      }

      const vert = createShader(gl.VERTEX_SHADER, vertSrc);
      const frag = createShader(gl.FRAGMENT_SHADER, fragSrc);

      const program = gl.createProgram();
      gl.attachShader(program, vert);
      gl.attachShader(program, frag);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
      }

      gl.useProgram(program);

      // --- Fullscreen quad ---
      const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

      const aPos = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      // --- Uniforms ---
      const uTime = gl.getUniformLocation(program, 'u_time');
      const uRes  = gl.getUniformLocation(program, 'u_resolution');
      const uMouse = gl.getUniformLocation(program, 'u_mouse');

      // --- Smoothed mouse tracking ---
      let mouseTargetX = 0.5, mouseTargetY = 0.5;
      let mouseSmoothX = 0.5, mouseSmoothY = 0.5;

      const heroEl = document.querySelector('.hero');
      if (heroEl && window.matchMedia('(pointer: fine)').matches) {
        heroEl.addEventListener('mousemove', (e) => {
          const rect = heroEl.getBoundingClientRect();
          mouseTargetX = (e.clientX - rect.left) / rect.width;
          mouseTargetY = 1.0 - (e.clientY - rect.top) / rect.height;
        });
        heroEl.addEventListener('mouseleave', () => {
          // Slowly drift back to center when mouse leaves
          mouseTargetX = 0.5;
          mouseTargetY = 0.5;
        });
      }

      // --- Render loop ---
      const startTime = performance.now();

      function render() {
        const elapsed = (performance.now() - startTime) / 1000;

        resize();

        // Smooth lerp — 0.18 = follows closely
        mouseSmoothX += (mouseTargetX - mouseSmoothX) * 0.18;
        mouseSmoothY += (mouseTargetY - mouseSmoothY) * 0.18;

        gl.uniform1f(uTime, elapsed);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform2f(uMouse, mouseSmoothX, mouseSmoothY);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        requestAnimationFrame(render);
      }

      render();
    }
  }


  /* ========================================
     REVEAL ON SCROLL
     ======================================== */
  const reveals = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  reveals.forEach(el => revealObserver.observe(el));


  /* ========================================
     NAVBAR SCROLL
     ======================================== */
  const nav = document.getElementById('nav');

  const onScroll = () => {
    if (window.scrollY > 60) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();


  /* ========================================
     SMOOTH ANCHOR LINKS
     ======================================== */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });


  /* ========================================
     CASE STUDY MODAL
     ======================================== */
  const overlay = document.getElementById('case-overlay');

  if (overlay) {
    const dialog = overlay.querySelector('.case-dialog');
    const panels = overlay.querySelectorAll('.case-panel');
    let lastFocused = null;

    const activePanel = () =>
      [...panels].find(p => !p.hidden) || null;

    const tryPlay = (video) => {
      if (!video) return;
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    };

    // Point a video at a new clip, preserving current mute state
    function setSource(video, src, poster) {
      if (!video) return;
      const wasMuted = video.muted;
      if (poster) video.setAttribute('poster', poster);
      const source = video.querySelector('source');
      if (source) source.setAttribute('src', src);
      video.load();
      video.muted = wasMuted;
      tryPlay(video);
    }

    function syncMuteButton(panel) {
      const btn = panel.querySelector('.case-mute');
      const video = panel.querySelector('.case-video');
      if (!btn || !video) return;
      const label = btn.querySelector('.case-mute-label');
      if (video.muted) {
        btn.classList.remove('is-unmuted');
        btn.setAttribute('aria-label', 'Unmute video');
        if (label) label.textContent = 'Sound';
      } else {
        btn.classList.add('is-unmuted');
        btn.setAttribute('aria-label', 'Mute video');
        if (label) label.textContent = 'Mute';
      }
    }

    function openCase(name) {
      const panel = overlay.querySelector(`.case-panel[data-panel="${name}"]`);
      if (!panel) return;
      lastFocused = document.activeElement;

      panels.forEach(p => { p.hidden = (p !== panel); });

      const video = panel.querySelector('.case-video');
      if (video) {
        video.muted = true;
        setSource(video, video.getAttribute('data-default-src'), video.getAttribute('data-default-poster'));
      }
      // reset gallery selection to first thumb
      panel.querySelectorAll('.case-thumb').forEach((t, i) =>
        t.classList.toggle('is-active', i === 0));

      syncMuteButton(panel);

      const title = panel.querySelector('.case-title');
      if (dialog && title) dialog.setAttribute('aria-labelledby', title.id);

      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('case-open');
      overlay.scrollTop = 0;

      const closeBtn = overlay.querySelector('.case-close');
      if (closeBtn) closeBtn.focus();
    }

    function closeCase() {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('case-open');
      overlay.querySelectorAll('.case-video').forEach(v => {
        v.pause();
        v.muted = true;
      });
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    // Open from cards
    document.querySelectorAll('.case-card').forEach(card => {
      card.addEventListener('click', () => openCase(card.getAttribute('data-case')));
    });

    // Close triggers
    overlay.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', closeCase);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeCase();
    });

    // Mute toggle + gallery swap (delegated per panel)
    panels.forEach(panel => {
      const video = panel.querySelector('.case-video');

      const muteBtn = panel.querySelector('.case-mute');
      if (muteBtn && video) {
        muteBtn.addEventListener('click', () => {
          video.muted = !video.muted;
          if (!video.muted) tryPlay(video);
          syncMuteButton(panel);
        });
      }

      panel.querySelectorAll('.case-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
          panel.querySelectorAll('.case-thumb').forEach(t => t.classList.remove('is-active'));
          thumb.classList.add('is-active');
          setSource(video, thumb.getAttribute('data-src'), thumb.getAttribute('data-poster'));
        });
      });
    });
  }


  /* ========================================
     CASES — HORIZONTAL SCROLLER (arrows)
     ======================================== */
  const casesTrack = document.getElementById('cases-track');
  if (casesTrack) {
    const prevBtn = document.querySelector('.cases-arrow-prev');
    const nextBtn = document.querySelector('.cases-arrow-next');

    const stepSize = () => {
      const card = casesTrack.querySelector('.case-card');
      return card ? card.getBoundingClientRect().width + 20 : casesTrack.clientWidth * 0.8;
    };

    const updateArrows = () => {
      const maxScroll = casesTrack.scrollWidth - casesTrack.clientWidth - 2;
      if (prevBtn) prevBtn.disabled = casesTrack.scrollLeft <= 2;
      if (nextBtn) nextBtn.disabled = casesTrack.scrollLeft >= maxScroll;
    };

    if (prevBtn) prevBtn.addEventListener('click', () =>
      casesTrack.scrollBy({ left: -stepSize(), behavior: 'smooth' }));
    if (nextBtn) nextBtn.addEventListener('click', () =>
      casesTrack.scrollBy({ left: stepSize(), behavior: 'smooth' }));

    casesTrack.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    updateArrows();
  }

});
