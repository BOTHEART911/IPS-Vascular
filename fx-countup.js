/* ============================================================
   fx-countup.js — CAPA 8 · Conteo de números (funcional)
   IPS Vascular · capa independiente, no edita app.js
   ------------------------------------------------------------
   QUÉ HACE
   - Los totales/KPIs del dashboard que cambian se animan del valor
     viejo al nuevo (la primera vez, desde 0). Vigila solo los
     elementos correctos dentro de #dash-content con un observador y
     evita bucles BLOQUEANDO sus propias escrituras.
   - Cubre: .kpi__val (KPIs grandes), .estado-row__qty (cantidades
     por estado) y .rank-row__qty (servicios más solicitados).
   ------------------------------------------------------------
   INSTALAR  (al final de <body>, DESPUÉS de app.js):
   <script src="./fx-countup.js"></script>
   ------------------------------------------------------------
   PAREJA   : ninguna (JS autónomo). Convive con fx-dashbars.js (10).
   REVERSIBLE: borra esa línea y desaparece sin rastro.
   NOTAS
   - Esta app NO maneja moneda: son ENTEROS. El último fotograma
     escribe el texto EXACTO original, así nunca hay desajuste de
     formato si en el futuro agregas separadores de miles.
   - Las cifras del modal de un profesional NO se animan (viven en un
     SweetAlert, fuera de #dash-content); se puede extender luego.
   - Con prefers-reduced-motion: reduce, no anima (deja el valor).
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var root = document.getElementById('dash-content');
  if (!root) { console.info('[fx-countup] #dash-content no encontrado; capa inactiva.'); return; }

  var SEL = '.kpi__val, .estado-row__qty, .rank-row__qty';
  var cache = {};        // clave estable -> último número conocido
  var scheduled = false;

  function idx(el) { var p = el.parentNode; return p ? Array.prototype.indexOf.call(p.children, el) : 0; }

  // Identidad estable por etiqueta cercana (sobrevive a los re-render).
  function claveDe(el) {
    if (el.classList.contains('kpi__val')) {
      var l = el.parentNode && el.parentNode.querySelector('.kpi__lbl');
      return 'kpi:' + (l ? l.textContent.trim() : idx(el));
    }
    if (el.classList.contains('estado-row__qty')) {
      var e = el.parentNode && el.parentNode.querySelector('.estado-row__lbl');
      return 'estado:' + (e ? e.textContent.trim() : idx(el));
    }
    if (el.classList.contains('rank-row__qty')) {
      var n = el.parentNode && el.parentNode.querySelector('.rank-row__name');
      return 'rank:' + (n ? n.textContent.trim() : idx(el));
    }
    return 'x:' + idx(el);
  }

  function parseNum(t) {
    var s = String(t).replace(/[^\d-]/g, '');
    return s === '' ? null : parseInt(s, 10);
  }

  function animar(el, from, to, finalText) {
    el.__fxLock = true; // marca: las escrituras de aquí NO deben re-disparar
    if (reduce || from === to) { el.textContent = finalText; el.__fxLock = false; return; }
    var dur = 650, t0 = performance.now(), diff = to - from;
    function tick(now) {
      var p = Math.min((now - t0) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      if (p < 1) {
        el.textContent = String(Math.round(from + diff * e));
        requestAnimationFrame(tick);
      } else {
        el.textContent = finalText;   // estado final EXACTO
        el.__fxLock = false;
      }
    }
    requestAnimationFrame(tick);
  }

  function procesar() {
    scheduled = false;
    var els = root.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.__fxLock) continue;            // ya animándose
      var finalText = el.textContent;
      var to = parseNum(finalText);
      if (to === null) continue;
      var k = claveDe(el);
      var from = (k in cache) ? cache[k] : 0; // primera vez: desde 0
      cache[k] = to;
      if (from !== to) animar(el, from, to, finalText);
    }
  }

  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(procesar); } }

  var obs = new MutationObserver(function (muts) {
    var real = false;
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      // ignora mutaciones causadas por nuestras propias escrituras
      if (t && (t.__fxLock || (t.parentNode && t.parentNode.__fxLock))) continue;
      real = true;
    }
    if (real) schedule();
  });
  obs.observe(root, { childList: true, subtree: true });
  schedule(); // primer pase si ya hubiera contenido

  console.info('[fx-countup] Conteo de enteros activo en el dashboard.');
})();
