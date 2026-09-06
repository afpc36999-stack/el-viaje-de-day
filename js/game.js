/* =============================================================================
   EL VIAJE DE DAY — el juego
   -----------------------------------------------------------------------------
   Nadas una ballena con el cursor / el dedo / las flechas. Desciendes por el
   océano (el fondo se oscurece), recoges 7 luces moradas (el 7) y, al juntarlas,
   la ballena emerge a la superficie con el mensaje final.
   Música: drive_a_real_hero.mp3, empieza en el segundo 50 al pulsar «Súmergete».
   Todo el mundo se dibuja en <canvas>. Sin librerías.
   ============================================================================= */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --------------------------------------------------------------------------
     Lienzo
     -------------------------------------------------------------------------- */
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  /* --------------------------------------------------------------------------
     Ajustes del juego (fáciles de tocar)
     -------------------------------------------------------------------------- */
  var LIGHT_COUNT = 7;                 // el 7
  var ACTIVE_SINK = 30;               // px/s: descenso base mientras juegas
  var IDLE_SINK = 78;                 // px/s: si sueltas el control, sigue bajando
  var PART_COUNT = REDUCED ? 34 : 66; // menos partículas: más limpio
  var UNDULATE = REDUCED ? 3 : 7;     // amplitud del meneo de la ballena

  function whaleScale() { return Math.max(0.5, Math.min(1.25, Math.min(W, H) / 880)); }
  function margin() { return W * 0.12; }

  /* --------------------------------------------------------------------------
     Estado
     -------------------------------------------------------------------------- */
  var state = "intro";               // intro | playing | reveal | ascending | ended
  var cam = 0;                        // desplazamiento vertical de cámara (mundo)
  var whale = { wx: 0, wy: 0, px: 0, py: 0, ang: 0, face: 1, gestureT: 0 };
  var tx = 0, ty = 0;                 // objetivo (mundo)
  var lastInput = 0;
  var lights = [];
  var parts = [];
  var bubbles = [];
  var sparks = [];                   // chispas al recoger una luz
  var wreck = { wy: 0 };             // el barco hundido (el Titanic), en el fondo
  var collected = 0;
  var revealT = 0;                   // temporizador de la escena del pecio
  var ascendT = 0;
  var brightness = 0;                // 0 (fondo) -> 1 (emersión)
  var keys = {};

  function reset(full) {
    cam = 0;
    whale.wx = W / 2; whale.wy = H * 0.42;
    whale.startWy = whale.wy;
    whale.px = whale.wx; whale.py = whale.wy; whale.ang = 0; whale.face = 1;
    tx = whale.wx; ty = whale.wy;
    lastInput = performance.now();
    whale.gestureT = 0;
    parts = []; bubbles = []; sparks = []; trail = []; pings = []; creatures = []; labels = [];
    for (var i = 0; i < PART_COUNT; i++) parts.push(mkPart(Math.random() * H));
    seedFish();
    if (full) {
      collected = 0; brightness = 0; ascendT = 0; revealT = 0;
      lights = [];
      var gap = 560, y = 640;
      for (var j = 0; j < LIGHT_COUNT; j++) {
        lights.push({
          wy: y,
          wx: W * (0.2 + Math.random() * 0.6),
          got: false, t: Math.random() * 6, wob: Math.random() * 6
        });
        y += gap + j * 90;
      }
      // el pecio descansa un poco más abajo de la última luz
      wreck.wy = y + 620;
    }
  }

  function mkPart(y) {
    return {
      x: Math.random() * W, y: y,
      r: (Math.random() * 1.8 + 0.4),
      s: Math.random() * 10 + 4,          // velocidad de subida aparente
      drift: (Math.random() - 0.5) * 8,
      a: Math.random() * 0.4 + 0.12,
      ph: Math.random() * 6.28,
      big: Math.random() > 0.9
    };
  }

  /* --------------------------------------------------------------------------
     Entrada: puntero + tacto + teclado + descenso automático
     -------------------------------------------------------------------------- */
  function pointer(e) {
    var t = e.touches ? e.touches[0] : e;
    if (!t) return;
    pointerScreen.x = t.clientX;
    pointerScreen.y = t.clientY;
    tx = t.clientX;
    ty = t.clientY + cam;
    lastInput = performance.now();
  }
  canvas.addEventListener("mousemove", pointer);
  canvas.addEventListener("pointermove", pointer);
  canvas.addEventListener("touchmove", function (e) { e.preventDefault(); pointer(e); }, { passive: false });
  canvas.addEventListener("touchstart", function (e) { e.preventDefault(); pointer(e); maybePing(); }, { passive: false });
  canvas.addEventListener("pointerdown", function (e) { pointer(e); maybePing(); });

  function maybePing() {
    if (state === "playing" || state === "reveal") ping(whale.wx, whale.wy);
  }

  window.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase();
    if (k === " " || k === "spacebar") { maybePing(); e.preventDefault(); return; }
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].indexOf(k) >= 0) {
      keys[k] = true; e.preventDefault();
    }
  });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });

  /* --------------------------------------------------------------------------
     Audio — arranca en el segundo 50, solo tras «Súmergete». Nunca se reinicia.
     -------------------------------------------------------------------------- */
  var bgm = document.getElementById("bgm");
  var audioBtn = document.getElementById("audioToggle");
  var audioLabel = document.getElementById("audioLabel");
  var audioStarted = false, audioPlaying = false;
  var START_AT = 50;

  function startAudio() {
    if (!bgm) return;
    audioStarted = true;
    if (audioBtn) audioBtn.hidden = false;
    try { bgm.currentTime = START_AT; } catch (e) {}
    var p = bgm.play();
    if (p && p.then) {
      p.then(function () {
        if (bgm.currentTime < START_AT - 1) { try { bgm.currentTime = START_AT; } catch (e) {} }
        audioPlaying = true; syncAudio();
      }).catch(function () { audioPlaying = false; syncAudio(); });
    }
  }
  function syncAudio() {
    if (!audioBtn) return;
    audioBtn.setAttribute("aria-pressed", audioPlaying ? "true" : "false");
    audioBtn.setAttribute("aria-label", audioPlaying ? "Pausar música" : "Reanudar música");
    if (audioLabel) audioLabel.textContent = audioPlaying ? "Música" : "En pausa";
  }
  if (audioBtn) {
    audioBtn.addEventListener("click", function () {
      if (!audioStarted) return;
      if (audioPlaying) { try { bgm.pause(); } catch (e) {} audioPlaying = false; }
      else {
        var p = bgm.play();
        if (p && p.then) p.then(function () { audioPlaying = true; syncAudio(); }).catch(function () {});
      }
      syncAudio();
    });
  }
  if (bgm) {
    bgm.addEventListener("play", function () { audioPlaying = true; syncAudio(); });
    bgm.addEventListener("pause", function () { if (audioStarted) { audioPlaying = false; syncAudio(); } });
  }

  /* --------------------------------------------------------------------------
     Sonido corto al recoger una luz (WebAudio, sin archivos)
     -------------------------------------------------------------------------- */
  var actx = null;
  function blip(freq) {
    if (REDUCED) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!actx) actx = new AC();
      if (actx.state === "suspended") actx.resume();
      var o = actx.createOscillator(), g = actx.createGain(), n = actx.currentTime;
      o.type = "triangle";
      o.frequency.setValueAtTime(freq, n);
      g.gain.setValueAtTime(0.0001, n);
      g.gain.exponentialRampToValueAtTime(0.14, n + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, n + 0.22);
      o.connect(g); g.connect(actx.destination);
      o.start(n); o.stop(n + 0.24);
    } catch (e) {}
  }

  /* --------------------------------------------------------------------------
     INTERACCIÓN — cosas vivas en el mar que reaccionan a ti
       · rastro bioluminiscente: la ballena deja un reguero de luz al nadar
       · banco de peces: peces pequeños que huyen de la ballena y del cursor
       · destello (clic / barra espaciadora): la ballena lanza un anillo de
         sonido que dispersa a los peces, aviva las partículas y pulsa las luces
     -------------------------------------------------------------------------- */
  var trail = [];          // {x, y (mundo), a}
  var fish = [];           // {x, y (mundo), vx, vy, ph, size}
  var pings = [];          // {x, y (mundo), r, a}
  var pointerScreen = { x: -9999, y: -9999 };

  function seedFish() {
    fish = [];
    var n = REDUCED ? 8 : 16;
    for (var i = 0; i < n; i++) {
      fish.push({
        x: Math.random() * W,
        y: whale.wy - H * 0.5 + Math.random() * H * 2,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        ph: Math.random() * 6.28,
        size: Math.random() * 3 + 2.5,
        hue: Math.random() > 0.5 ? "180,205,255" : "200,180,255"
      });
    }
  }

  function ping(fromX, fromY) {
    pings.push({ x: fromX, y: fromY, r: 8, a: 0.9 });
    blip(300);
    // empuja a los peces cercanos
    for (var i = 0; i < fish.length; i++) {
      var dx = fish[i].x - fromX, dy = fish[i].y - fromY;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d < 260) {
        var f = (1 - d / 260) * 260;
        fish[i].vx += (dx / d) * f;
        fish[i].vy += (dy / d) * f;
      }
    }
  }

  /* --------------------------------------------------------------------------
     SORPRESAS — cada una de las 7 luces despierta un animal de las profundidades.
     Aparece cerca de la luz, hace lo suyo unos segundos y se marcha.
     Entre más hondo, más raro el bicho.
     -------------------------------------------------------------------------- */
  var creatures = [];
  var labels = [];   // el nombre del bicho, aparece un momento
  var CREATURE_NAMES = ["Medusa", "Cardumen", "Pulpo", "Mantarraya", "Pez linterna", "Calamar gigante", "Sifonóforo"];

  function spawnCreature(idx, wx, wy) {
    var side = Math.random() > 0.5 ? 1 : -1;
    var c = { kind: idx, x: wx, y: wy, t: 0, seed: Math.random() * 100, vx: 0, vy: 0, life: 6, dir: -side };
    if (idx === 0) { c.x = wx + (Math.random() - 0.5) * 70; c.y = wy + 50; c.vy = -24; c.vx = (Math.random() - 0.5) * 12; c.life = 7; }
    else if (idx === 1) { c.life = 3.6; }
    else if (idx === 2) { c.x = whale.wx + side * (W * 0.6); c.y = wy + (Math.random() - 0.5) * 50; c.vx = -side * 155; c.life = 4.6; }
    else if (idx === 3) { c.x = whale.wx + side * (W * 0.75); c.y = wy - 50 + (Math.random() - 0.5) * 40; c.vx = -side * 68; c.life = 8.5; }
    else if (idx === 4) { c.x = whale.wx + side * (W * 0.45); c.y = wy; c.vx = -side * 78; c.life = 5.2; }
    else if (idx === 5) { c.x = whale.wx + side * (W * 0.75); c.y = wy - 130; c.vx = -side * 118; c.vy = 44; c.life = 5.2; }
    else if (idx === 6) { c.x = wx + (Math.random() - 0.5) * 90; c.y = wy + 70; c.vy = -16; c.life = 8.5; }
    if (creatures.length > 3) creatures.shift();
    creatures.push(c);
    labels.push({ x: wx, y: wy - 44, text: (CREATURE_NAMES[idx] || "").toUpperCase(), a: 1.6 });
  }

  function fade(c) {
    return Math.min(1, c.t / 0.4) * Math.min(1, Math.max(0, (c.life - c.t)) / 1);
  }

  function drawCreature(c, t) {
    var a = fade(c);
    if (a <= 0) return;
    var sy = c.y - cam;
    var sc = Math.max(0.7, Math.min(1.5, Math.min(W, H) / 900));

    if (c.kind === 0) {                    // Medusa: sube pulsando
      var pl = 0.85 + 0.15 * Math.sin(t * 3 + c.seed);
      ctx.save(); ctx.translate(c.x, sy); ctx.globalAlpha = a; ctx.scale(sc, sc);
      var g = ctx.createRadialGradient(0, -4, 2, 0, 0, 34);
      g.addColorStop(0, "rgba(198,178,255,0.55)"); g.addColorStop(1, "rgba(130,160,255,0.02)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 30 * pl, 24 * pl, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "rgba(215,205,255,0.5)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 30 * pl, 24 * pl, 0, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = "rgba(205,195,255,0.35)"; ctx.lineWidth = 1.5;
      for (var k = -3; k <= 3; k++) {
        ctx.beginPath();
        for (var s = 0; s <= 5; s++) { var yy = 2 + s * 12, xx = k * 7 + Math.sin(t * 4 + s * 0.8 + k) * 6; s === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); }
        ctx.stroke();
      }
      ctx.restore();

    } else if (c.kind === 1) {             // Cardumen: gira alrededor de la ballena y se dispersa
      var N = REDUCED ? 14 : 26, disp = Math.max(0, c.t - 2);
      ctx.save(); ctx.globalAlpha = a;
      for (var k2 = 0; k2 < N; k2++) {
        var ang = c.t * 2.2 + k2 * (6.283 / N);
        var rad = 62 + Math.sin(c.t * 3 + k2) * 10 + disp * 300;
        var fx = whale.wx + Math.cos(ang) * rad, fy = (whale.wy - cam) + Math.sin(ang) * rad * 0.7;
        ctx.save(); ctx.translate(fx, fy); ctx.rotate(ang + Math.PI / 2);
        ctx.fillStyle = "rgba(195,215,255,0.85)";
        ctx.beginPath(); ctx.moveTo(4.5, 0); ctx.quadraticCurveTo(0, 3, -4.5, 0); ctx.quadraticCurveTo(0, -3, 4.5, 0); ctx.fill();
        ctx.restore();
      }
      ctx.restore();

    } else if (c.kind === 2) {             // Pulpo: cruza a chorros con los brazos ondulando
      ctx.save(); ctx.translate(c.x, sy); ctx.globalAlpha = a; ctx.scale(c.dir * sc, sc);
      var mp = 1 + Math.sin(t * 6 + c.seed) * 0.12;
      ctx.fillStyle = "rgba(126,92,178,0.92)";
      ctx.beginPath(); ctx.ellipse(0, 0, 20, 26 * mp, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#e6ddff"; ctx.beginPath(); ctx.arc(-6, -3, 3, 0, 7); ctx.arc(6, -3, 3, 0, 7); ctx.fill();
      ctx.fillStyle = "#170f2e"; ctx.beginPath(); ctx.arc(-6, -3, 1.4, 0, 7); ctx.arc(6, -3, 1.4, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(126,92,178,0.88)"; ctx.lineWidth = 3.4; ctx.lineCap = "round";
      for (var k3 = -4; k3 < 4; k3++) {
        ctx.beginPath(); ctx.moveTo(k3 * 4 + 2, 20);
        for (var s3 = 1; s3 <= 5; s3++) { var yy3 = 20 + s3 * 10, xx3 = k3 * 4 + 2 + Math.sin(t * 5 + s3 * 0.7 + k3) * 7 * s3 * 0.28; ctx.lineTo(xx3, yy3); }
        ctx.stroke();
      }
      ctx.restore();

    } else if (c.kind === 3) {             // Mantarraya: planea de fondo, aleteando
      ctx.save(); ctx.translate(c.x, sy); ctx.globalAlpha = a * 0.75; ctx.scale(c.dir * sc * 1.8, sc * 1.8);
      var fl = Math.sin(t * 2 + c.seed) * 0.5;
      ctx.fillStyle = "rgba(44,60,102,0.92)";
      ctx.beginPath();
      ctx.moveTo(-30, 0);
      ctx.quadraticCurveTo(2, -18 - fl * 22, 40, -6);
      ctx.quadraticCurveTo(14, 0, 40, 6 + fl * 22);
      ctx.quadraticCurveTo(2, 18 + fl * 22, -30, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(44,60,102,0.9)"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(-64, Math.sin(t * 3) * 5); ctx.stroke();
      ctx.fillStyle = "rgba(56,72,120,0.9)";
      ctx.beginPath(); ctx.moveTo(36, -6); ctx.lineTo(48, -9); ctx.lineTo(38, -2); ctx.closePath(); ctx.fill();
      ctx.restore();

    } else if (c.kind === 4) {             // Pez linterna: cuerpo oscuro y un señuelo brillante
      ctx.save(); ctx.translate(c.x, sy); ctx.globalAlpha = a; ctx.scale(c.dir * sc, sc);
      ctx.fillStyle = "rgba(20,22,42,0.96)";
      ctx.beginPath(); ctx.ellipse(0, 0, 18, 13, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(200,210,255,0.45)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(12, 2); ctx.lineTo(20, 4); ctx.lineTo(12, 7); ctx.stroke();
      var lx = 6 + Math.sin(t * 3 + c.seed) * 4, ly = -18 + Math.cos(t * 2) * 3;
      ctx.strokeStyle = "rgba(120,120,160,0.7)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(4, -8); ctx.quadraticCurveTo(10, -16, lx, ly); ctx.stroke();
      var gg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 11);
      gg.addColorStop(0, "rgba(255,244,196,0.95)"); gg.addColorStop(1, "rgba(255,240,180,0)");
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(lx, ly, 11, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(lx, ly, 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(200,210,255,0.6)"; ctx.beginPath(); ctx.arc(-4, -3, 2.5, 0, 7); ctx.fill();
      ctx.restore();

    } else if (c.kind === 5) {             // Calamar gigante: cruza la oscuridad en diagonal
      ctx.save(); ctx.translate(c.x, sy); ctx.globalAlpha = a; ctx.rotate(Math.atan2(c.vy || 1, c.vx || 1)); ctx.scale(sc, sc);
      ctx.fillStyle = "rgba(152,72,94,0.85)";
      ctx.beginPath(); ctx.moveTo(40, 0); ctx.quadraticCurveTo(0, 14, -46, 0); ctx.quadraticCurveTo(0, -14, 40, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(-58, -14); ctx.lineTo(-42, -2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(-58, 14); ctx.lineTo(-42, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f0ecff"; ctx.beginPath(); ctx.arc(18, -3, 4, 0, 7); ctx.fill();
      ctx.fillStyle = "#100a20"; ctx.beginPath(); ctx.arc(18, -3, 2, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(152,72,94,0.8)"; ctx.lineWidth = 3; ctx.lineCap = "round";
      for (var k5 = -3; k5 <= 3; k5++) {
        ctx.beginPath(); ctx.moveTo(38, k5 * 2);
        for (var s5 = 1; s5 <= 4; s5++) ctx.lineTo(38 + s5 * 10, k5 * 2 + Math.sin(t * 4 + s5 + k5) * 5 * s5 * 0.4);
        ctx.stroke();
      }
      ctx.lineWidth = 2;
      for (var tw = 0; tw < 2; tw++) {
        var sgn = tw ? 1 : -1; ctx.beginPath(); ctx.moveTo(38, sgn * 3);
        for (var s6 = 1; s6 <= 8; s6++) ctx.lineTo(38 + s6 * 11, sgn * 3 + Math.sin(t * 3 + s6 * 0.5) * 7);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(150,220,255,0.7)";
      for (var d5 = 0; d5 < 5; d5++) { ctx.beginPath(); ctx.arc(-30 + d5 * 14, (d5 % 2 ? 4 : -4), 1.6, 0, 7); ctx.fill(); }
      ctx.restore();

    } else if (c.kind === 6) {             // Sifonóforo: cadena de luces que ondula al subir
      var N6 = 16, bx = c.x, by = sy;
      ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(120,180,255,0.32)"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (var k6 = 0; k6 < N6; k6++) {
        var yy6 = by + k6 * 16, xx6 = bx + Math.sin(t * 1.6 + k6 * 0.5 + c.seed) * 22;
        k6 === 0 ? ctx.moveTo(xx6, yy6) : ctx.lineTo(xx6, yy6);
      }
      ctx.stroke();
      for (var k7 = 0; k7 < N6; k7++) {
        var yy7 = by + k7 * 16, xx7 = bx + Math.sin(t * 1.6 + k7 * 0.5 + c.seed) * 22;
        var pl7 = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3 + k7));
        var g7 = ctx.createRadialGradient(xx7, yy7, 0, xx7, yy7, 9);
        g7.addColorStop(0, "rgba(165,212,255," + (0.9 * pl7).toFixed(2) + ")");
        g7.addColorStop(1, "rgba(120,180,255,0)");
        ctx.fillStyle = g7; ctx.beginPath(); ctx.arc(xx7, yy7, 9, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
  }

  /* --------------------------------------------------------------------------
     Pantallas
     -------------------------------------------------------------------------- */
  var introScreen = document.getElementById("introScreen");
  var endScreen = document.getElementById("endScreen");
  var hud = document.getElementById("hud");
  var depthValue = document.getElementById("depthValue");
  var lightsValue = document.getElementById("lightsValue");

  document.getElementById("diveBtn").addEventListener("click", function () {
    goFullscreen();
    startAudio();
    reset(true);
    state = "playing";
    introScreen.classList.add("is-hiding");
    if (hud) hud.hidden = false;
  });

  // Pantalla completa del navegador al empezar (si el navegador lo permite).
  function goFullscreen() {
    try {
      var el = document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req) {
        var r = req.call(el);
        if (r && r.catch) r.catch(function () {});
      }
    } catch (e) {}
  }
  document.getElementById("swimBackBtn").addEventListener("click", function () {
    // Vuelve a jugar SIN reiniciar la música.
    reset(true);
    state = "playing";
    endScreen.hidden = true;
    endScreen.classList.remove("is-hiding");
    if (hud) hud.hidden = false;
  });

  /* --------------------------------------------------------------------------
     Color del océano según la profundidad
     -------------------------------------------------------------------------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixHex(h1, h2, t) {
    var a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    var r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
    var g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
    var bl = Math.round(lerp(a & 255, b & 255, t));
    return "rgb(" + r + "," + g + "," + bl + ")";
  }

  /* --------------------------------------------------------------------------
     Dibujo de la ballena — cuerpo con meneo senoidal a lo largo del espinazo
     -------------------------------------------------------------------------- */
  function drawWhale(x, y, ang, face, t, sc, gest) {
    gest = Math.max(0, Math.min(1, gest || 0));       // 1 al recoger -> 0
    var dir = (face >= 0 ? 1 : -1);
    var spin = (1 - gest) * (1 - gest) * Math.PI * 2 * dir;   // una voltereta al recoger
    var pop = 1 + Math.sin(gest * Math.PI) * 0.16;            // "brinco" de escala

    ctx.save();
    ctx.translate(x, y - Math.sin(gest * Math.PI) * 24 * sc); // saltito hacia arriba
    ctx.rotate(ang + (gest > 0 ? spin : 0));
    ctx.scale(face * sc * pop, sc * pop);

    var L = 96, seg = 26, k = 0.05, sp = t * (7 + gest * 10);
    function halfH(px) {
      var u = (px + L) / (2 * L);
      var body = Math.sin(Math.pow(Math.max(0, Math.min(1, u)), 0.72) * Math.PI);
      return 4 + body * 31;
    }
    function spineY(px) {
      var u = (px + L) / (2 * L);
      var wag = (1 - u) * (1 - u);
      return Math.sin(px * k + sp) * UNDULATE * (0.35 + wag * 1.7);
    }

    // --- cola (fluke) ---
    var fy = spineY(-L);
    ctx.beginPath();
    ctx.moveTo(-L + 8, fy);
    ctx.quadraticCurveTo(-L - 22, fy - 30, -L - 44, fy - 12);
    ctx.quadraticCurveTo(-L - 20, fy, -L - 44, fy + 12);
    ctx.quadraticCurveTo(-L - 22, fy + 30, -L + 8, fy);
    ctx.fillStyle = "#4a3796";
    ctx.fill();

    // --- cuerpo ---
    ctx.beginPath();
    for (var i = 0; i <= seg; i++) {
      var pxT = -L + (2 * L) * i / seg, yT = spineY(pxT) - halfH(pxT);
      i === 0 ? ctx.moveTo(pxT, yT) : ctx.lineTo(pxT, yT);
    }
    for (var j = seg; j >= 0; j--) {
      var pxB = -L + (2 * L) * j / seg, yB = spineY(pxB) + halfH(pxB);
      ctx.lineTo(pxB, yB);
    }
    ctx.closePath();

    var g = ctx.createLinearGradient(0, -36, 0, 36);
    g.addColorStop(0, "#c9b6ff");
    g.addColorStop(0.45, "#8a6cf2");
    g.addColorStop(1, "#3c2d78");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(124,92,255," + (0.55 + brightness * 0.4).toFixed(2) + ")";
    ctx.shadowBlur = 34 + brightness * 46;
    ctx.fill();
    ctx.shadowBlur = 0;

    // brillo superior (lomo)
    ctx.save();
    ctx.clip();
    var hl = ctx.createLinearGradient(0, -36, 0, 6);
    hl.addColorStop(0, "rgba(255,255,255,0.30)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.fillRect(-L - 10, -40, 2 * L + 60, 46);
    ctx.restore();

    // --- aleta pectoral ---
    var pfx = -6, pfy = spineY(pfx) + halfH(pfx) - 3;
    ctx.beginPath();
    ctx.moveTo(pfx, pfy - 5);
    ctx.quadraticCurveTo(pfx - 4, pfy + 26, pfx + 26, pfy + 15);
    ctx.quadraticCurveTo(pfx + 12, pfy + 2, pfx, pfy - 5);
    ctx.fillStyle = "rgba(74,55,150,0.92)";
    ctx.fill();

    // --- surcos ventrales ---
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1.4;
    for (var s = 0; s < 3; s++) {
      ctx.beginPath();
      for (var m = 0; m <= 12; m++) {
        var pxg = -46 + m * 8, yg = spineY(pxg) + halfH(pxg) * 0.62 - s * 4;
        m === 0 ? ctx.moveTo(pxg, yg) : ctx.lineTo(pxg, yg);
      }
      ctx.stroke();
    }

    // --- ojo ---
    var ex = L - 34, ey = spineY(ex) - 3;
    ctx.beginPath(); ctx.arc(ex, ey, 3.6, 0, 7); ctx.fillStyle = "#0a0d24"; ctx.fill();
    ctx.beginPath(); ctx.arc(ex - 1.1, ey - 1.1, 1.2, 0, 7); ctx.fillStyle = "#fff"; ctx.fill();

    ctx.restore();
  }

  /* --------------------------------------------------------------------------
     Dibujo de una luz (lightstick brillante)
     -------------------------------------------------------------------------- */
  function drawLight(sx, sy, t, sc) {
    var pulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.sin(t * 1.4) * 0.25);
    ctx.scale(sc, sc);
    // halo
    var hg = ctx.createRadialGradient(0, 0, 0, 0, 0, 42);
    hg.addColorStop(0, "rgba(150,120,255," + (0.5 + pulse * 0.4).toFixed(2) + ")");
    hg.addColorStop(1, "rgba(150,120,255,0)");
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, 0, 42, 0, 7); ctx.fill();
    // mango
    ctx.fillStyle = "#d8ccff";
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-3, 2, 6, 20, 3) : ctx.rect(-3, 2, 6, 20); ctx.fill();
    // orbe
    var og = ctx.createRadialGradient(-3, -6, 1, 0, -4, 12);
    og.addColorStop(0, "#ffffff");
    og.addColorStop(0.5, "#c3a6ff");
    og.addColorStop(1, "#7c5cff");
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(0, -4, 11, 0, 7); ctx.fill();
    ctx.restore();
  }

  /* --------------------------------------------------------------------------
     Dibujo del barco hundido (el Titanic) — silueta partida en el lecho marino
     -------------------------------------------------------------------------- */
  function drawWreck(t) {
    var sy = wreck.wy - cam;
    if (sy < -600 || sy > H + 600) return;
    var s = Math.min(1.25, W / 1180);

    ctx.save();
    ctx.translate(W * 0.5, sy);

    // lecho marino
    var floorG = ctx.createLinearGradient(0, 40 * s, 0, 320 * s);
    floorG.addColorStop(0, "rgba(5,7,16,0)");
    floorG.addColorStop(1, "rgba(3,4,10,0.96)");
    ctx.fillStyle = floorG;
    ctx.fillRect(-W, 30 * s, 2 * W, H);
    ctx.fillStyle = "rgba(9,12,26,0.92)";
    ctx.beginPath();
    ctx.moveTo(-W, 150 * s);
    ctx.quadraticCurveTo(-200 * s, 80 * s, 140 * s, 128 * s);
    ctx.quadraticCurveTo(460 * s, 170 * s, W, 150 * s);
    ctx.lineTo(W, H); ctx.lineTo(-W, H); ctx.closePath();
    ctx.fill();

    ctx.scale(s, s);
    hull(-70, 60, -0.14, 1.0, true);     // proa (grande, con chimeneas y mástil)
    hull(250, 96, 0.3, 0.72, false);     // popa (partida, más inclinada)

    // silt / partículas que suben del pecio
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 10; i++) {
      var px = ((i * 137 + Math.floor(t * 30)) % 700) - 350;
      var py = 60 - ((t * 24 + i * 53) % 220);
      ctx.fillStyle = "rgba(180,190,220,0.10)";
      ctx.beginPath(); ctx.arc(px, py, 1.6, 0, 7); ctx.fill();
    }
    ctx.restore();

    function hull(ox, oy, rot, k, bow) {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(rot);
      ctx.scale(k, k);

      // casco
      ctx.beginPath();
      ctx.moveTo(-300, -44);
      ctx.lineTo(250, -44);
      ctx.quadraticCurveTo(360, -28, 328, 42);
      ctx.quadraticCurveTo(296, 96, 150, 100);
      ctx.lineTo(-235, 100);
      ctx.quadraticCurveTo(-338, 82, -322, 8);
      ctx.closePath();
      ctx.fillStyle = "#0a0f20";
      ctx.fill();

      // luz fría en el borde de cubierta (viene de arriba)
      ctx.strokeStyle = "rgba(150,172,232,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-300, -44); ctx.lineTo(250, -44); ctx.stroke();

      // superestructura
      ctx.fillStyle = "#0c1428";
      ctx.fillRect(-205, -80, 350, 38);

      // portillas con luz cálida tenue y titilante
      for (var i = 0; i < 13; i++) {
        var px = -255 + i * 40;
        var fl = 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.7));
        ctx.fillStyle = "rgba(240,206,140," + fl.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(px, -6, 3, 0, 7); ctx.fill();
      }

      if (bow) {
        for (var c = 0; c < 4; c++) {
          ctx.save();
          ctx.translate(-140 + c * 88, -88);
          ctx.rotate(-0.13);
          ctx.fillStyle = "#0e1530";
          ctx.fillRect(-15, -66, 30, 70);
          ctx.restore();
        }
        ctx.strokeStyle = "#0e1530"; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(-248, -80); ctx.lineTo(-262, -186); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* --------------------------------------------------------------------------
     Bucle
     -------------------------------------------------------------------------- */
  var last = performance.now();
  var running = true;
  document.addEventListener("visibilitychange", function () {
    running = document.visibilityState !== "hidden";
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });

  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    var t = now / 1000;

    update(dt, now, t);
    render(t);

    requestAnimationFrame(frame);
  }

  function update(dt, now, t) {
    // objetivo por teclado
    var kx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
    var ky = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w ? 1 : 0);
    if (kx || ky) { tx += kx * 520 * dt; ty += ky * 520 * dt; lastInput = now; }

    if (state === "playing") {
      var sink = (now - lastInput > 1100 ? IDLE_SINK : ACTIVE_SINK);
      ty += sink * dt;
    } else if (state === "reveal") {
      // La ballena baja hasta el fondo y descubre el barco hundido.
      revealT += dt;
      ty += (wreck.wy - H * 0.34 - ty) * Math.min(1, dt * 0.9);
      tx += (W / 2 - tx) * Math.min(1, dt * 1.2);
      if (revealT > 3.8) { state = "ascending"; ascendT = 0; }
    } else if (state === "ascending") {
      ascendT += dt;
      brightness = Math.min(1, brightness + dt * 0.42);
      ty = cam + H * 0.42 - ascendT * ascendT * 46;   // sube (acelerando) a la superficie
      tx += (W / 2 - tx) * Math.min(1, dt * 2.4);
      if (ascendT > 3.8) endGame();
    }

    // gesto de la ballena al recoger una luz (voltereta feliz)
    if (whale.gestureT > 0) whale.gestureT = Math.max(0, whale.gestureT - dt);

    // límites
    tx = Math.max(margin(), Math.min(W - margin(), tx));
    if (state === "playing") ty = Math.max(whale.wy - H * 0.55, ty);

    // easing de la ballena
    var e = 1 - Math.pow(0.0016, dt);
    var nx = whale.wx + (tx - whale.wx) * e;
    var ny = whale.wy + (ty - whale.wy) * e;
    var vx = nx - whale.wx, vy = ny - whale.wy;
    whale.wx = nx; whale.wy = ny;

    // orientación
    if (Math.abs(vx) > 0.4) whale.face += ((vx > 0 ? 1 : -1) - whale.face) * Math.min(1, dt * 6);
    var ta = Math.max(-0.5, Math.min(0.5, Math.atan2(vy, Math.abs(vx) + 46) * (whale.face >= 0 ? 1 : -1)));
    whale.ang += (ta - whale.ang) * Math.min(1, dt * 6);

    // cámara: en "reveal" baja a encuadrar el pecio; el resto del tiempo sigue a la ballena
    var camTarget = (state === "reveal")
      ? wreck.wy - H * 0.66
      : Math.max(0, whale.wy - H * 0.44);
    cam += (camTarget - cam) * Math.min(1, dt * (state === "reveal" ? 1.7 : 3));

    // burbujas de la estela
    if (state === "playing" && (Math.abs(vx) + Math.abs(vy)) > 0.6 && Math.random() > 0.4) {
      var sc = whaleScale();
      bubbles.push({ x: whale.wx - whale.face * 90 * sc, y: whale.wy + 6, r: Math.random() * 3 + 1, a: 0.5, vy: -22 - Math.random() * 18, vx: (Math.random() - 0.5) * 10 });
    }
    for (var b = bubbles.length - 1; b >= 0; b--) {
      var bb = bubbles[b];
      bb.y += bb.vy * dt; bb.x += bb.vx * dt; bb.a -= dt * 0.5;
      if (bb.a <= 0) bubbles.splice(b, 1);
    }

    // partículas (marine snow) en espacio de pantalla
    for (var p = 0; p < parts.length; p++) {
      var pp = parts[p];
      pp.y -= pp.s * dt * (state === "ascending" ? 4 : 1);
      pp.x += pp.drift * dt + Math.sin(t + pp.ph) * 4 * dt;
      if (pp.y < -10) { pp.y = H + 10; pp.x = Math.random() * W; }
      if (pp.x < -10) pp.x = W + 10; else if (pp.x > W + 10) pp.x = -10;
    }

    // recoger luces
    if (state === "playing") {
      var reach = whaleScale() * 48;
      for (var l = 0; l < lights.length; l++) {
        var li = lights[l];
        if (li.got) continue;
        var dxl = li.wx - whale.wx, dyl = li.wy - whale.wy;
        if (dxl * dxl + dyl * dyl < (reach + 20) * (reach + 20)) {
          li.got = true;
          collected++;
          blip(560 + collected * 60);
          whale.gestureT = 0.85;                 // ¡la ballena da una voltereta feliz!
          for (var q = 0; q < 20; q++) {
            var an = Math.random() * 6.28, spd = Math.random() * 170 + 55;
            sparks.push({ x: li.wx, y: li.wy, vx: Math.cos(an) * spd, vy: Math.sin(an) * spd - 40, a: 1, r: Math.random() * 2.4 + 1 });
          }
          spawnCreature(collected - 1, li.wx, li.wy);   // ¡sorpresa! un animal de las profundidades
          if (lightsValue) lightsValue.textContent = collected;
          if (collected >= LIGHT_COUNT) { state = "reveal"; revealT = 0; }
        }
      }
    }

    // chispas
    for (var f = sparks.length - 1; f >= 0; f--) {
      var sk = sparks[f];
      sk.x += sk.vx * dt; sk.y += sk.vy * dt;
      sk.vy += 120 * dt; sk.vx *= 0.96;
      sk.a -= dt * 0.9;
      if (sk.a <= 0) sparks.splice(f, 1);
    }

    // rastro bioluminiscente de la ballena
    if (!REDUCED && (state === "playing" || state === "reveal" || state === "ascending")) {
      var moving = Math.abs(vx) + Math.abs(vy);
      if (moving > 0.5) {
        var ts = whaleScale();
        trail.push({ x: whale.wx - whale.face * 70 * ts, y: whale.wy + (Math.random() - 0.5) * 20 * ts, a: 0.55, r: (Math.random() * 3 + 2) * ts });
      }
      if (trail.length > 80) trail.splice(0, trail.length - 80);
    }
    for (var tr = trail.length - 1; tr >= 0; tr--) {
      trail[tr].a -= dt * 0.7;
      trail[tr].y -= dt * 6;                 // sube lentamente como plancton
      if (trail[tr].a <= 0) trail.splice(tr, 1);
    }

    // banco de peces: huyen de la ballena y del cursor, con un vaivén suave
    var pcx = pointerScreen.x, pcy = pointerScreen.y + cam;   // cursor en coords de mundo
    for (var fi = 0; fi < fish.length; fi++) {
      var fsh = fish[fi];
      // huir de la ballena
      var dwx = fsh.x - whale.wx, dwy = fsh.y - whale.wy;
      var dw = Math.sqrt(dwx * dwx + dwy * dwy) || 1;
      if (dw < 190) { var ff = (1 - dw / 190) * 420 * dt; fsh.vx += (dwx / dw) * ff; fsh.vy += (dwy / dw) * ff; }
      // huir del cursor
      var dcx = fsh.x - pcx, dcy = fsh.y - pcy;
      var dc = Math.sqrt(dcx * dcx + dcy * dcy) || 1;
      if (dc < 150) { var fc = (1 - dc / 150) * 360 * dt; fsh.vx += (dcx / dc) * fc; fsh.vy += (dcy / dc) * fc; }
      // vaivén + rozamiento + tope de velocidad
      fsh.ph += dt * 3;
      fsh.vx += Math.cos(fsh.ph) * 10 * dt;
      fsh.vy += Math.sin(fsh.ph * 0.8) * 10 * dt;
      fsh.vx *= 0.94; fsh.vy *= 0.94;
      var sp2 = Math.hypot(fsh.vx, fsh.vy);
      if (sp2 > 170) { fsh.vx = fsh.vx / sp2 * 170; fsh.vy = fsh.vy / sp2 * 170; }
      fsh.x += fsh.vx * dt; fsh.y += fsh.vy * dt;
      // mantenerlos alrededor de la ballena (envolver)
      if (fsh.x < -40) fsh.x = W + 40; else if (fsh.x > W + 40) fsh.x = -40;
      if (fsh.y < whale.wy - H * 0.9) fsh.y = whale.wy + H * 0.9;
      else if (fsh.y > whale.wy + H * 0.9) fsh.y = whale.wy - H * 0.9;
    }

    // anillos de destello (ping)
    for (var pg = pings.length - 1; pg >= 0; pg--) {
      pings[pg].r += 360 * dt;
      pings[pg].a -= dt * 1.1;
      if (pings[pg].a <= 0) pings.splice(pg, 1);
    }

    // animales de las profundidades (sorpresas de cada luz)
    for (var cr = creatures.length - 1; cr >= 0; cr--) {
      var cc = creatures[cr];
      cc.t += dt;
      cc.x += cc.vx * dt;
      cc.y += cc.vy * dt;
      if (cc.t >= cc.life) creatures.splice(cr, 1);
    }
    for (var lb = labels.length - 1; lb >= 0; lb--) {
      labels[lb].y -= 16 * dt;
      labels[lb].a -= dt * 0.5;
      if (labels[lb].a <= 0) labels.splice(lb, 1);
    }

    // HUD
    if (state === "playing" && depthValue) {
      var m = Math.max(0, Math.round((whale.wy - whale.startWy) / 6 / 5) * 5);
      depthValue.textContent = m === 0 ? "0 m" : "-" + m + " m";
    }

    whale.px = whale.wx; whale.py = whale.wy;
  }

  /* --------------------------------------------------------------------------
     Render
     -------------------------------------------------------------------------- */
  function render(t) {
    var depth01 = Math.max(0, Math.min(1, whale.wy / 4600));
    // fondo: se oscurece con la profundidad; al emerger vira a un amanecer.
    var topA = mixHex("#1b3c70", "#0a1230", depth01);
    var botA = mixHex("#0c2149", "#05060f", depth01);
    if (brightness > 0) {
      topA = mixHexRGB(topA, "#2f6f9e", brightness * 0.85);
      botA = mixHexRGB(botA, "#123253", brightness * 0.85);
    }
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, topA);
    bg.addColorStop(1, botA);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // rayos de luz desde arriba (godrays)
    var rayA = (0.10 * (1 - depth01) + brightness * 0.28);
    if (rayA > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var r = 0; r < 3; r++) {
        var baseX = W * (0.22 + r * 0.3) + Math.sin(t * 0.3 + r) * (REDUCED ? 0 : 26);
        var grd = ctx.createLinearGradient(baseX, 0, baseX - 60, H);
        var col = brightness > 0.2 ? "240,220,170" : "150,180,255";
        grd.addColorStop(0, "rgba(" + col + "," + rayA.toFixed(3) + ")");
        grd.addColorStop(1, "rgba(" + col + ",0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(baseX - 40, 0); ctx.lineTo(baseX + 70, 0);
        ctx.lineTo(baseX + 10, H); ctx.lineTo(baseX - 150, H);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    // halo profundo (violeta que crece con la profundidad)
    var hg = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, H * 0.9);
    hg.addColorStop(0, "rgba(124,92,255," + (0.05 + depth01 * 0.22).toFixed(3) + ")");
    hg.addColorStop(1, "rgba(124,92,255,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, H);

    // partículas lejanas
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var tw = p.a * (0.5 + 0.5 * Math.sin(t * 1.5 + p.ph));
      ctx.fillStyle = "rgba(210,220,255," + tw.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.big ? p.r * 2.2 : p.r, 0, 7);
      ctx.fill();
    }

    // el barco hundido (aparece al fondo, en "reveal" / "ascending")
    if (state === "reveal" || state === "ascending" || state === "ended") drawWreck(t);

    // luces (coleccionables) en el mundo
    var sc = whaleScale();
    for (var l = 0; l < lights.length; l++) {
      var li = lights[l];
      if (li.got) continue;
      var ly = li.wy - cam + Math.sin(t * 1.5 + li.wob) * 10;
      if (ly < -60 || ly > H + 60) continue;
      drawLight(li.wx, ly, t + li.t, sc * 1.05);
    }

    // burbujas de estela (mundo)
    for (var b = 0; b < bubbles.length; b++) {
      var bb = bubbles[b];
      ctx.strokeStyle = "rgba(200,215,255," + Math.max(0, bb.a).toFixed(3) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(bb.x, bb.y - cam, bb.r, 0, 7); ctx.stroke();
    }

    // animales de las profundidades
    for (var cr = 0; cr < creatures.length; cr++) drawCreature(creatures[cr], t);

    // rastro bioluminiscente (detrás de la ballena)
    if (trail.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var tr = 0; tr < trail.length; tr++) {
        var tp = trail[tr];
        ctx.fillStyle = "rgba(150,200,255," + Math.max(0, tp.a).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(tp.x, tp.y - cam, tp.r, 0, 7); ctx.fill();
      }
      ctx.restore();
    }

    // banco de peces
    for (var fi = 0; fi < fish.length; fi++) {
      var fsh = fish[fi];
      var fy = fsh.y - cam;
      if (fy < -30 || fy > H + 30) continue;
      var ang = Math.atan2(fsh.vy, fsh.vx);
      ctx.save();
      ctx.translate(fsh.x, fy);
      ctx.rotate(ang);
      ctx.fillStyle = "rgba(" + fsh.hue + ",0.85)";
      ctx.beginPath();                        // cuerpo (gota)
      ctx.moveTo(fsh.size * 1.8, 0);
      ctx.quadraticCurveTo(0, fsh.size, -fsh.size * 1.6, 0);
      ctx.quadraticCurveTo(0, -fsh.size, fsh.size * 1.8, 0);
      ctx.fill();
      ctx.beginPath();                        // cola
      ctx.moveTo(-fsh.size * 1.4, 0);
      ctx.lineTo(-fsh.size * 2.6, fsh.size * 0.9);
      ctx.lineTo(-fsh.size * 2.6, -fsh.size * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ballena (whale.face va de 1 a -1 al girar: pasa por 0 = da la vuelta)
    drawWhale(whale.wx, whale.wy - cam, whale.ang, whale.face, t, sc, whale.gestureT / 0.85);

    // anillos de destello (ping)
    if (pings.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var pg = 0; pg < pings.length; pg++) {
        var pn = pings[pg];
        ctx.strokeStyle = "rgba(170,140,255," + Math.max(0, pn.a).toFixed(3) + ")";
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(pn.x, pn.y - cam, pn.r, 0, 7); ctx.stroke();
      }
      ctx.restore();
    }

    // chispas al recoger una luz
    for (var f = 0; f < sparks.length; f++) {
      var sk = sparks[f];
      ctx.fillStyle = "rgba(240,220,150," + Math.max(0, sk.a).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(sk.x, sk.y - cam, sk.r, 0, 7); ctx.fill();
    }

    // nombre del animal que acaba de aparecer
    for (var lb = 0; lb < labels.length; lb++) {
      var lab = labels[lb];
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, lab.a));
      ctx.fillStyle = "#dcd4ff";
      ctx.font = "600 " + Math.round(14 * sc) + "px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(6,8,22,0.9)"; ctx.shadowBlur = 10;
      ctx.fillText(lab.text, lab.x, lab.y - cam);
      ctx.restore();
    }

    // viñeta
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0," + (0.4 - brightness * 0.25).toFixed(3) + ")");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function mixHexRGB(rgbStr, hex, tt) {
    // rgbStr = "rgb(r,g,b)"; hex = "#rrggbb"
    var m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(rgbStr);
    if (!m) return rgbStr;
    var a = [+m[1], +m[2], +m[3]];
    var b = parseInt(hex.slice(1), 16);
    var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return "rgb(" + Math.round(lerp(a[0], br, tt)) + "," + Math.round(lerp(a[1], bg, tt)) + "," + Math.round(lerp(a[2], bb, tt)) + ")";
  }

  /* --------------------------------------------------------------------------
     Fin
     -------------------------------------------------------------------------- */
  function endGame() {
    if (state === "ended") return;
    state = "ended";
    if (hud) hud.hidden = true;
    endScreen.hidden = false;
    endScreen.classList.add("is-hiding");   // parte invisible
    void endScreen.offsetWidth;             // reflow
    requestAnimationFrame(function () { endScreen.classList.remove("is-hiding"); }); // y aparece
    blip(720);
  }

  /* --------------------------------------------------------------------------
     Arranque
     -------------------------------------------------------------------------- */
  reset(true);
  state = "intro";
  requestAnimationFrame(frame);
})();
