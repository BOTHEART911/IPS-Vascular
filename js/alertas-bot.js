/* ============================================================
 * IPS VASCULAR — js/alertas-bot.js           (NUEVO · FASE 7)
 * ------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales
 *
 * QUÉ HACE (ajuste 9)
 *   Añade a Configuración el bloque "Alertas del bot": hasta tres
 *   correos que reciben el aviso cuando el bot de WhatsApp se
 *   desconecta, el enlace que llevará el correo, el silencio
 *   nocturno, el interruptor de la vigilancia y un botón para
 *   mandarse un correo de prueba.
 *
 *   El vigilante vive en el servidor (Alertas.gs): mira el estado
 *   cada hora y avisa cuando lleva dos chequeos seguidos caído.
 *   Aquí solo se configura.
 *
 * POR QUÉ NO USA "setConfig"
 *   Las horas y la fecha de la última alerta se guardan con un
 *   endpoint propio que las escribe como TEXTO. Si fueran por la
 *   ruta normal, Sheets convertiría "22:00" en una celda de hora y
 *   el silencio nocturno dejaría de aplicar (le pasó a la app de
 *   referencia). Los correos también se validan en el servidor.
 *
 * CÓMO SE ENGANCHA
 *   No se modifica app.js. Envuelve Config.render y añade su
 *   sección al final. Si se borra este archivo, Configuración
 *   queda como en la Fase 6.
 *
 * INSTALACIÓN (al final del <body>, después de js/perfil.js)
 *   <script src="./js/alertas-bot.js"></script>
 * PAREJA
 *   css/alertas-bot.css
 * ============================================================ */
(function () {
  'use strict';
  if (window.__ipsAlertasBot) return;
  window.__ipsAlertasBot = true;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function val(o, k) { var v = o ? o[k] : ''; return (v == null) ? '' : String(v); }
  function aviso(icono, titulo) { if (typeof Toast !== 'undefined' && Toast) Toast.fire({ icon: icono, title: titulo }); }
  function fallo(t, h) { if (typeof alertErr === 'function') alertErr(t, h || ''); }
  function correoValido(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim()); }

  /* Una hora que Sheets pudo haber vuelto celda de HORA llega como
     fecha ISO en UTC: "03:00Z" son las 22:00 de Bogotá, así que aquí
     NO se adivina — se deja el valor por defecto y lo corrige
     estadoAlertasBot, que la convierte con la zona horaria correcta. */
  function hhmm(v, porDefecto) {
    var t = String(v == null ? '' : v).trim();
    if (!t) return porDefecto;
    if (/\d{4}-\d{2}-\d{2}T/.test(t)) return porDefecto;
    var m = t.match(/(\d{1,2}):(\d{2})/);
    if (!m) return porDefecto;
    var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (h > 23 || mi > 59) return porDefecto;
    return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
  }

  var A = window.AlertasBot = {
    estado: null,

    seccionHTML: function (cfg) {
      var c = cfg || {};
      return '' +
      '<p class="ab-intro">Si el bot de WhatsApp se desconecta, el sistema lo comprueba cada hora y avisa por correo. ' +
        'Manda otro correo cuando vuelve a estar en línea.</p>' +

      '<label for="ab-email1">Correo 1 (obligatorio)</label>' +
      '<input id="ab-email1" type="email" inputmode="email" autocomplete="off" value="' + esc(val(c, 'ALERTA_BOT_EMAIL_1')) + '" placeholder="alguien@ipsvascular.com"/>' +
      '<label for="ab-email2">Correo 2 (opcional)</label>' +
      '<input id="ab-email2" type="email" inputmode="email" autocomplete="off" value="' + esc(val(c, 'ALERTA_BOT_EMAIL_2')) + '"/>' +
      '<label for="ab-email3">Correo 3 (opcional)</label>' +
      '<input id="ab-email3" type="email" inputmode="email" autocomplete="off" value="' + esc(val(c, 'ALERTA_BOT_EMAIL_3')) + '"/>' +

      '<label for="ab-url">Enlace de la app (el botón del correo)</label>' +
      '<input id="ab-url" type="url" autocomplete="off" value="' + esc(val(c, 'APP_URL')) + '" placeholder="https://botheart911.github.io/IPS-Vascular/"/>' +
      '<p class="ab-nota">Si lo dejas vacío se usa la dirección de GitHub Pages de esta app.</p>' +

      '<label for="ab-silencio">Silencio nocturno</label>' +
      '<select id="ab-silencio">' +
        '<option value="FALSE">Desactivado</option>' +
        '<option value="TRUE">Activado</option>' +
      '</select>' +
      '<div class="ab-horas">' +
        '<div><label for="ab-inicio">Desde</label><input id="ab-inicio" type="time" value="' + esc(hhmm(val(c, 'ALERTA_BOT_SILENCIO_INICIO'), '22:00')) + '"/></div>' +
        '<div><label for="ab-fin">Hasta</label><input id="ab-fin" type="time" value="' + esc(hhmm(val(c, 'ALERTA_BOT_SILENCIO_FIN'), '06:00')) + '"/></div>' +
      '</div>' +
      '<p class="ab-nota">En esa franja no se envían correos. La caída se sigue contando y se avisa al terminar la ventana.</p>' +

      '<div class="ab-estado" id="ab-estado"><span class="ab-estado__punto ab-estado__punto--gris"></span>Consultando la vigilancia…</div>' +

      '<div class="ab-acciones">' +
        '<button type="button" class="btn btn-primary btn-sm" id="ab-guardar">💾 Guardar alertas</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="ab-probar">✉️ Enviar correo de prueba</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="ab-vigilancia">Activar vigilancia</button>' +
      '</div>';
    },

    montar: function (cont, cfg) {
      if (!cont || cont.querySelector('#ab-guardar')) return;
      var html = (typeof Config !== 'undefined' && typeof Config.seccion === 'function')
        ? Config.seccion('alertas', '🔔 Alertas del bot', A.seccionHTML(cfg))
        : '<section class="cfg-section"><div class="cfg-section__body">' + A.seccionHTML(cfg) + '</div></section>';

      var caja = document.createElement('div');
      caja.innerHTML = html;
      var sec = caja.firstElementChild;
      sec.classList.add('ab-seccion');
      cont.appendChild(sec);

      var cabeza = sec.querySelector('[data-cfg-toggle]');
      if (cabeza) cabeza.addEventListener('click', function () { sec.classList.toggle('open'); });

      var sel = sec.querySelector('#ab-silencio');
      sel.value = (String(val(cfg, 'ALERTA_BOT_SILENCIO_NOCTURNO')).toUpperCase() === 'TRUE') ? 'TRUE' : 'FALSE';
      A.pintarHoras(sec);
      sel.addEventListener('change', function () { A.pintarHoras(sec); });

      sec.addEventListener('input', function () { sec.dataset.abTocado = '1'; });
      sec.querySelector('#ab-guardar').addEventListener('click', function () { A.guardar(sec); });
      sec.querySelector('#ab-probar').addEventListener('click', function () { A.probar(sec); });
      sec.querySelector('#ab-vigilancia').addEventListener('click', function () { A.vigilancia(sec); });

      A.cargarEstado(sec);
    },

    pintarHoras: function (sec) {
      var on = sec.querySelector('#ab-silencio').value === 'TRUE';
      sec.querySelector('.ab-horas').classList.toggle('ab-horas--off', !on);
    },

    cargarEstado: function (sec) {
      return apiPost('estadoAlertasBot', withUser({})).then(function (d) {
        A.estado = d;
        A.aplicarEstado(sec);
        A.pintarEstado(sec);
      }).catch(function () {
        var e = sec.querySelector('#ab-estado');
        if (e) e.innerHTML = '<span class="ab-estado__punto ab-estado__punto--gris"></span>No se pudo consultar la vigilancia.';
      });
    },

    /* El servidor manda los valores ya limpios (horas convertidas a la
       zona de Colombia, correos recortados). Se vuelcan en la pantalla
       salvo que el usuario ya haya empezado a escribir. */
    aplicarEstado: function (sec) {
      var d = A.estado || {};
      if (sec.dataset.abTocado === '1') return;
      var pon = function (sel, valor) {
        var el = sec.querySelector(sel);
        if (el && valor != null) el.value = valor;
      };
      pon('#ab-email1', d.email1); pon('#ab-email2', d.email2); pon('#ab-email3', d.email3);
      pon('#ab-url', d.appUrl);
      pon('#ab-silencio', d.silencio ? 'TRUE' : 'FALSE');
      if (d.inicio) pon('#ab-inicio', d.inicio);
      if (d.fin) pon('#ab-fin', d.fin);
      A.pintarHoras(sec);
    },

    pintarEstado: function (sec) {
      var e = sec.querySelector('#ab-estado');
      var d = A.estado || {};
      if (!e) return;
      var punto = d.instalado ? 'verde' : 'ambar';
      var texto = d.instalado
        ? 'Vigilancia <b>activa</b>: el bot se comprueba cada hora.'
        : 'Vigilancia <b>apagada</b>: nadie está mirando el bot.';
      if (d.instalado && !d.correos) texto += ' Falta escribir el correo 1.';
      if (d.ultima) texto += '<br><span class="ab-estado__fina">Último aviso enviado: ' + esc(d.ultima) + '.</span>';
      if (Number(d.fallos) > 0) texto += '<br><span class="ab-estado__fina">Chequeos caídos seguidos: ' + esc(d.fallos) + '.</span>';
      e.innerHTML = '<span class="ab-estado__punto ab-estado__punto--' + punto + '"></span>' + texto;
      var b = sec.querySelector('#ab-vigilancia');
      if (b) b.textContent = d.instalado ? 'Apagar vigilancia' : 'Activar vigilancia';
    },

    leer: function (sec) {
      return {
        email1: sec.querySelector('#ab-email1').value.trim(),
        email2: sec.querySelector('#ab-email2').value.trim(),
        email3: sec.querySelector('#ab-email3').value.trim(),
        appUrl: sec.querySelector('#ab-url').value.trim(),
        silencio: sec.querySelector('#ab-silencio').value,
        inicio: sec.querySelector('#ab-inicio').value,
        fin: sec.querySelector('#ab-fin').value
      };
    },

    guardar: function (sec) {
      var d = A.leer(sec);
      if (!d.email1) { fallo('Falta el correo 1', 'Sin al menos un correo no hay a quién avisar.'); return; }
      var malo = [['Correo 1', d.email1], ['Correo 2', d.email2], ['Correo 3', d.email3]]
        .filter(function (p) { return p[1] && !correoValido(p[1]); })[0];
      if (malo) { fallo(malo[0] + ' no parece un correo', 'Revisa cómo está escrito.'); return; }

      startLoading();
      apiPost('guardarAlertasBot', withUser(d)).then(function (r) {
        A.estado = r;
        if (typeof Config !== 'undefined' && Config.cfg) {
          Config.cfg.ALERTA_BOT_EMAIL_1 = d.email1;
          Config.cfg.ALERTA_BOT_EMAIL_2 = d.email2;
          Config.cfg.ALERTA_BOT_EMAIL_3 = d.email3;
          Config.cfg.APP_URL = d.appUrl;
          Config.cfg.ALERTA_BOT_SILENCIO_NOCTURNO = d.silencio;
          Config.cfg.ALERTA_BOT_SILENCIO_INICIO = d.inicio;
          Config.cfg.ALERTA_BOT_SILENCIO_FIN = d.fin;
        }
        stopLoading();
        A.pintarEstado(sec);
        aviso('success', 'Alertas guardadas');
      }).catch(function (e) { stopLoading(); fallo('No se pudo guardar', e.message); });
    },

    probar: function (sec) {
      startLoading();
      apiPost('probarAlertaBot', withUser({})).then(function (r) {
        stopLoading();
        aviso('success', 'Correo de prueba enviado a ' + r.enviados + (r.enviados === 1 ? ' dirección' : ' direcciones'));
      }).catch(function (e) { stopLoading(); fallo('No se pudo enviar', e.message); });
    },

    vigilancia: function (sec) {
      var encender = !(A.estado && A.estado.instalado);
      startLoading();
      apiPost('instalarAlertasBot', withUser({ encender: encender ? 'true' : 'false' })).then(function (r) {
        A.estado = A.estado || {};
        A.estado.instalado = !!r.instalado;
        stopLoading();
        A.pintarEstado(sec);
        aviso('success', r.instalado ? 'Vigilancia activada' : 'Vigilancia apagada');
      }).catch(function (e) { stopLoading(); fallo('No se pudo cambiar la vigilancia', e.message); });
    }
  };

  function enganchar() {
    if (typeof Config === 'undefined' || typeof Config.render !== 'function') return;
    var rend = Config.render;
    Config.render = function () {
      var r = rend.apply(this, arguments);
      try { A.montar(document.getElementById('cfg-content'), this.cfg); } catch (e) { }
      return r;
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enganchar);
  else enganchar();
})();
