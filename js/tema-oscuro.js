/* ============================================================================
 * IPS VASCULAR — MODO OSCURO (parte JS) · FASE 6 (ajuste 11)
 * ----------------------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario. Modificarlo anula la garantía de funcionamiento.
 * ----------------------------------------------------------------------------
 * QUÉ HACE
 *   · Pinta el botón 🌙/☀️ fijo arriba a la derecha, en todas las vistas.
 *   · Guarda la elección en el dispositivo (llave ips.tema.v1).
 *   · SIN elección guardada SIGUE AL SISTEMA, y cambia solo si el teléfono
 *     pasa de día a noche mientras la app está abierta.
 *
 * POR QUÉ NO REPINTA LAS GRÁFICAS (SEP-GROUP sí lo hace)
 *   Allí las gráficas son Chart.js sobre un <canvas>, que el CSS no alcanza.
 *   Aquí el anillo, las barras y las columnas son SVG y HTML que pintan sus
 *   colores con var(--e-*): se comprobó en el navegador que un atributo
 *   stroke="var(--e-pendiente)" cambia solo al cambiar el tema. No hay nada
 *   que redibujar.
 *
 * INSTALACIÓN
 *   <link rel="stylesheet" href="./css/tema-oscuro.css" />   (el ÚLTIMO del head)
 *   <script src="./js/tema-oscuro.js"></script>              (el ÚLTIMO del body)
 *   + el guion antiparpadeo que va dentro del <head> del index.html.
 *
 * NO TOCA app.js ni styles.css.
 * ========================================================================== */
(function () {
  'use strict';

  var LLAVE = 'ips.tema.v1';
  var OSCURO = 'oscuro', CLARO = 'claro';
  var COLOR_BARRA = { claro: '#0e6ba8', oscuro: '#0d1620' };

  function leerGuardado() {
    try { var v = localStorage.getItem(LLAVE); return (v === OSCURO || v === CLARO) ? v : ''; }
    catch (e) { return ''; }
  }
  function guardar(t) { try { localStorage.setItem(LLAVE, t); } catch (e) {} }

  function sistemaOscuro() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function temaActual() {
    return document.documentElement.getAttribute('data-tema') === OSCURO ? OSCURO : CLARO;
  }

  /* La barra del navegador y el color de la app instalada. */
  function pintarMeta(t) {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', COLOR_BARRA[t] || COLOR_BARRA.claro);
  }

  function pintarBoton(t) {
    var b = document.getElementById('tema-btn');
    if (!b) return;
    var oscuro = (t === OSCURO);
    b.textContent = oscuro ? '☀️' : '🌙';
    b.title = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', oscuro ? 'true' : 'false');
  }

  function aplicar(t, opciones) {
    var tema = (t === OSCURO) ? OSCURO : CLARO;
    var raiz = document.documentElement;
    if (!opciones || !opciones.silencioso) {
      /* Suaviza el salto de colores; se quita sola para no dejar transiciones
         pegadas en toda la app. */
      raiz.classList.add('tema-cambiando');
      setTimeout(function () { raiz.classList.remove('tema-cambiando'); }, 320);
    }
    raiz.setAttribute('data-tema', tema);
    pintarMeta(tema);
    pintarBoton(tema);
    try {
      document.dispatchEvent(new CustomEvent('ips:tema', { detail: { tema: tema } }));
    } catch (e) {}
  }

  function crearBoton() {
    if (document.getElementById('tema-btn')) return;
    var b = document.createElement('button');
    b.id = 'tema-btn';
    b.type = 'button';
    b.className = 'tema-btn';
    b.setAttribute('data-salida', '1');   /* por si un día entra la capa anti doble clic */
    b.addEventListener('click', function () {
      var nuevo = (temaActual() === OSCURO) ? CLARO : OSCURO;
      guardar(nuevo);
      aplicar(nuevo);
      /* Si las capas de sensación nativa están puestas, el cambio se siente. */
      try { if (window.fxTap) window.fxTap(); } catch (e) {}
    });
    document.body.appendChild(b);
    pintarBoton(temaActual());
  }

  function iniciar() {
    crearBoton();
    /* El guion del <head> ya dejó puesto data-tema antes del primer pintado;
       aquí solo se sincronizan el botón y la barra del navegador. */
    aplicar(temaActual(), { silencioso: true });

    /* Sin elección propia, la app sigue al sistema en caliente. */
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var alCambiar = function () {
        if (leerGuardado()) return;              /* el usuario ya decidió */
        aplicar(sistemaOscuro() ? OSCURO : CLARO);
      };
      if (mq.addEventListener) mq.addEventListener('change', alCambiar);
      else if (mq.addListener) mq.addListener(alCambiar);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  /* Puerta para las pruebas y para el resto de la app. */
  window.IPSTema = {
    actual: temaActual,
    aplicar: aplicar,
    alternar: function () {
      var n = (temaActual() === OSCURO) ? CLARO : OSCURO;
      guardar(n); aplicar(n); return n;
    },
    seguirSistema: function () {
      try { localStorage.removeItem(LLAVE); } catch (e) {}
      aplicar(sistemaOscuro() ? OSCURO : CLARO);
    }
  };
})();
