/* ============================================================
   fx-ripple.js — CAPA 7 · Onda al tocar / ripple (decorativa)
   IPS Vascular · capa independiente, no edita app.js
   ------------------------------------------------------------
   QUÉ HACE
   - Dibuja una onda de tinta donde tocas, vía 'pointerdown', sobre
     un selector curado: botones, FAB, tarjetas, chips, teclado PIN,
     acciones del bot y botones del encabezado.
   ------------------------------------------------------------
   INSTALAR  (al final de <body>, DESPUÉS de app.js):
   <script src="./fx-ripple.js"></script>
   ------------------------------------------------------------
   PAREJA   : fx-ripple.css (los estilos de la onda).
   REVERSIBLE: borra las dos líneas (link + script) y desaparece.
   NOTA     : con prefers-reduced-motion: reduce, queda inactiva.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { console.info('[fx-ripple] "Reducir movimiento" activo: onda desactivada.'); return; }

  var SEL = [
    '.btn', '.fab', '.menu-tile', '.sol-card', '.prof-card', '.pac-card',
    '.usr-card', '.chip', '.pin-key', '.bot-action',
    '.app-header__back', '.app-header__icon'
  ].join(',');

  document.addEventListener('pointerdown', function (e) {
    var host = e.target && e.target.closest ? e.target.closest(SEL) : null;
    if (!host || host.disabled) return;

    host.classList.add('fx-ripple-host');
    var rect = host.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 2;
    var x = (e.clientX != null ? e.clientX : rect.left + rect.width / 2) - rect.left;
    var y = (e.clientY != null ? e.clientY : rect.top + rect.height / 2) - rect.top;

    var rip = document.createElement('span');
    rip.className = 'fx-ripple';
    rip.style.width = rip.style.height = size + 'px';
    rip.style.left = (x - size / 2) + 'px';
    rip.style.top  = (y - size / 2) + 'px';
    host.appendChild(rip);

    rip.addEventListener('animationend', function () { rip.remove(); });
    setTimeout(function () { if (rip.parentNode) rip.remove(); }, 800); // respaldo
  }, { capture: true, passive: true });

  console.info('[fx-ripple] Onda al tocar activa.');
})();
