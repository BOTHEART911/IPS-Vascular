/* ============================================================
   fx-haptics.js — CAPA 2 · Vibración / háptica (funcional)
   IPS Vascular · capa independiente, no edita app.js
   ------------------------------------------------------------
   QUÉ HACE
   - Vibración muy breve al tocar botones, FAB, tarjetas, chips,
     teclado PIN y accesos, vía 'pointerdown' (responde al instante,
     antes del 'click', para que se sienta junto al toque).
   - Vibración según el RESULTADO de las alertas: éxito, error y
     aviso, envolviendo (monkey-patch) alertOk / alertErr / alertWarn.
   ------------------------------------------------------------
   INSTALAR  (una sola línea, al final de <body>, DESPUÉS de app.js):
   <script src="./fx-haptics.js"></script>
   ------------------------------------------------------------
   PAREJA   : queda "alineada" con fx-sound.js (la capa 3), de modo
              que sonido y vibración disparan en el mismo gesto.
   REVERSIBLE: borra esa línea del HTML y desaparece sin rastro.
   LIMITACIÓN HONESTA
   - navigator.vibrate solo funciona en Android (Chrome/derivados).
     En iOS (Safari y todos los navegadores de iPhone/iPad) la web
     NO tiene acceso a la vibración: esta capa simplemente NO hará
     nada ahí. No es un error; es una restricción del sistema.
   - Si el sistema tiene "reducir movimiento", la háptica se apaga.
   ============================================================ */
(function () {
  'use strict';

  // ¿El sistema permite vibrar? (Android Chrome sí; iOS nunca)
  var soportaVibrar = typeof navigator !== 'undefined' &&
                      typeof navigator.vibrate === 'function';

  // Respeta "reducir movimiento": si está activo, no vibramos.
  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!soportaVibrar) {
    console.info('[fx-haptics] Vibración no disponible en este dispositivo (típico en iOS). Capa inactiva.');
    return; // nada que hacer; las demás capas siguen intactas
  }
  if (reduce) {
    console.info('[fx-haptics] "Reducir movimiento" activo: háptica desactivada.');
    return;
  }

  // Pequeño anti-rebote para no encadenar vibraciones (toque + alerta).
  var ultimo = 0;
  function vibrar(patron) {
    var ahora = Date.now();
    if (ahora - ultimo < 60) return;   // evita dobles disparos muy seguidos
    ultimo = ahora;
    try { navigator.vibrate(patron); } catch (e) {}
  }

  /* ---------- 1) Toque físico: pointerdown sobre selector curado ---------- */
  var SELECTOR = [
    '.btn', '.fab', '.menu-tile', '.sol-card', '.prof-card', '.pac-card',
    '.usr-card', '.chip', '.pin-key', '.bot-action',
    '.app-header__back', '.app-header__icon',
    '[data-go]', '[data-acc]', '[data-sol]', '[data-prof]', '[data-pac]'
  ].join(',');

  document.addEventListener('pointerdown', function (e) {
    var el = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
    if (!el) return;
    // Teclas del PIN un pelín más cortas; el resto, toque estándar.
    vibrar(el.classList.contains('pin-key') ? 8 : 11);
  }, { capture: true, passive: true });

  /* ---------- 2) Resultado de alertas: envolver sin reescribir ---------- */
  // Estas funciones son globales (declaradas con function en app.js).
  function envolver(nombre, patron) {
    var original = window[nombre];
    if (typeof original !== 'function') return; // si no existe, no rompemos
    window[nombre] = function () {
      vibrar(patron);
      return original.apply(this, arguments);
    };
  }
  envolver('alertOk',   [14]);          // éxito: un pulso firme
  envolver('alertErr',  [28, 50, 28]);  // error: doble pulso marcado
  envolver('alertWarn', [10, 40, 10]);  // aviso: doble pulso suave

  console.info('[fx-haptics] Háptica activa (Android).');
})();
