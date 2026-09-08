/* ============================================================================
 * IPS VASCULAR — RUEDA DE FECHA/HORA ESTILO iOS (ajuste 12) · FASE 6
 * ----------------------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales · +57 310 323 0712
 * Software propietario. Modificarlo anula la garantía de funcionamiento.
 * ----------------------------------------------------------------------------
 * QUÉ HACE
 *   Sustituye el calendario del navegador (input datetime-local / date) por
 *   una rueda como la de SEP-GROUP: columnas que se arrastran, con flechas
 *   ▲▼ para el computador y un resumen legible arriba.
 *
 * CÓMO SE ENGANCHA (sin tocar app.js)
 *   Un observador vigila el documento. Cuando SweetAlert2 pinta el modal de
 *   "Asignar cita", aparece <input id="as-fecha" type="datetime-local">: la
 *   capa lo esconde, pone un botón en su lugar y escribe la elección DENTRO
 *   del input original, con el mismo formato que usaba el navegador
 *   (AAAA-MM-DDTHH:MM). El preConfirm de app.js sigue leyendo .value igual
 *   que siempre, así que si se borra este archivo la app vuelve sola al
 *   calendario del navegador.
 *
 * DECISIONES TOMADAS CON LOS DATOS REALES DE LA IPS
 *   · MINUTOS DE 5 EN 5, no de 30 en 30 como en SEP-GROUP. En la hoja hay
 *     citas a y :05, :10, :15, :20 (81 citas), :25, :35, :40 (54)… Con
 *     bloques de media hora no se podrían volver a agendar 7 de cada 10
 *     horarios que la IPS usa hoy.
 *   · HORAS de 6 AM a 8 PM (las citas reales van de 7 AM a 5 PM). Si la
 *     solicitud que se abre trae una hora fuera de ese rango, la rueda se
 *     estira para poder mostrarla en vez de cambiársela por su cuenta.
 *   · NO SE BLOQUEA EL PASADO (SEP-GROUP sí lo hace). Aquí el mismo modal
 *     sirve para "Reenviar WhatsApp" de una cita ya vencida: si prohibiera
 *     el pasado, al reenviar le cambiaría la fecha al paciente sin avisar.
 *     En su lugar sale un aviso ámbar cuando la fecha elegida ya pasó.
 *   · AÑOS: el anterior, el actual y el siguiente (y el del dato guardado,
 *     si fuera otro). Así en diciembre se puede agendar para enero.
 * ========================================================================== */
(function () {
  'use strict';

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MESES_C = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  var DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var H = 40;                 /* alto de cada fila; debe coincidir con el CSS */
  var PASO_MIN = 5;           /* minutos de 5 en 5 */
  var HORA_DESDE = 6, HORA_HASTA = 20;

  var R = {                   /* estado de la rueda abierta */
    ok: null, soloFecha: false,
    anios: [], dias: [], horas: [], minutos: [],
    anio: 0, mes: 0
  };
  var caja = null;            /* el overlay, se crea una sola vez */

  /* ---------- utilidades ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function diasDelMes(mes, anio) { return new Date(anio, mes + 1, 0).getDate(); }
  function etiquetaHora(h) {
    var ap = h >= 12 ? 'PM' : 'AM', hh = h % 12; if (hh === 0) hh = 12;
    return hh + ' ' + ap;
  }
  function textoLargo(anio, mes, dia, hora, min, soloFecha) {
    var d = new Date(anio, mes, dia);
    var base = DIAS_SEM[d.getDay()] + ' ' + dia + ' de ' + MESES[mes] + ' de ' + anio;
    if (soloFecha) return base;
    var ap = hora >= 12 ? 'PM' : 'AM', hh = hora % 12; if (hh === 0) hh = 12;
    return base + ' · ' + hh + ':' + pad(min) + ' ' + ap;
  }
  /* Valor de un input datetime-local → partes locales, sin pasar por Date
     (un "2026-09-07T14:20" que se parsea como UTC corre la cita 5 horas). */
  function partesDeValor(v) {
    if (!v) return null;
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!m) return null;
    return {
      anio: +m[1], mes: +m[2] - 1, dia: +m[3],
      hora: m[4] === undefined ? 9 : +m[4],
      min: m[5] === undefined ? 0 : +m[5]
    };
  }

  /* ---------- construcción del overlay ---------- */
  function construirCaja() {
    if (caja) return caja;
    caja = document.createElement('div');
    caja.className = 'rf-overlay hidden';
    caja.id = 'rf-overlay';
    caja.innerHTML =
      '<div class="rf-card" role="dialog" aria-modal="true" aria-label="Elegir fecha y hora">' +
        '<div class="rf-head">' +
          '<button type="button" class="rf-btn-txt" data-rf="cancelar">Cancelar</button>' +
          '<span class="rf-resumen" id="rf-resumen">—</span>' +
          '<button type="button" class="rf-btn-txt rf-ok" data-rf="ok">Listo</button>' +
        '</div>' +
        '<div class="rf-aviso hidden" id="rf-aviso">Esa fecha y hora ya pasaron.</div>' +
        '<div class="rf-rotulos">' +
          '<span>Día</span><span>Mes</span><span>Año</span>' +
          '<span class="rf-hora-col">Hora</span><span class="rf-hora-col">Min</span>' +
        '</div>' +
        '<div class="rf-nav rf-nav--sube">' +
          flecha('dia', -1) + flecha('mes', -1) + flecha('anio', -1) +
          flecha('hora', -1, true) + flecha('min', -1, true) +
        '</div>' +
        '<div class="rf-ruedas">' +
          '<div class="rf-marca"></div>' +
          '<div class="rf-col" id="rf-dia" tabindex="0"></div>' +
          '<div class="rf-col" id="rf-mes" tabindex="0"></div>' +
          '<div class="rf-col" id="rf-anio" tabindex="0"></div>' +
          '<div class="rf-col rf-hora-col" id="rf-hora" tabindex="0"></div>' +
          '<div class="rf-col rf-hora-col" id="rf-min" tabindex="0"></div>' +
        '</div>' +
        '<div class="rf-nav rf-nav--baja">' +
          flecha('dia', 1) + flecha('mes', 1) + flecha('anio', 1) +
          flecha('hora', 1, true) + flecha('min', 1, true) +
        '</div>' +
      '</div>';
    document.body.appendChild(caja);

    caja.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-rf]');
      if (b) {
        var q = b.getAttribute('data-rf');
        if (q === 'cancelar') return cerrar();
        if (q === 'ok') return aceptar();
        if (q === 'nudge') return empujar(b.getAttribute('data-col'), +b.getAttribute('data-d'));
        return;
      }
      if (ev.target === caja) cerrar();   /* tocar fuera de la tarjeta */
    });
    return caja;
  }
  function flecha(col, d, esHora) {
    return '<button type="button" class="rf-flecha' + (esHora ? ' rf-hora-col' : '') +
           '" data-rf="nudge" data-col="rf-' + col + '" data-d="' + d + '" aria-label="' +
           (d < 0 ? 'subir' : 'bajar') + ' ' + col + '">' + (d < 0 ? '▲' : '▼') + '</button>';
  }

  /* ---------- columnas ---------- */
  function pintarCol(el, items, idx, alParar) {
    el.innerHTML = '<div class="rf-pad"></div>' +
      items.map(function (t, i) { return '<div class="rf-item" data-i="' + i + '">' + t + '</div>'; }).join('') +
      '<div class="rf-pad"></div>';
    el.scrollTop = Math.max(0, idx) * H;
    marcar(el);
    var t = null;
    el.onscroll = function () {
      marcar(el);
      if (t) clearTimeout(t);
      t = setTimeout(function () {
        var i = seleccion(el);
        el.scrollTo({ top: i * H, behavior: 'smooth' });
        if (alParar) alParar(i);
        refrescarResumen();
      }, 90);
    };
    /* En el computador: clic directo sobre cualquier fila. */
    Array.prototype.forEach.call(el.querySelectorAll('.rf-item'), function (fila) {
      fila.addEventListener('click', function () {
        el.scrollTop = (+fila.dataset.i) * H;   /* instantáneo: la lectura es fiable */
        marcar(el);
        if (alParar) alParar(+fila.dataset.i);
        refrescarResumen();
      });
    });
  }
  function seleccion(el) { return Math.max(0, Math.round(el.scrollTop / H)); }
  function marcar(el) {
    var i = seleccion(el);
    Array.prototype.forEach.call(el.querySelectorAll('.rf-item'), function (f) {
      f.classList.toggle('sel', +f.dataset.i === i);
    });
  }
  function col(id) { return caja.querySelector('#' + id); }
  function valorCol(id, arr) {
    var el = col(id); if (!el || !arr.length) return arr[0];
    return arr[Math.min(seleccion(el), arr.length - 1)];
  }
  function empujar(id, d) {
    var el = col(id); if (!el) return;
    var n = el.querySelectorAll('.rf-item').length;
    var i = Math.min(Math.max(seleccion(el) + d, 0), n - 1);
    el.scrollTop = i * H;
    marcar(el);
    if (id === 'rf-mes' || id === 'rf-anio') rehacerDias();
    refrescarResumen();
  }

  /* Al cambiar mes o año hay que rehacer los días: febrero no siempre tiene
     los mismos, y el 31 no existe en todos los meses. Se conserva el día
     elegido si cabe; si no, se queda en el último del mes. */
  function rehacerDias() {
    R.mes  = valorCol('rf-mes', R.meses);
    R.anio = valorCol('rf-anio', R.anios);
    var antes = R.dias.length ? R.dias[Math.min(seleccion(col('rf-dia')), R.dias.length - 1)] : 1;
    var total = diasDelMes(R.mes, R.anio);
    R.dias = []; for (var d = 1; d <= total; d++) R.dias.push(d);
    var pos = R.dias.indexOf(Math.min(antes, total));
    pintarCol(col('rf-dia'), R.dias.map(String), Math.max(0, pos));
  }

  function leerTodo() {
    var mes  = valorCol('rf-mes', R.meses);
    var anio = valorCol('rf-anio', R.anios);
    var dia  = valorCol('rf-dia', R.dias);
    var hora = R.soloFecha ? 0 : valorCol('rf-hora', R.horas);
    var min  = R.soloFecha ? 0 : valorCol('rf-min', R.minutos);
    return { anio: anio, mes: mes, dia: dia, hora: hora, min: min };
  }

  function refrescarResumen() {
    if (!caja || caja.classList.contains('hidden')) return;
    var v = leerTodo();
    var r = caja.querySelector('#rf-resumen');
    if (r) r.textContent = textoLargo(v.anio, v.mes, v.dia, v.hora, v.min, R.soloFecha);
    var av = caja.querySelector('#rf-aviso');
    if (av) {
      var elegida = new Date(v.anio, v.mes, v.dia, v.hora, v.min, 0, 0);
      av.classList.toggle('hidden', elegida.getTime() >= Date.now());
    }
  }

  /* ---------- abrir / cerrar ---------- */
  function abrir(valor, alAceptar, opciones) {
    construirCaja();
    R.ok = alAceptar;
    R.soloFecha = !!(opciones && opciones.soloFecha);
    caja.classList.toggle('rf-solo-fecha', R.soloFecha);

    var hoy = new Date();
    var p = partesDeValor(valor) || {
      anio: hoy.getFullYear(), mes: hoy.getMonth(), dia: hoy.getDate(),
      hora: Math.min(Math.max(hoy.getHours(), HORA_DESDE), HORA_HASTA), min: 0
    };

    /* Años: anterior, actual, siguiente — más el del dato guardado si se sale. */
    var base = hoy.getFullYear();
    R.anios = [base - 1, base, base + 1];
    if (R.anios.indexOf(p.anio) < 0) { R.anios.push(p.anio); R.anios.sort(function (a, b) { return a - b; }); }

    R.meses = [0,1,2,3,4,5,6,7,8,9,10,11];

    /* Horas: el rango de atención, estirado si el dato guardado se sale de él
       (hay una cita histórica a las 4 AM: no se le cambia la hora a la brava). */
    var desde = Math.min(HORA_DESDE, p.hora), hasta = Math.max(HORA_HASTA, p.hora);
    R.horas = []; for (var h = desde; h <= hasta; h++) R.horas.push(h);

    /* Minutos de 5 en 5; si el dato guardado cae entre medias, se añade tal
       cual para no moverle la cita al paciente sin que nadie lo pida. */
    R.minutos = []; for (var m = 0; m < 60; m += PASO_MIN) R.minutos.push(m);
    if (R.minutos.indexOf(p.min) < 0) { R.minutos.push(p.min); R.minutos.sort(function (a, b) { return a - b; }); }

    R.anio = p.anio; R.mes = p.mes;
    var total = diasDelMes(p.mes, p.anio);
    R.dias = []; for (var d = 1; d <= total; d++) R.dias.push(d);

    /* IMPORTANTE: mostrar ANTES de pintar. Con el contenedor en display:none,
       asignar scrollTop no surte efecto y todas las ruedas se quedarían en la
       primera fila (ese fue el fallo B de SEP-GROUP: la hora salía siempre a
       las 6:00 AM). */
    caja.classList.remove('hidden');
    document.body.classList.add('rf-abierta');

    pintarCol(col('rf-dia'),  R.dias.map(String), Math.max(0, R.dias.indexOf(Math.min(p.dia, total))));
    pintarCol(col('rf-mes'),  MESES_C.slice(), p.mes, function () { rehacerDias(); });
    pintarCol(col('rf-anio'), R.anios.map(String), Math.max(0, R.anios.indexOf(p.anio)), function () { rehacerDias(); });
    if (!R.soloFecha) {
      pintarCol(col('rf-hora'), R.horas.map(etiquetaHora), Math.max(0, R.horas.indexOf(p.hora)));
      pintarCol(col('rf-min'),  R.minutos.map(pad), Math.max(0, R.minutos.indexOf(p.min)));
    }
    refrescarResumen();
  }

  function cerrar() {
    if (!caja) return;
    caja.classList.add('hidden');
    document.body.classList.remove('rf-abierta');
  }

  function aceptar() {
    /* Leer TODAS las columnas ANTES de ocultar: en un contenedor oculto
       scrollTop vale 0 y se perdería la hora. */
    var v = leerTodo();
    cerrar();
    var iso = v.anio + '-' + pad(v.mes + 1) + '-' + pad(v.dia) +
              (R.soloFecha ? '' : 'T' + pad(v.hora) + ':' + pad(v.min));
    if (R.ok) R.ok(iso, textoLargo(v.anio, v.mes, v.dia, v.hora, v.min, R.soloFecha));
  }

  /* Escape cierra SOLO la rueda. Sin esto SweetAlert2 lo atrapa y cierra el
     modal entero de la cita, perdiendo lo que ya se había escrito. */
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape' || !caja || caja.classList.contains('hidden')) return;
    ev.stopPropagation(); ev.preventDefault();
    cerrar();
  }, true);

  /* ==========================================================================
   * ENGANCHE: cambiar los campos de fecha del navegador por la rueda
   * ======================================================================= */
  function esCampoFecha(el) {
    return el && el.tagName === 'INPUT' &&
           (el.type === 'datetime-local' || el.type === 'date') &&
           !el.dataset.rfListo;
  }

  function adoptar(inp) {
    inp.dataset.rfListo = '1';
    var soloFecha = (inp.type === 'date');

    var envoltura = document.createElement('div');
    envoltura.className = 'rf-campo';
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'rf-disparo';
    boton.setAttribute('data-salida', '1');   /* por si entra la capa anti doble clic */

    inp.parentNode.insertBefore(envoltura, inp);
    envoltura.appendChild(inp);
    envoltura.appendChild(boton);
    inp.classList.add('rf-oculto');
    /* readonly (no disabled): un campo deshabilitado no viaja en el formulario
       y app.js lee su .value en el preConfirm. */
    inp.readOnly = true;

    function pintarBoton() {
      var p = partesDeValor(inp.value);
      if (p) {
        boton.classList.remove('vacio');
        boton.innerHTML = '<span class="rf-disparo__ico">🗓️</span><span class="rf-disparo__txt">' +
          textoLargo(p.anio, p.mes, p.dia, p.hora, p.min, soloFecha) + '</span><span class="rf-disparo__mas">Cambiar</span>';
      } else {
        boton.classList.add('vacio');
        boton.innerHTML = '<span class="rf-disparo__ico">🗓️</span><span class="rf-disparo__txt">' +
          (soloFecha ? 'Elegir fecha' : 'Elegir fecha y hora') + '</span><span class="rf-disparo__mas">Abrir</span>';
      }
    }
    pintarBoton();

    boton.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      abrir(inp.value, function (iso) {
        inp.value = iso;
        pintarBoton();
        /* Avisar por si algo de la app escucha el campo. */
        inp.dispatchEvent(new Event('input',  { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }, { soloFecha: soloFecha });
    });
  }

  function barrer(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    if (esCampoFecha(raiz)) adoptar(raiz);
    Array.prototype.forEach.call(
      raiz.querySelectorAll('input[type="datetime-local"], input[type="date"]'),
      function (i) { if (esCampoFecha(i)) adoptar(i); }
    );
  }

  function iniciar() {
    barrer(document.body);
    var obs = new MutationObserver(function (lista) {
      for (var i = 0; i < lista.length; i++) {
        var añadidos = lista[i].addedNodes;
        for (var j = 0; j < añadidos.length; j++) {
          if (añadidos[j].nodeType === 1) barrer(añadidos[j]);
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  /* Puerta para las pruebas y para lo que se construya después. */
  window.IPSRueda = { abrir: abrir, cerrar: cerrar, adoptar: adoptar, barrer: barrer, _estado: R };
})();
