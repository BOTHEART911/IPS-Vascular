/* ============================================================
   fx-skeletons.js — CAPA 5 · Esqueletos de carga (funcional)
   IPS Vascular · capa independiente, no edita app.js
   ------------------------------------------------------------
   QUÉ HACE
   - Envuelve (monkey-patch) los métodos .cargar() de Solicitudes,
     Pacientes y Profesionales. Antes de cargar, pinta siluetas en
     su contenedor (#sol-content / #pac-content / #prof-content) y,
     SOLO durante esa carga, silencia el girador global (#loader)
     para que no aparezca encima.
   - El girador global sigue intacto para login, guardar, cobrar y
     cualquier otra operación que NO sea una lista.
   ------------------------------------------------------------
   INSTALAR  (al final de <body>, DESPUÉS de app.js):
   <script src="./fx-skeletons.js"></script>
   ------------------------------------------------------------
   PAREJA   : fx-skeletons.css (los estilos de las siluetas).
   REVERSIBLE: borra las dos líneas (link + script) y desaparece.
   NOTAS
   - Solicitudes/Pacientes/Profesionales son `const` en app.js:
     se referencian por su nombre (entorno léxico compartido), no
     por window. startLoading/stopLoading son funciones → sí en window.
   - Si una carga falla (sin render), se limpia la silueta para no
     dejarla colgada en pantalla.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Pintar siluetas ---------- */
  function filaLista() {
    return '' +
      '<div class="fx-skel-card fx-skel-card--list">' +
        '<div class="fx-skel-col">' +
          '<div class="fx-skel-line w70"></div>' +
          '<div class="fx-skel-line w40 sm"></div>' +
          '<div class="fx-skel-line w55 sm"></div>' +
        '</div>' +
        '<div class="fx-skel-col fx-skel-col--right">' +
          '<div class="fx-skel-pill"></div>' +
          '<div class="fx-skel-line w50 sm"></div>' +
        '</div>' +
      '</div>';
  }
  function filaAvatar() {
    return '' +
      '<div class="fx-skel-card fx-skel-card--avatar">' +
        '<div class="fx-skel-avatar"></div>' +
        '<div class="fx-skel-col">' +
          '<div class="fx-skel-line w60"></div>' +
          '<div class="fx-skel-line w80 sm"></div>' +
        '</div>' +
      '</div>';
  }
  function pintar(cont, variante, n) {
    if (!cont) return;
    var fila = (variante === 'avatar') ? filaAvatar : filaLista;
    var html = '';
    for (var i = 0; i < n; i++) html += fila();
    cont.innerHTML = html;
  }

  /* ---------- Silenciar el loader global SOLO durante listas ---------- */
  var suppress = 0;
  var _start = window.startLoading, _stop = window.stopLoading;
  if (typeof _start === 'function') {
    window.startLoading = function () { if (suppress > 0) return; return _start.apply(this, arguments); };
  }
  if (typeof _stop === 'function') {
    window.stopLoading = function () { if (suppress > 0) return; return _stop.apply(this, arguments); };
  }

  /* ---------- Envolver .cargar() de cada lista ---------- */
  function envolver(obj, contSel, variante, n) {
    if (!obj || typeof obj.cargar !== 'function') return;
    var orig = obj.cargar;
    obj.cargar = async function () {
      var cont = document.querySelector(contSel);
      if (cont) pintar(cont, variante, n);
      suppress++;
      try {
        return await orig.apply(this, arguments);
      } finally {
        suppress--;
        // Si la carga falló (no hubo render), retira la silueta colgada.
        if (cont && cont.querySelector('.fx-skel-card')) cont.innerHTML = '';
      }
    };
  }

  // Solicitudes/Pacientes/Profesionales son const → por nombre, con guarda.
  if (typeof Solicitudes   !== 'undefined') envolver(Solicitudes,   '#sol-content',  'list',   6);
  if (typeof Pacientes     !== 'undefined') envolver(Pacientes,     '#pac-content',  'avatar', 6);
  if (typeof Profesionales !== 'undefined') envolver(Profesionales, '#prof-content', 'avatar', 5);

  console.info('[fx-skeletons] Esqueletos activos en listas (el girador global sigue intacto).');
})();
