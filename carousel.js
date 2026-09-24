// ============================================================
//  Nurse Assistência Domiciliar — Depth Carousel
//  Ficheiro: carousel.js
//  Dependência: nenhuma (vanilla JS puro)
//  Uso: <script src="carousel.js"></script>
//       depois chama initCarousel() no body
// ============================================================

function initCarousel() {

  const items = [
    { image: 'https://picsum.photos/seed/nurse1/800/1000', alt: 'Formação clínica' },
    { image: 'https://picsum.photos/seed/nurse2/800/1000', alt: 'Cuidados intensivos' },
    { image: 'https://picsum.photos/seed/nurse3/800/1000', alt: 'Bloco operatório' },
    { image: 'https://picsum.photos/seed/nurse4/800/1000', alt: 'Emergências' },
    { image: 'https://picsum.photos/seed/nurse5/800/1000', alt: 'Formação prática' },
  ];

  const CONFIG = {
    cardWidth:    300,
    cardHeight:   380,
    radius:       18,
    depth:        220,
    spread:       90,
    tilt:         22,
    perspective:  1400,
    visibleCards: 4,
    falloff:      0.2,
    blur:         6,
    duration:     700,
    tint:         '#05060a',
    loop:         true,
  };

  // ── Build HTML ──────────────────────────────────────────
  const section = document.getElementById('carousel-section');
  if (!section) return;

  section.innerHTML = `
    <div class="section-inner" style="max-width:1100px;margin:0 auto;">
      <div class="section-title">A nossa <em>Galeria</em></div>
      <div class="section-sub">Momentos de formação e aprendizagem</div>
      <div id="dc-root" style="
        position:relative; width:100%; height:200px;
        perspective:${CONFIG.perspective}px;
        perspective-origin:50% 50%;
        display:flex; align-items:center; justify-content:center;
        user-select:none; -webkit-user-select:none;
        cursor:grab; outline:none;
        touch-action:pan-y;
      " tabindex="0">
        <div id="dc-stage" style="
          position:absolute; inset:0;
          transform-style:preserve-3d;
        ">
          ${items.map((item, i) => `
            <div class="dc-card" data-index="${i}" style="
              position:absolute; top:50%; left:50%;
              width:${CONFIG.cardWidth}px; height:${CONFIG.cardHeight}px;
              border-radius:${CONFIG.radius}px;
              overflow:hidden; background:#0b0d12;
              box-shadow:0 30px 60px -20px rgba(0,0,0,0.65),0 8px 20px -10px rgba(0,0,0,0.5);
              will-change:transform,opacity,filter;
              cursor:pointer;
              transform:translate(-50%,-50%);
            ">
              <img src="${item.image}" alt="${item.alt}" style="
                width:100%;height:100%;object-fit:cover;
                display:block;pointer-events:none;
              " draggable="false">
              <span class="dc-tint" style="
                position:absolute;inset:0;opacity:0;
                pointer-events:none;mix-blend-mode:multiply;
                background:${CONFIG.tint};
              "></span>
            </div>
          `).join('')}
        </div>

        <!-- Arrows -->
        <button id="dc-prev" aria-label="Anterior" style="
          position:absolute;top:50%;left:16px;
          transform:translateY(-50%);z-index:3000;
          width:42px;height:42px;display:grid;place-items:center;
          border:1px solid rgba(255,255,255,0.18);border-radius:999px;
          background:rgba(18,20,26,0.55);backdrop-filter:blur(8px);
          color:#fff;cursor:pointer;transition:background .2s,border-color .2s;
        ">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button id="dc-next" aria-label="Seguinte" style="
          position:absolute;top:50%;right:16px;
          transform:translateY(-50%);z-index:3000;
          width:42px;height:42px;display:grid;place-items:center;
          border:1px solid rgba(255,255,255,0.18);border-radius:999px;
          background:rgba(18,20,26,0.55);backdrop-filter:blur(8px);
          color:#fff;cursor:pointer;transition:background .2s,border-color .2s;
        ">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Dots -->
        <div id="dc-dots" style="
          position:absolute;bottom:16px;left:50%;
          transform:translateX(-50%);z-index:3000;
          display:flex;gap:8px;padding:8px 12px;
          border-radius:999px;
          background:rgba(14,16,22,0.4);
          backdrop-filter:blur(6px);
        ">
          ${items.map((_, i) => `
            <button data-dot="${i}" aria-label="Slide ${i+1}" style="
              width:7px;height:7px;padding:0;border:none;
              border-radius:999px;
              background:${i === 0 ? '#fff' : 'rgba(255,255,255,0.32)'};
              cursor:pointer;transition:width .25s,background .25s;
              ${i === 0 ? 'width:20px;' : ''}
            "></button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // ── State ────────────────────────────────────────────────
  const n       = items.length;
  const cards   = Array.from(document.querySelectorAll('.dc-card'));
  const tints   = Array.from(document.querySelectorAll('.dc-tint'));
  const dots    = Array.from(document.querySelectorAll('[data-dot]'));
  const root    = document.getElementById('dc-root');

  let pos       = 0;      // current animated position (float)
  let focus     = 0;      // current integer index
  let rafId     = null;
  let animStart = null;
  let animFrom  = 0;
  let animTo    = 0;
  let scale     = 1;

  // ── Layout ───────────────────────────────────────────────
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

  function layout(p) {
    for (let i = 0; i < n; i++) {
      let d = i - p;
      if (CONFIG.loop && n > 1) {
        d = ((d % n) + n) % n;
        if (d > n / 2) d -= n;
      }
      const back   = Math.max(0, d);
      const az     = Math.abs(d);
      const shown  = az <= CONFIG.visibleCards + 0.5;
      const tz     = -CONFIG.depth * d;
      const tx     = CONFIG.spread * d;
      const ry     = CONFIG.tilt * clamp(d, 0, 1);
      let opacity  = d < 0 ? Math.max(0, 1 + d) : 1;
      if (!shown) opacity = 0;
      const brightness = Math.max(0.15, 1 - back * CONFIG.falloff);
      const blurPx     = CONFIG.blur > 0
        ? Math.min(CONFIG.blur, (back / Math.max(1, CONFIG.visibleCards)) * CONFIG.blur)
        : 0;
      const zi = Math.round(2000 - d * 20);

      const el = cards[i];
      el.style.transform   = `translate(-50%,-50%) scale(${scale}) translateX(${tx.toFixed(2)}px) translateZ(${tz.toFixed(2)}px) rotateY(${ry.toFixed(3)}deg)`;
      el.style.opacity     = opacity.toFixed(3);
      el.style.filter      = `brightness(${brightness.toFixed(3)}) blur(${blurPx.toFixed(2)}px)`;
      el.style.zIndex      = String(zi);
      el.style.pointerEvents = shown && opacity > 0.05 ? 'auto' : 'none';
      tints[i].style.opacity = clamp(back * CONFIG.falloff * 1.25, 0, 0.86).toFixed(3);
    }
  }

  // ── Easing ───────────────────────────────────────────────
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3); // power3.out
  }

  // ── Animation ────────────────────────────────────────────
  function animateTo(target) {
    if (rafId) cancelAnimationFrame(rafId);
    animFrom  = pos;
    animTo    = target;
    animStart = null;

    function step(ts) {
      if (!animStart) animStart = ts;
      const elapsed = ts - animStart;
      const t = Math.min(elapsed / CONFIG.duration, 1);
      pos = animFrom + (animTo - animFrom) * easeOut(t);
      layout(pos);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        pos = ((animTo % n) + n) % n;
        layout(pos);
        rafId = null;
      }
    }
    rafId = requestAnimationFrame(step);
  }

  // ── Focus / Navigate ─────────────────────────────────────
  function setFocus(rawIndex) {
    const idx = ((rawIndex % n) + n) % n;
    let delta = idx - pos;
    if (CONFIG.loop && n > 1) {
      delta = ((delta % n) + n) % n;
      if (delta > n / 2) delta -= n;
    }
    animateTo(pos + delta);
    focus = idx;
    updateDots();
  }

  function navigate(step) { setFocus(focus + step); }

  function updateDots() {
    dots.forEach((d, i) => {
      const active = i === focus;
      d.style.width      = active ? '20px' : '7px';
      d.style.background = active ? '#fff' : 'rgba(255,255,255,0.32)';
    });
  }

  // ── Responsive scale ─────────────────────────────────────
  function updateScale() {
    const w      = root.offsetWidth;
    const needed = CONFIG.cardWidth + Math.abs(CONFIG.spread) * 2 + 120;
    scale = clamp(w / needed, 0.4, 1);
    layout(pos);
  }
  new ResizeObserver(updateScale).observe(root);
  updateScale();

  // ── Controls ─────────────────────────────────────────────
  document.getElementById('dc-prev').addEventListener('click', () => navigate(-1));
  document.getElementById('dc-next').addEventListener('click', () => navigate(1));
  dots.forEach(d => d.addEventListener('click', () => setFocus(+d.dataset.dot)));
  cards.forEach(c => c.addEventListener('click', () => setFocus(+c.dataset.index)));

  // ── Keyboard ─────────────────────────────────────────────
  root.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); navigate(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1); }
  });

  // ── Drag ─────────────────────────────────────────────────
  let drag = null;

  root.addEventListener('pointerdown', e => {
    if (rafId) cancelAnimationFrame(rafId);
    drag = { x: e.clientX, startPos: pos, lastX: e.clientX, v: 0, moved: false, id: e.pointerId };
  });

  root.addEventListener('pointermove', e => {
    if (!drag) return;
    const stepPx = Math.max(CONFIG.cardWidth * 0.55 * scale, 40);
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 4) {
      drag.moved = true;
      root.setPointerCapture(drag.id);
      root.style.cursor = 'grabbing';
    }
    if (!drag.moved) return;
    drag.v    = (e.clientX - drag.lastX);
    drag.lastX = e.clientX;
    pos = drag.startPos - dx / stepPx;
    layout(pos);
  });

  function endDrag() {
    if (!drag) return;
    root.style.cursor = 'grab';
    if (!drag.moved) { drag = null; return; }
    const stepPx   = Math.max(CONFIG.cardWidth * 0.55 * scale, 40);
    const projected = pos - (drag.v * 5) / stepPx;
    drag = null;
    setFocus(Math.round(projected));
  }

  root.addEventListener('pointerup',     endDrag);
  root.addEventListener('pointercancel', endDrag);

  // ── Wheel ────────────────────────────────────────────────
  let wheelTimer = null;
  root.addEventListener('wheel', e => {
    e.preventDefault();
    if (rafId) cancelAnimationFrame(rafId);
    const raw   = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const delta = e.deltaMode === 1 ? raw * 24 : raw;
    const step  = clamp(delta / (CONFIG.cardWidth * 0.9), -0.6, 0.6);
    pos += step;
    layout(pos);
    if (wheelTimer) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => setFocus(Math.round(pos)), 130);
  }, { passive: false });

  // Initial render
  layout(pos);
            }
        
