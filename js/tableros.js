/* ============================================================
 * IPS VASCULAR — js/tableros.js            (NUEVO · FASE 4)
 * ------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales
 * ------------------------------------------------------------
 * QUÉ HACE (ajuste 3)
 *   Cada vista tabula LO SUYO:
 *     · Inicio        → lo que hay que atender hoy (reemplaza el
 *                       panel de cuatro cifras sueltas).
 *     · Solicitudes   → tablero que obedece los filtros puestos.
 *     · Profesionales → comparativa de carga y tarjeta por doctor.
 *     · Pacientes     → censo, recurrencia y pacientes nuevos.
 *
 * DE DÓNDE SALEN LOS NÚMEROS
 *   Profesionales y Pacientes: del servidor (Tablero.gs).
 *   Solicitudes: se calcula EN EL TELÉFONO (js/tablero-local.js)
 *   sobre la lista que ya está en memoria. Desde la carga única los
 *   filtros son locales, así que el servidor no sabe qué se está
 *   viendo: si el tablero siguiera viniendo de allá, cada pastilla
 *   volvería a ser un viaje. La cuenta es la misma —el banco de
 *   pruebas compara las dos salidas campo a campo—, y el PDF de
 *   informes la sigue haciendo en el servidor.
 *
 * CÓMO SE ENGANCHA
 *   No se modifica app.js: esta capa envuelve Solicitudes.params /
 *   .aplicar / .render, Profesionales.cargar / .render,
 *   Pacientes.abrir / .render y reemplaza cargarDashboard().
 *   Si un día se borra este archivo, la app vuelve sola a como
 *   estaba en la Fase 3.
 *
 * INSTALACIÓN (al final del <body>, después de las capas fx-*)
 *   <script src="./js/tableros.js"></script>
 * PAREJA
 *   css/tableros.css
 * ============================================================ */
(function () {
  'use strict';
  if (window.__ipsTableros) return;
  window.__ipsTableros = true;

  /* Lo que calcula el servidor queda aquí para que la capa de
     Insights redacte sus informes sin volver a pedir nada. */
  var DATOS = window.IPSDatos = { solicitudes: null, profesionales: null, pacientes: null };

  var ESTADOS_ORD = ['PENDIENTE', 'ASIGNADA', 'CONFIRMADA', 'REALIZADA', 'DESCARTADA', 'CANCELADA'];
  var COLOR = {
    PENDIENTE: 'var(--e-pendiente)', ASIGNADA: 'var(--e-asignada)', CONFIRMADA: 'var(--e-confirmada)',
    REALIZADA: 'var(--e-realizada)', DESCARTADA: 'var(--e-descartada)', CANCELADA: 'var(--e-cancelada)'
  };
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
               'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  /* ---------------- utilidades ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v) {
    var x = Number(v || 0);
    try { return x.toLocaleString('es-CO'); } catch (e) { return String(x); }
  }
  function pc(a, t) { return t ? Math.round(a * 100 / t) : 0; }
  function bonito(e) { return String(e).charAt(0) + String(e).slice(1).toLowerCase(); }
  function nodo(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  }
  function fechaCorta(yyyymmdd) {
    if (!yyyymmdd) return '—';
    var p = String(yyyymmdd).split('-');
    if (p.length !== 3) return String(yyyymmdd);
    return p[2] + '/' + p[1] + '/' + p[0].slice(-2);
  }
  function recordar(clave, valor) { try { localStorage.setItem('ipsTab_' + clave, valor ? '1' : '0'); } catch (e) {} }
  function recordado(clave) { try { return localStorage.getItem('ipsTab_' + clave) !== '0'; } catch (e) { return true; } }

  /* ---------------- piezas visuales ---------------- */

  /* Anillo de estados: el total en el centro y cada estado con su
     color. Es la única pieza "grande" del tablero a propósito. */
  function anillo(porEstado, total, etiqueta) {
    var R = 52, C = 2 * Math.PI * R, off = 0, segs = '';
    ESTADOS_ORD.forEach(function (e) {
      var v = porEstado[e] || 0;
      if (!v || !total) return;
      var largo = C * v / total;
      segs += '<circle class="anillo__seg" cx="60" cy="60" r="' + R + '" stroke="' + COLOR[e] + '"' +
        ' stroke-dasharray="' + largo.toFixed(2) + ' ' + (C - largo).toFixed(2) + '"' +
        ' stroke-dashoffset="' + (-off).toFixed(2) + '"><title>' + bonito(e) + ': ' + num(v) + '</title></circle>';
      off += largo;
    });
    return '<div class="anillo">' +
      '<svg viewBox="0 0 120 120" role="img" aria-label="Distribución por estado">' +
      '<circle class="anillo__pista" cx="60" cy="60" r="' + R + '"/>' + segs + '</svg>' +
      '<div class="anillo__centro"><span class="anillo__val">' + num(total) + '</span>' +
      '<span class="anillo__lbl">' + esc(etiqueta) + '</span></div></div>';
  }

  function leyendaEstados(porEstado, total, tocable) {
    return '<div class="leyenda">' + ESTADOS_ORD.map(function (e) {
      var v = porEstado[e] || 0;
      return '<button class="leyenda__fila" data-estado="' + e + '"' + (tocable ? '' : ' disabled') + '>' +
        '<span class="leyenda__punto" style="background:' + COLOR[e] + '"></span>' +
        '<span class="leyenda__txt">' + bonito(e) + '</span>' +
        '<span class="leyenda__n">' + num(v) + '</span>' +
        '<span class="leyenda__pct">' + pc(v, total) + ' %</span></button>';
    }).join('') + '</div>';
  }

  function barras(items, opciones) {
    opciones = opciones || {};
    if (!items || !items.length) return '<p class="bloque__vacio">' + (opciones.vacio || 'Sin datos todavía.') + '</p>';
    var max = items.reduce(function (m, x) { return Math.max(m, x.total); }, 1);
    return items.map(function (x) {
      return '<div class="barra"><div style="min-width:0">' +
        '<div class="barra__n">' + esc(x.nombre) + '</div>' +
        '<div class="barra__pista"><i class="barra__fill' + (opciones.verde ? ' barra__fill--verde' : '') +
        '" style="width:' + (x.total / max * 100).toFixed(1) + '%"></i></div></div>' +
        '<span class="barra__q">' + num(x.total) + (opciones.sufijo || '') + '</span></div>';
    }).join('');
  }

  /* Columnas para meses y horas. `pico` resalta la más alta. */
  function columnas(items, opciones) {
    opciones = opciones || {};
    if (!items || !items.length) return '<p class="bloque__vacio">' + (opciones.vacio || 'Sin datos todavía.') + '</p>';
    var max = items.reduce(function (m, x) { return Math.max(m, x.total); }, 1);
    var barras_ = items.map(function (x) {
      var alto = Math.max(2, x.total / max * 100);
      var cls = (opciones.pico && x.total === max) ? ' cols__b--pico' : '';
      return '<div class="cols__c" title="' + esc(x.titulo || x.etiqueta) + ': ' + num(x.total) + '">' +
        '<i class="cols__b' + cls + '" style="height:' + alto.toFixed(1) + '%"></i></div>';
    }).join('');
    var lbls = items.map(function (x) {
      return '<span class="cols__l" title="' + esc(x.titulo || x.etiqueta) + ': ' + num(x.total) + '">' +
        esc(x.etiqueta) + (x.sub ? '<small>' + esc(x.sub) + '</small>' : '') + '</span>';
    }).join('');
    return '<div class="cols">' + barras_ + '</div><div class="cols__lbls">' + lbls + '</div>';
  }

  function serieOrdenada(serie) {
    return (serie || []).slice().sort(function (a, b) {
      return (a.anio - b.anio) || (MESES.indexOf(a.mes) - MESES.indexOf(b.mes));
    });
  }
  function colsMeses(serie) {
    return columnas(serieOrdenada(serie).map(function (x) {
      return { total: x.total, etiqueta: String(x.mes).slice(0, 3), sub: "'" + String(x.anio).slice(-2),
               titulo: x.mes + ' ' + x.anio };
    }), { pico: true });
  }

  /* ---------------- contenedor de tablero ---------------- */
  function panel(id, titulo, dondeAntes, contenedorPadre) {
    var el = document.getElementById(id);
    if (el) return el;
    el = nodo('<section class="tab" id="' + id + '">' +
      '<button class="tab__head" type="button" aria-expanded="true">' +
      '<h3 class="tab__titulo">' + esc(titulo) + '</h3>' +
      '<span class="tab__pista"></span>' +
      '<svg class="tab__flecha" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</button><div class="tab__cuerpo"></div></section>');
    if (dondeAntes && dondeAntes.parentNode) dondeAntes.parentNode.insertBefore(el, dondeAntes);
    else if (contenedorPadre) contenedorPadre.appendChild(el);
    if (!recordado(id)) { el.classList.add('is-cerrado'); el.querySelector('.tab__head').setAttribute('aria-expanded', 'false'); }
    el.querySelector('.tab__head').addEventListener('click', function () {
      var cerrado = el.classList.toggle('is-cerrado');
      this.setAttribute('aria-expanded', cerrado ? 'false' : 'true');
      recordar(id, !cerrado);
    });
    return el;
  }
  function pintar(el, pista, html) {
    if (!el) return;
    el.querySelector('.tab__pista').textContent = pista || '';
    el.querySelector('.tab__cuerpo').innerHTML = html;
  }
  function esqueleto(el) {
    if (el) el.querySelector('.tab__cuerpo').innerHTML = '<div class="tab__skel"></div>';
  }

  /* ============================================================
     TABLERO DE SOLICITUDES
     ============================================================ */
  function htmlSolicitudes(T, tocable) {
    var a = T.agenda || {};
    var hero = '<div class="tab__hero">' + anillo(T.porEstado, T.total, T.total === 1 ? 'solicitud' : 'solicitudes') +
      leyendaEstados(T.porEstado, T.total, tocable) + '</div>';

    var cifras = '<div class="tab__cifras">' +
      cifra(a.hoy, 'Citas hoy', a.hoy ? 'ok' : '') +
      cifra(a.semana, 'Próximos 7 días', '') +
      cifra(a.vencidas, 'Vencidas sin cerrar', a.vencidas ? 'alerta' : '') +
      cifra(T.sinProfesional, 'Sin profesional', T.sinProfesional ? 'alerta' : '') +
      '</div>';

    var bloques = '<div class="tab__bloques">';

    bloques += '<div class="bloque"><p class="bloque__t">Solicitudes por mes</p>' + colsMeses(T.serieMes) +
      '<p class="cols__pie">' + textoMes(T) + '</p></div>';

    bloques += '<div class="bloque"><p class="bloque__t">Servicios más pedidos</p>' +
      barras((T.topServicios || []).slice(0, 5), { verde: true }) +
      (T.serviciosTotal > 5 ? '<p class="tab__nota">' + T.serviciosTotal + ' servicios distintos en total.</p>' : '') +
      '</div>';

    bloques += '<div class="bloque"><p class="bloque__t">Carga por profesional</p>' +
      barras((T.profesionales || []).map(function (p) { return { nombre: p.nombre, total: p.total }; })) +
      '</div>';

    bloques += '<div class="bloque"><p class="bloque__t">Franjas con más citas</p>' +
      columnas((T.horas || []).map(function (h) {
        return { total: h.total, etiqueta: h.hora, titulo: h.hora + ':00' };
      }), { pico: true, vacio: 'Ninguna de estas solicitudes tiene fecha asignada.' }) +
      (T.horaPico ? '<p class="cols__pie">La franja más ocupada es a las <b>' + esc(T.horaPico.hora) + ':00</b>' +
        (T.diaPico ? ' y el día con más citas es el <b>' + esc(T.diaPico.dia) + '</b>' : '') + '.</p>' : '') +
      '</div>';

    bloques += '</div>';

    var nota = '<p class="tab__nota">Por agendar (sin fecha): <b>' + num(T.sinFecha) + '</b> · ' +
      'Sin tratamiento: <b>' + num(T.sinTratamiento) + '</b> · ' +
      'Efectividad sobre lo gestionado: <b>' + T.pctEfectivas + ' %</b>' +
      (a.masVieja ? ' · La más atrasada es <b>' + esc(a.masVieja.id) + '</b> del ' + fechaCorta(a.masVieja.fecha) : '') +
      '</p>';

    return hero + cifras + bloques + nota;
  }
  function cifra(v, lbl, tono) {
    return '<div class="cifra' + (tono ? ' cifra--' + tono : '') + '">' +
      '<div class="cifra__val">' + num(v) + '</div><div class="cifra__lbl">' + esc(lbl) + '</div></div>';
  }
  function textoMes(T) {
    if (!T.ultimoMes) return 'Todavía no hay meses con solicitudes.';
    var t = 'En ' + T.ultimoMes.mes + ' van <b>' + num(T.ultimoMes.total) + '</b>';
    if (T.anteriorMes) {
      var d = T.ultimoMes.total - T.anteriorMes.total;
      t += d === 0 ? ', igual que en ' + T.anteriorMes.mes
        : (d > 0 ? ', <b>' + num(d) + '</b> más que en ' + T.anteriorMes.mes
                 : ', <b>' + num(-d) + '</b> menos que en ' + T.anteriorMes.mes);
    }
    if (T.mejorMes) t += '. El mejor mes fue ' + T.mejorMes.mes + ' ' + T.mejorMes.anio + ' con <b>' + num(T.mejorMes.total) + '</b>';
    return t + '.';
  }

  function pintarSolicitudes() {
    var lista = document.getElementById('sol-content');
    if (!lista) return;
    var el = panel('sol-tablero', 'Tablero de solicitudes', lista);
    var T = DATOS.solicitudes;
    if (!T) { esqueleto(el); return; }
    var filtrado = (typeof Solicitudes !== 'undefined') && Solicitudes.hayFiltros && Solicitudes.hayFiltros();
    pintar(el, filtrado ? 'sobre lo filtrado · ' + num(T.total) : num(T.total) + ' en total',
      htmlSolicitudes(T, true));
    /* Tocar un estado en la leyenda filtra la lista: el tablero no es
       un adorno, es otra forma de navegar. */
    Array.prototype.forEach.call(el.querySelectorAll('.leyenda__fila'), function (b) {
      b.addEventListener('click', function () {
        if (typeof Solicitudes === 'undefined') return;
        var e = b.dataset.estado;
        Solicitudes.filtroEstado = (Solicitudes.filtroEstado === e) ? 'TODOS' : e;
        Solicitudes.cargar();
      });
    });
  }

  /* ============================================================
     TABLERO DE PROFESIONALES
     ============================================================ */
  function pilaCarga(P) {
    var filas = (P.profesionales || []).filter(function (x) { return x.total > 0; });
    var todos = filas.concat(P.sinAsignar && P.sinAsignar.total ? [P.sinAsignar] : []);
    if (!todos.length || !P.total) return '<p class="bloque__vacio">Todavía no hay solicitudes.</p>';
    var tonos = ['var(--primary)', 'var(--accent)', 'var(--primary-light)', '#7c3aed', '#d97706'];
    var pila = '<div class="pila">' + todos.map(function (x, i) {
      var c = (x.nombre === 'Sin profesional') ? 'var(--e-pendiente)' : tonos[i % tonos.length];
      var w = x.total / P.total * 100;
      return '<i style="width:' + w.toFixed(2) + '%;background:' + c + '" title="' + esc(x.nombre) + ': ' + num(x.total) + '">' +
        (w > 9 ? Math.round(w) + ' %' : '') + '</i>';
    }).join('') + '</div>';
    var ley = '<div class="pila__leyenda">' + todos.map(function (x, i) {
      var c = (x.nombre === 'Sin profesional') ? 'var(--e-pendiente)' : tonos[i % tonos.length];
      return '<span><i style="background:' + c + '"></i>' + esc(x.nombre) + ' · ' + num(x.total) + '</span>';
    }).join('') + '</div>';
    return pila + ley;
  }

  function htmlProfesionales(P) {
    var conjunto = (P.profesionales || []).filter(function (x) { return x.total > 0; });
    var lider = conjunto[0];
    var mejor = conjunto.slice().sort(function (a, b) { return b.pctEfectivas - a.pctEfectivas; })[0];
    var venc = conjunto.reduce(function (a, x) { return a + x.vencidas; }, 0) + (P.sinAsignar ? P.sinAsignar.vencidas : 0);
    var hoy = conjunto.reduce(function (a, x) { return a + x.hoy; }, 0) + (P.sinAsignar ? P.sinAsignar.hoy : 0);
    var sem = conjunto.reduce(function (a, x) { return a + x.semana; }, 0) + (P.sinAsignar ? P.sinAsignar.semana : 0);

    var cifras = '<div class="tab__cifras">' +
      cifra(P.activos, P.activos === 1 ? 'Profesional con carga' : 'Profesionales con carga', '') +
      cifra(hoy, 'Citas hoy', hoy ? 'ok' : '') +
      cifra(sem, 'Próximos 7 días', '') +
      cifra(venc, 'Vencidas sin cerrar', venc ? 'alerta' : '') +
      '</div>';

    var bloques = '<div class="tab__bloques">' +
      '<div class="bloque"><p class="bloque__t">Reparto de la carga</p>' + pilaCarga(P) +
      (P.sinAsignar && P.sinAsignar.total
        ? '<p class="tab__nota"><b>' + num(P.sinAsignar.total) + '</b> solicitudes (' + P.sinAsignar.pctCarga +
          ' %) todavía no tienen profesional' + (P.sinAsignar.futuras ? ', y <b>' + num(P.sinAsignar.futuras) + '</b> de ellas ya tienen fecha.' : '.') + '</p>'
        : '') + '</div>' +
      '<div class="bloque"><p class="bloque__t">Efectividad sobre lo gestionado</p>' +
      barras(conjunto.map(function (x) { return { nombre: x.nombre, total: x.pctEfectivas }; }), { verde: true, sufijo: ' %' }) +
      (mejor ? '<p class="tab__nota">Se cuenta confirmadas y realizadas frente a todo lo que ya salió de pendiente. Va primero <b>' + esc(mejor.nombre) + '</b>.</p>' : '') +
      '</div></div>';

    var pie = lider ? '<p class="tab__nota">Con más solicitudes encima: <b>' + esc(lider.nombre) + '</b> (' +
      num(lider.total) + ', el ' + lider.pctCarga + ' % del total).</p>' : '';

    return cifras + bloques + pie;
  }

  function tarjetaProf(p, esSin) {
    var ini = String(p.nombre || '?').replace(/^Dr\.?\s*/i, '').trim().charAt(0).toUpperCase() || 'D';
    var pila = ESTADOS_ORD.map(function (e) {
      var v = p.porEstado[e] || 0;
      if (!v) return '';
      return '<i style="width:' + (v / p.total * 100).toFixed(2) + '%;background:' + COLOR[e] + '" title="' + bonito(e) + ': ' + num(v) + '"></i>';
    }).join('');
    var minis = '<span class="profx__m">Abiertas <b>' + num(p.abiertas) + '</b></span>' +
      '<span class="profx__m">Próximas <b>' + num(p.futuras) + '</b></span>' +
      (p.vencidas ? '<span class="profx__m profx__m--alerta">Vencidas <b>' + num(p.vencidas) + '</b></span>' : '') +
      (p.gestionadas ? '<span class="profx__m">Efectividad <b>' + p.pctEfectivas + ' %</b></span>' : '');
    var serv = (p.topServicios && p.topServicios.length) ? p.topServicios[0].nombre : '';
    return '<button class="profx' + (esSin ? ' profx--sin' : '') + '" data-profx="' + esc(p.nombre) + '" type="button">' +
      '<div class="profx__top"><div class="profx__ini">' + esc(ini) + '</div>' +
      '<div style="min-width:0"><h4 class="profx__nom">' + esc(p.nombre) + '</h4>' +
      '<div class="profx__sub">' + (p.hoy ? p.hoy + (p.hoy === 1 ? ' cita hoy' : ' citas hoy') : 'Sin citas hoy') +
      (p.semana ? ' · ' + p.semana + ' esta semana' : '') + '</div></div>' +
      '<div class="profx__tot"><b>' + num(p.total) + '</b><span>solicitudes</span></div></div>' +
      '<div class="profx__mini">' + minis + '</div>' +
      '<div class="profx__pila">' + pila + '</div>' +
      (serv ? '<div class="profx__pie">Sobre todo: ' + esc(serv) + '</div>' : '') +
      '</button>';
  }

  function pintarProfesionales() {
    var cont = document.getElementById('prof-content');
    if (!cont) return;
    var el = panel('prof-tablero', 'Tablero de profesionales', cont);
    var P = DATOS.profesionales;
    if (!P) {
      /* Mientras llegan las cifras se pintan los nombres que ya se
         tienen: la vista nunca queda en blanco. */
      esqueleto(el);
      var previos = (typeof Profesionales !== 'undefined' && Profesionales.data) ? Profesionales.data : [];
      cont.innerHTML = '<div class="prof-grid">' + previos.map(function (p) {
        return '<div class="profx"><div class="profx__top"><div class="profx__ini">' +
          esc(String(p.nombre || '?').replace(/^Dr\.?\s*/i, '').trim().charAt(0).toUpperCase() || 'D') + '</div>' +
          '<div style="min-width:0"><h4 class="profx__nom">' + esc(p.nombre) + '</h4>' +
          '<div class="profx__sub">Cargando sus cifras…</div></div></div></div>';
      }).join('') + '</div>';
      return;
    }
    pintar(el, num(P.total) + ' solicitudes repartidas', htmlProfesionales(P));

    var filas = (P.profesionales || []).slice();
    var html = '<div class="prof-grid">' + filas.map(function (p) { return tarjetaProf(p, false); }).join('') +
      (P.sinAsignar && P.sinAsignar.total ? tarjetaProf(P.sinAsignar, true) : '') + '</div>';
    cont.innerHTML = html;
    Array.prototype.forEach.call(cont.querySelectorAll('[data-profx]'), function (b) {
      b.addEventListener('click', function () {
        var n = b.dataset.profx;
        if (n === 'Sin profesional') { irASolicitudesSinProfesional(); return; }
        if (typeof Profesionales !== 'undefined') Profesionales.abrirStats(n);
      });
    });
  }

  /* El bloque "Sin profesional" no abre un tablero vacío: lleva a la
     lista filtrada, que es lo que hay que resolver. */
  function irASolicitudesSinProfesional() {
    if (typeof Solicitudes === 'undefined') return;
    Solicitudes.filtroProfesional = 'N/A';
    Solicitudes.filtroEstado = 'TODOS';
    Solicitudes.abrir();
  }

  /* ============================================================
     TABLERO DE PACIENTES
     ============================================================ */
  function htmlPacientes(PA) {
    var cifras = '<div class="tab__cifras">' +
      cifra(PA.censo, 'Pacientes registrados', '') +
      cifra(PA.recurrentes, 'Han vuelto más de una vez', '') +
      cifra(PA.conAgenda, 'Con cita en 30 días', PA.conAgenda ? 'ok' : '') +
      cifra(PA.sinCitas, 'Sin ninguna solicitud', PA.sinCitas ? 'alerta' : '') +
      '</div>';

    var bloques = '<div class="tab__bloques">' +
      '<div class="bloque"><p class="bloque__t">Pacientes nuevos por mes</p>' +
      colsMeses(PA.serieNuevos) +
      '<p class="cols__pie">Cada paciente cuenta una sola vez, en el mes de su primera solicitud.</p></div>' +
      '<div class="bloque"><p class="bloque__t">Los que más han venido</p>' +
      barras((PA.top || []).slice(0, 6).map(function (x) {
        return { nombre: x.nombre + ' · ' + x.documento, total: x.total };
      }), { verde: true }) + '</div></div>';

    var nota = '<p class="tab__nota">Promedio de <b>' + PA.promedioCitas + '</b> solicitudes por paciente · ' +
      'el <b>' + PA.pctRecurrentes + ' %</b> de los que tienen solicitud ha vuelto' +
      (PA.sinTelefono ? ' · <b>' + num(PA.sinTelefono) + '</b> sin teléfono registrado' : '') + '.</p>';

    return cifras + bloques + nota;
  }

  function pintarPacientes() {
    var cont = document.getElementById('pac-content');
    if (!cont) return;
    var sub = document.getElementById('pac-subtitle');
    var el = panel('pac-tablero', 'Tablero de pacientes', sub && sub.parentNode ? sub : cont);
    var PA = DATOS.pacientes;
    if (!PA) { esqueleto(el); return; }
    pintar(el, num(PA.censo) + ' en la base', htmlPacientes(PA));
  }

  /* ============================================================
     INICIO — lo que hay que atender, no cuatro cifras sueltas
     ============================================================ */
  function htmlInicio(T) {
    var a = T.agenda || {};
    var cifras = '<div class="tab__cifras">' +
      tocable(a.hoy, 'Citas hoy', a.hoy ? 'ok' : '', 'CITAS') +
      tocable(T.porEstado.PENDIENTE || 0, 'Por gestionar', '', 'PENDIENTE') +
      tocable(a.vencidas, 'Vencidas sin cerrar', a.vencidas ? 'alerta' : '', 'VENCIDAS') +
      tocable(T.sinProfesional, 'Sin profesional', T.sinProfesional ? 'alerta' : '', 'SINPROF') +
      '</div>';
    var hero = '<div class="tab__hero" style="margin-top:12px">' +
      anillo(T.porEstado, T.total, T.total === 1 ? 'solicitud' : 'solicitudes') +
      leyendaEstados(T.porEstado, T.total, true) + '</div>';
    var pie = '<p class="tab__nota">' + textoMes(T) +
      (a.proxima ? ' La próxima cita es el ' + fechaCorta(a.proxima.fecha) + ' (' + esc(a.proxima.paciente) + ').' : '') +
      '</p>';
    return cifras + hero + pie;
  }
  function tocable(v, lbl, tono, ir) {
    return '<button class="cifra cifra--tocable' + (tono ? ' cifra--' + tono : '') + '" data-ir="' + ir + '" type="button">' +
      '<div class="cifra__val">' + num(v) + '</div><div class="cifra__lbl">' + esc(lbl) + '</div></button>';
  }

  function engancharInicio(el) {
    Array.prototype.forEach.call(el.querySelectorAll('[data-ir]'), function (b) {
      b.addEventListener('click', function () {
        if (typeof Solicitudes === 'undefined') return;
        var d = b.dataset.ir;
        Solicitudes.filtroProfesional = (d === 'SINPROF') ? 'N/A' : '';
        Solicitudes.filtroEstado = (d === 'PENDIENTE') ? 'PENDIENTE' : 'TODOS';
        Solicitudes.orden = (d === 'CITAS' || d === 'VENCIDAS') ? 'CITA' : 'RECIENTES';
        Solicitudes.abrir();
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('.leyenda__fila'), function (b) {
      b.addEventListener('click', function () {
        if (typeof Solicitudes === 'undefined') return;
        Solicitudes.filtroEstado = b.dataset.estado;
        Solicitudes.filtroProfesional = '';
        Solicitudes.abrir();
      });
    });
  }

  /* Reemplaza el panel de la Fase 3 (cuatro cifras + tres gráficas
     genéricas) por el resumen accionable. Una sola llamada. */
  window.cargarDashboard = async function () {
    var cont = document.getElementById('dash-content');
    if (!cont) return;
    cont.innerHTML = '';
    var el = panel('ini-tablero', 'Cómo va el consultorio', null, cont);
    el.classList.add('inicio-tab');
    esqueleto(el);
    try {
      var T = null;
      /* Si el usuario ya pasó por Solicitudes, la lista completa está
         en el teléfono: el panel de Inicio sale sin viajar. */
      if (window.IPSTableroLocal && typeof Solicitudes !== 'undefined' &&
          Solicitudes.cargada && Solicitudes.todo && Solicitudes.todo.length) {
        T = window.IPSTableroLocal.agregado(Solicitudes.todo);
      } else {
        var r = await apiGet('getSolicitudes', { estado: 'TODOS', porPagina: 1, tablero: '1' });
        T = r && r.tablero;
      }
      if (!T) throw new Error('El servidor no envió el tablero.');
      DATOS.solicitudes = T;
      pintar(el, num(T.total) + ' solicitudes', htmlInicio(T));
      engancharInicio(el);
    } catch (e) {
      pintar(el, '', '<p class="bloque__vacio">No se pudo cargar el tablero: ' + esc(e.message) +
        '. Desliza hacia abajo para reintentar.</p>');
    }
  };

  /* ============================================================
     ENGANCHES (sin tocar app.js)
     ============================================================ */
  function enganchar() {
    if (typeof Solicitudes !== 'undefined') {
      var render = Solicitudes.render;
      Solicitudes.render = function () {
        var v = render.call(this);
        try {
          /* `contexto` es la lista con TODOS los filtros puestos menos
             el de estado: exactamente el conjunto sobre el que el
             servidor calculaba el tablero, para que no sea un espejo
             de la pastilla que esté pulsada. */
          if (window.IPSTableroLocal && this.cargada)
            DATOS.solicitudes = window.IPSTableroLocal.agregado(this.contexto || this.todo);
          pintarSolicitudes();
        } catch (e) {}
        return v;
      };
    }

    if (typeof Profesionales !== 'undefined') {
      var cargarP = Profesionales.cargar;
      Profesionales.cargar = async function () {
        /* FASE 8: el tablero se pide EN PARALELO con la lista, no
           después. Antes eran dos esperas sumadas. */
        var pendiente = apiGet('getTableroProfesionales').catch(function () { return null; });
        await cargarP.call(this);
        var t = await pendiente;
        if (t) DATOS.profesionales = t;
        this.render();
      };
      /* La tarjeta de profesional se reemplaza entera: la de la Fase 3
         solo decía "Toca para ver estadísticas". */
      Profesionales.render = function () {
        try { pintarProfesionales(); } catch (e) {}
      };
    }

    if (typeof Pacientes !== 'undefined') {
      var abrirPa = Pacientes.abrir;
      Pacientes.abrir = async function () {
        /* FASE 8: igual que en Profesionales — en paralelo. */
        var pendiente = DATOS.pacientes ? null
          : apiGet('getTableroPacientes').catch(function () { return null; });
        var v = await abrirPa.call(this);
        if (pendiente) {
          var t = await pendiente;
          if (t) DATOS.pacientes = t;
          try { pintarPacientes(); } catch (e) {}
        }
        return v;
      };
      var renderPa = Pacientes.render;
      Pacientes.render = function () {
        var v = renderPa.call(this);
        try { pintarPacientes(); } catch (e) {}
        return v;
      };
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enganchar);
  else enganchar();
})();
