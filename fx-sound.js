/* ============================================================
   fx-sound.js — CAPA 3 · Sonido sin retardo (funcional)
   IPS Vascular · capa independiente, no edita app.js
   ------------------------------------------------------------
   QUÉ HACE
   - Al abrir la app, precarga y DECODIFICA los sonidos (objeto
     global SONIDOS) con Web Audio API.
   - Reemplaza (monkey-patch) la función global snd(url) para que
     reproduzca el buffer ya decodificado al instante, en vez de
     crear un <audio> nuevo cada vez (que es lo que causa el retardo).
   - Mantiene el MISMO "throttle" de 150 ms de la app original.
   - Desbloquea el audio en el primer toque del usuario (requisito
     de los navegadores móviles).
   - Respaldo automático: si un sonido falla por CORS o no decodifica,
     esa pista cae al método clásico (<audio>) usando el snd original.
   ------------------------------------------------------------
   INSTALAR  (una sola línea, al final de <body>, DESPUÉS de app.js):
   <script src="./fx-sound.js"></script>
   ------------------------------------------------------------
   PAREJA   : se "alinea" con fx-haptics.js (capa 2): al reproducir
              al instante, el sonido coincide con la vibración.
   REVERSIBLE: borra esa línea del HTML y la app vuelve a su snd().
   NOTAS
   - Esta capa SÍ funciona en iOS: Web Audio se reproduce sin retardo
     una vez desbloqueado por el primer toque (a diferencia de la
     háptica, que iOS no permite).
   - Si Web Audio no existe, no hacemos nada: la app conserva su snd.
   ============================================================ */
(function () {
  'use strict';

  var AC = window.AudioContext || window.webkitAudioContext;
  var origSnd = window.snd;                 // respaldo: el snd original de la app
  var SONIDOS = window.SONIDOS;             // objeto global con las URLs

  // Sin Web Audio o sin sonidos: dejamos la app tal cual.
  if (!AC || !SONIDOS || typeof origSnd !== 'function') {
    console.info('[fx-sound] Web Audio no disponible; se mantiene el sonido original.');
    return;
  }

  var ctx = null;
  var buffers = {};        // url -> AudioBuffer decodificado
  var fallidos = {};       // url -> true (usar respaldo <audio>)
  var desbloqueado = false;
  var precargado = false;

  function getCtx() {
    if (!ctx) { try { ctx = new AC(); } catch (e) { ctx = null; } }
    return ctx;
  }

  // Descarga + decodifica una URL y guarda su buffer.
  function precargarUno(url) {
    var c = getCtx();
    if (!c || !url) return;
    fetch(url, { mode: 'cors' })
      .then(function (r) { return r.arrayBuffer(); })
      .then(function (buf) {
        return new Promise(function (resolve, reject) {
          // decodeAudioData admite forma promesa o callbacks; cubrimos ambas.
          var p = c.decodeAudioData(buf, resolve, reject);
          if (p && typeof p.then === 'function') p.then(resolve, reject);
        });
      })
      .then(function (audioBuffer) { buffers[url] = audioBuffer; })
      .catch(function () {
        // CORS o formato no decodificable: esta pista usará el respaldo.
        fallidos[url] = true;
      });
  }

  function precargarTodos() {
    if (precargado) return;
    precargado = true;
    Object.keys(SONIDOS).forEach(function (k) { precargarUno(SONIDOS[k]); });
  }

  // Reproduce un buffer decodificado al instante (volumen 0.6, como la app).
  function reproducir(url) {
    var c = getCtx();
    var b = buffers[url];
    if (!c || !b) return false;
    try {
      var src = c.createBufferSource();
      var gain = c.createGain();
      gain.gain.value = 0.6;
      src.buffer = b;
      src.connect(gain).connect(c.destination);
      src.start(0);
      return true;
    } catch (e) { return false; }
  }

  /* ---------- Throttle idéntico al de la app (150 ms) ---------- */
  var _lastSnd = 0;
  window.snd = function (url) {
    var n = Date.now();
    if (n - _lastSnd < 150) return;
    _lastSnd = n;

    // Si ya está decodificado, suena al instante.
    if (buffers[url] && reproducir(url)) return;

    // Respaldo: pista que falló por CORS o aún no decodifica → método clásico.
    // Llamamos al snd original SIN su throttle (ya aplicamos el nuestro):
    try {
      var a = new Audio(url);
      a.volume = 0.6;
      a.play().catch(function () {});
    } catch (e) {}
  };

  /* ---------- Desbloqueo en el primer gesto del usuario ---------- */
  function desbloquear() {
    if (desbloqueado) return;
    desbloqueado = true;
    var c = getCtx();
    if (c && c.state === 'suspended') { c.resume().catch(function () {}); }
    // Pulso silencioso para "despertar" el audio en móviles.
    if (c) {
      try {
        var s = c.createBufferSource();
        s.buffer = c.createBuffer(1, 1, 22050);
        s.connect(c.destination);
        s.start(0);
      } catch (e) {}
    }
    precargarTodos();
    document.removeEventListener('pointerdown', desbloquear, true);
    document.removeEventListener('touchstart', desbloquear, true);
    document.removeEventListener('click', desbloquear, true);
  }
  document.addEventListener('pointerdown', desbloquear, true);
  document.addEventListener('touchstart', desbloquear, true);
  document.addEventListener('click', desbloquear, true);

  // Intento de precarga temprana (algunos navegadores permiten crear el
  // contexto sin gesto; si no, se completa en el primer toque).
  precargarTodos();

  console.info('[fx-sound] Sonido sin retardo activo (Web Audio, con respaldo a <audio>).');
})();
