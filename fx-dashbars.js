/* ============================================================
   fx-dashbars.js — CAPA 10 · Barras del dashboard que crecen
   IPS Vascular · capa independiente, no edita app.js
   ------------------------------------------------------------
   QUÉ HACE
   - Al entrar o recargar el dashboard, las barras suben desde cero
     en cascada. Envuelve (monkey-patch) la función global
     cargarDashboard(): la deja terminar, y luego pone cada barra en
     cero y la anima hasta su valor objetivo con transición.
   - Cubre las tres barras del panel:
        .estado-row__fill  (por estado, ancho %)
        .rank-row__fill    (servicios, ancho %)
        .bc-bar rect       (por mes, SVG → se anima por escala vertical)
   ------------------------------------------------------------
   INSTALAR  (al final de <body>, DESPUÉS de app.js):
   <script src="./fx-dashbars.js"></script>
   ------------------------------------------------------------
   PAREJA   : ninguna (JS autónomo). Convive con fx-countup.js (8).
   REVERSIBLE: borra esa línea y desaparece sin rastro.
   NOTAS
   - cargarDashboard es una función global (no hay objeto dashboard).
   - Las barras del modal de un profesional NO se tocan (no pasan por
     cargarDashboard); se puede extender luego.
   - Con prefers-reduced-motion: reduce, no anima (las deja en su
     valor final, que ya es correcto).
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var orig = window.cargarDashboard;
  if (typeof orig !== 'function') {
    console.info('[fx-dashbars] cargarDashboard no encontrada; capa inactiva.');
    return;
  }

  window.cargarDashboard = async function () {
    var r = await orig.apply(this, arguments);
    try { animarBarras(); } catch (e) {}
    return r;
  };

  function animarBarras() {
    if (reduce) return;
    var cont = document.getElementById('dash-content');
    if (!cont) return;

    // ---- Barras de ANCHO (estado + servicios) ----
    var fills = cont.querySelectorAll('.estado-row__fill, .rank-row__fill');
    Array.prototype.forEach.call(fills, function (el, i) {
      var target = el.style.width || '0%';   // valor objetivo (inline)
      el.style.transition = 'none';
      el.style.width = '0%';
      void el.offsetWidth;                    // fuerza reflow
      var delay = i * 45;
      el.style.transition = 'width .6s cubic-bezier(.22,1,.36,1) ' + delay + 'ms';
      requestAnimationFrame(function () { el.style.width = target; });
    });

    // ---- Barras SVG por mes (escala vertical desde la base) ----
    var bars = cont.querySelectorAll('.bar-chart .bc-bar rect');
    Array.prototype.forEach.call(bars, function (rect, i) {
      rect.style.transformBox = 'fill-box';
      rect.style.transformOrigin = 'bottom';
      rect.style.transition = 'none';
      rect.style.transform = 'scaleY(0)';
      void rect.getBoundingClientRect();      // fuerza reflow
      var delay = i * 40;
      rect.style.transition = 'transform .55s cubic-bezier(.22,1,.36,1) ' + delay + 'ms, fill .25s';
      requestAnimationFrame(function () { rect.style.transform = 'scaleY(1)'; });
    });
  }

  console.info('[fx-dashbars] Barras del dashboard con crecimiento en cascada.');
})();
