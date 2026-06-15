/* ============================================================
   fx-modalstagger.js — CAPA 9 · Contenido de modales escalonado
   IPS Vascular · capa independiente, no edita app.js  (decorativa)
   ------------------------------------------------------------
   QUÉ HACE
   - Al abrir una alerta (SweetAlert), su título, su contenido y sus
     botones entran en cascada, uno tras otro, con la Web Animations
     API. IGNORA los "toast" (los avisos pequeños de esquina).
   ------------------------------------------------------------
   INSTALAR  (al final de <body>, DESPUÉS de app.js):
   <script src="./fx-modalstagger.js"></script>
   ------------------------------------------------------------
   PAREJA   : ninguna (JS autónomo).
   REVERSIBLE: borra esa línea y desaparece sin rastro.
   NOTAS
   - No anima el ÍCONO del modal, para no estorbar el dibujo propio
     de SweetAlert (el check de éxito, la X de error, etc.).
   - 'fill: backwards' evita el parpadeo: antes de su turno, cada
     bloque ya está invisible en su posición inicial.
   - Con prefers-reduced-motion: reduce, queda inactiva.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { console.info('[fx-modal-stagger] "Reducir movimiento" activo: inactiva.'); return; }
  if (!('animate' in Element.prototype)) { console.info('[fx-modal-stagger] Web Animations API no disponible.'); return; }

  // Orden de entrada: título → contenido → botones → pie.
  var ORDEN = ['.swal2-title', '.swal2-html-container', '.swal2-actions', '.swal2-footer'];

  function animar(popup) {
    if (!popup || popup.classList.contains('swal2-toast')) return; // ignora toasts
    var i = 0;
    ORDEN.forEach(function (sel) {
      var el = popup.querySelector(sel);
      if (!el || getComputedStyle(el).display === 'none') return;
      el.animate(
        [{ opacity: 0, transform: 'translateY(10px)' },
         { opacity: 1, transform: 'none' }],
        { duration: 320, delay: i * 65, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }
      );
      i++;
    });
  }

  var obs = new MutationObserver(function (muts) {
    for (var m = 0; m < muts.length; m++) {
      var added = muts[m].addedNodes;
      for (var n = 0; n < added.length; n++) {
        var node = added[n];
        if (node.nodeType !== 1) continue;
        var popup = (node.matches && node.matches('.swal2-popup'))
          ? node
          : (node.querySelector ? node.querySelector('.swal2-popup') : null);
        if (popup) animar(popup);
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  console.info('[fx-modal-stagger] Contenido de modales escalonado activo.');
})();
