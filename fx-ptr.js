/* ============================================================
   fx-ptr.js — CAPA 6 · Jalar para recargar / pull-to-refresh
   IPS Vascular · capa independiente, no edita app.js
   ------------------------------------------------------------
   QUÉ HACE
   - En las pantallas con lista (y el inicio/dashboard), gesto táctil
     hacia abajo DESDE EL TOPE para recargar. Mapea cada vista a su
     función de recarga real:
        view-solicitudes   → Solicitudes.cargar()
        view-pacientes     → Pacientes.cargar()
        view-profesionales → Profesionales.cargar()
        view-inicio        → cargarDashboard()
   - Ignora si hay un modal abierto (SweetAlert), si no estás en el
     tope del scroll, o si el gesto empieza dentro de un scroller
     propio (los chips) o de un campo de texto.
   ------------------------------------------------------------
   INSTALAR  (al final de <body>, DESPUÉS de app.js):
   <script src="./fx-ptr.js"></script>
   ------------------------------------------------------------
   PAREJA   : fx-ptr.css (indicador + desactivar PTR nativo).
   REVERSIBLE: borra las dos líneas (link + script) y desaparece.
   NOTAS
   - Es un gesto TÁCTIL: en escritorio (sin touch) no se activa.
   - Si está instalada la capa 5, al recargar verás también las
     siluetas; ambas capas conviven sin problema.
   ============================================================ */
(function () {
  'use strict';

  var THRESHOLD = 70;  // px de jalón necesarios para disparar
  var MAX = 90;        // tope visual del jalón
  var RESIST = 0.5;    // resistencia (se siente "elástico")

  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Indicador ---------- */
  var ind = document.createElement('div');
  ind.className = 'fx-ptr';
  ind.innerHTML = '<div class="fx-ptr__spinner"></div>';
  var spinner = ind.firstChild;
  function montar() { if (!ind.parentNode && document.body) document.body.appendChild(ind); }
  if (document.body) montar();
  else document.addEventListener('DOMContentLoaded', montar);

  /* ---------- Mapa vista → recarga real (por nombre, con guarda) ---------- */
  function recargaDe(viewId) {
    if (viewId === 'view-solicitudes'   && typeof Solicitudes   !== 'undefined') return function () { return Solicitudes.cargar(); };
    if (viewId === 'view-pacientes'     && typeof Pacientes     !== 'undefined') return function () { return Pacientes.cargar(); };
    if (viewId === 'view-profesionales' && typeof Profesionales !== 'undefined') return function () { return Profesionales.cargar(); };
    if (viewId === 'view-inicio'        && typeof cargarDashboard === 'function') return function () { return cargarDashboard(); };
    return null;
  }

  /* ---------- Estado del gesto ---------- */
  var startY = 0, pull = 0, pulling = false, refreshing = false;

  function scrollTop() {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }
  function modalAbierto() { return !!document.querySelector('.swal2-container'); }
  function vistaActiva() { var v = document.querySelector('.view.active'); return v ? v.id : null; }

  function permitido(target) {
    if (refreshing) return false;
    if (modalAbierto()) return false;
    if (scrollTop() > 0) return false;
    if (target && target.closest &&
        target.closest('.chips, .swal2-container, input, textarea, select')) return false;
    return !!recargaDe(vistaActiva());
  }

  document.addEventListener('touchstart', function (e) {
    if (!permitido(e.target)) { pulling = false; return; }
    startY = e.touches[0].clientY;
    pulling = true; pull = 0;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!pulling) return;
    var dy = e.touches[0].clientY - startY;
    if (dy <= 0 || scrollTop() > 0) { pulling = false; resetear(); return; }
    pull = Math.min(dy * RESIST, MAX);
    if (pull > 2) e.preventDefault(); // tomamos el gesto, frena el rebote nativo
    pintar();
  }, { passive: false });

  document.addEventListener('touchend', function () {
    if (!pulling) return;
    pulling = false;
    if (pull >= THRESHOLD) disparar();
    else resetear();
  }, { passive: true });

  /* ---------- Render del indicador ---------- */
  function pintar() {
    var p = pull / MAX; // 0..1
    ind.style.transform = 'translateX(-50%) translateY(' + (pull - 50) + 'px)';
    ind.style.opacity = Math.min(p * 1.3, 1);
    ind.classList.toggle('fx-ptr--ready', pull >= THRESHOLD);
    if (!reduce) spinner.style.transform = 'rotate(' + (p * 270) + 'deg)';
  }
  function resetear() {
    pull = 0;
    ind.style.transition = 'transform .28s cubic-bezier(.22,1,.36,1), opacity .28s';
    ind.style.transform = 'translateX(-50%) translateY(-50px)';
    ind.style.opacity = '0';
    ind.classList.remove('fx-ptr--ready');
    setTimeout(function () { ind.style.transition = ''; }, 320);
  }
  function disparar() {
    var fn = recargaDe(vistaActiva());
    if (!fn) { resetear(); return; }
    refreshing = true;
    spinner.style.transform = '';            // deja girar a la animación CSS
    ind.classList.add('fx-ptr--loading');
    ind.style.transition = 'transform .2s, opacity .2s';
    ind.style.transform = 'translateX(-50%) translateY(16px)';
    ind.style.opacity = '1';

    Promise.resolve().then(fn).catch(function () {}).then(function () {
      refreshing = false;
      ind.classList.remove('fx-ptr--loading');
      setTimeout(resetear, 150);
      setTimeout(function () { ind.style.transition = ''; }, 600);
    });
  }

  console.info('[fx-ptr] Jalar para recargar activo (gesto táctil).');
})();
