/* ============================================================
 * IPS VASCULAR — js/informes.js            (NUEVO · FASE 5)
 * ------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales
 *
 * QUÉ HACE (ajuste 8)
 *   El botón ⬇ de la cabecera de Solicitudes y de Mi trabajo abre
 *   un modal con dos salidas:
 *     · EXCEL (.xlsx) → LOS DATOS. Hoja "Solicitudes" con títulos
 *       fijos, filtro automático y anchos, más una hoja "Resumen"
 *       con las cifras y de qué selección salió el archivo.
 *     · PDF            → EL INFORME. Portada, panorama, estados,
 *       agenda, servicios, profesionales, meses, equipo y un anexo
 *       opcional con el listado.
 *
 * REGLAS
 *   · El modal HEREDA los filtros que estén puestos en pantalla y
 *     los muestra en una frase. Lo que se exporta es exactamente lo
 *     que se está viendo: si no, el archivo miente.
 *   · Todo se DESCARGA. Nada se guarda en Drive ni se manda por
 *     correo.
 *   · La selección de columnas y de secciones se recuerda por
 *     usuario en este navegador.
 *   · ExcelJS se baja del CDN la PRIMERA vez que se exporta a Excel,
 *     no al abrir la app (son ~900 KB). Sin internet en ese momento
 *     se avisa y no se rompe nada más.
 *   · El PDF lo arma el servidor (Informes.gs) con el MISMO cálculo
 *     que pinta los tableros: así el informe y la pantalla no pueden
 *     dar números distintos.
 *
 * INSTALACIÓN (al final del <body>, después de js/mitrabajo.js)
 *   <script src="./js/informes.js"></script>
 * PAREJA
 *   css/informes.css   ·   botones #inf-btn-solicitudes / #inf-btn-mitrabajo
 * ============================================================ */
(function () {
  'use strict';
  if (window.__ipsInformes) return;
  window.__ipsInformes = true;

  var EXCELJS_CDN = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  var AZUL = 'FF084B78', AZUL_SUAVE = 'FFE8F1F7';

  /* Mismo catálogo que COLS_EXPORT en Informes.gs. Si allá cambia,
     aquí también: el servidor manda, esto solo pinta las casillas. */
  var COLS = [
    { k: 'id', t: 'Código', pre: true },
    { k: 'servicio', t: 'Servicio', pre: true },
    { k: 'tratamiento', t: 'Tratamiento', pre: true },
    { k: 'profesional', t: 'Profesional', pre: true },
    { k: 'paciente', t: 'Paciente', pre: true },
    { k: 'documento', t: 'Documento', pre: true },
    { k: 'whatsapp', t: 'WhatsApp', pre: true },
    { k: 'estado', t: 'Estado', pre: true },
    { k: 'fechaTexto', t: 'Fecha de la cita', pre: true },
    { k: 'bitacora', t: 'Bitácora', pre: false },
    { k: 'respuesta', t: 'Respuesta', pre: false },
    { k: 'origen', t: 'Origen', pre: true },
    { k: 'creadoPor', t: 'Creado por', pre: false },
    { k: 'fechaCreacion', t: 'Fecha de creación', pre: false },
    { k: 'asignadoPor', t: 'Asignado por', pre: false },
    { k: 'fechaAsignacion', t: 'Fecha de asignación', pre: false },
    { k: 'actualizadoPor', t: 'Última persona que la movió', pre: false },
    { k: 'fechaActualizacion', t: 'Fecha del último cambio', pre: false }
  ];

  var SECCIONES = [
    { k: 'resumen', t: 'Panorama', d: 'Las ocho cifras de cabecera.', pre: true },
    { k: 'estados', t: 'Reparto por estado', d: 'Barras y porcentaje de cada estado.', pre: true },
    { k: 'agenda', t: 'Agenda', d: 'Hoy, 7 días, 30 días y vencidas.', pre: true },
    { k: 'servicios', t: 'Servicios más solicitados', d: 'Los ocho primeros.', pre: true },
    { k: 'profesionales', t: 'Carga por profesional', d: 'Total, abiertas, realizadas y participación.', pre: true },
    { k: 'meses', t: 'Solicitudes por mes', d: 'Ventana de doce meses.', pre: true },
    { k: 'equipo', t: 'Trabajo por persona', d: 'Cuántas ha tomado cada quien.', pre: true },
    { k: 'anexo', t: 'Anexo con el listado', d: 'Hasta 400 filas. Engorda bastante el archivo.', pre: false }
  ];

  var E = { formato: 'xlsx', cols: {}, sec: {}, origen: 'solicitudes', ocupado: false };

  function q(s, c) { return (c || document).querySelector(s); }
  function qq(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function uid() { try { return (state && state.user && state.user.id) || ''; } catch (e) { return ''; } }
  function recordar(clave, lista) {
    try { localStorage.setItem('ipsInf_' + uid() + '_' + clave, JSON.stringify(lista)); } catch (e) {}
  }
  function recordado(clave) {
    try {
      var v = localStorage.getItem('ipsInf_' + uid() + '_' + clave);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------
     Los filtros de pantalla. Se leen del objeto Solicitudes, que es
     la única fuente de verdad de lo que se está viendo.
     ------------------------------------------------------------ */
  function filtrosActuales() {
    var o = { estado: 'TODOS', q: '', profesional: '', origen: '', orden: 'RECIENTES' };
    try {
      if (typeof Solicitudes !== 'undefined' && Solicitudes) {
        o.estado = Solicitudes.filtroEstado || 'TODOS';
        o.q = Solicitudes.filtroTexto || '';
        o.profesional = Solicitudes.filtroProfesional || '';
        o.origen = Solicitudes.filtroOrigen || '';
        o.orden = Solicitudes.orden || 'RECIENTES';
        if (Solicitudes.filtroMias) o.mias = '1';
      }
    } catch (e) {}
    /* Desde Mi trabajo siempre se exporta lo propio, esté como esté
       la vista de Solicitudes. */
    if (E.origen === 'mitrabajo') {
      o.mias = '1'; o.estado = 'TODOS'; o.profesional = ''; o.origen = ''; o.q = '';
    }
    return o;
  }

  function fraseFiltros(f) {
    var t = [];
    t.push('Estado: ' + (f.estado === 'TODOS' ? 'todos' : f.estado.charAt(0) + f.estado.slice(1).toLowerCase()));
    if (f.profesional) t.push('Profesional: ' + (f.profesional === 'N/A' ? 'sin profesional' : f.profesional));
    if (f.origen) t.push('Origen: ' + (f.origen === 'BOT' ? 'WhatsApp' : f.origen.charAt(0) + f.origen.slice(1).toLowerCase()));
    if (f.q) t.push('Búsqueda: "' + f.q + '"');
    if (f.mias) t.push('Solo lo mío');
    return t.join(' · ');
  }

  /* ------------------------------------------------------------
     MODAL
     ------------------------------------------------------------ */
  function montar() {
    if (document.getElementById('inf-modal')) return;
    var d = document.createElement('div');
    d.id = 'inf-modal';
    d.className = 'inf-modal hidden';
    d.innerHTML =
      '<div class="inf-modal__fondo" data-cerrar="1"></div>' +
      '<div class="inf-modal__caja" role="dialog" aria-modal="true" aria-labelledby="inf-titulo">' +
        '<header class="inf-modal__cab">' +
          '<h3 id="inf-titulo">Generar informe</h3>' +
          '<button class="inf-modal__x" data-cerrar="1" aria-label="Cerrar">&times;</button>' +
        '</header>' +
        '<div class="inf-modal__cuerpo">' +
          '<p class="inf-filtros" id="inf-filtros"></p>' +
          '<div class="inf-formatos" id="inf-formatos"></div>' +
          '<div id="inf-opciones"></div>' +
        '</div>' +
        '<footer class="inf-modal__pie">' +
          '<span class="inf-resumen" id="inf-resumen"></span>' +
          '<button class="btn btn-ghost" data-cerrar="1">Cancelar</button>' +
          '<button class="btn btn-primary" id="inf-generar">Generar</button>' +
        '</footer>' +
      '</div>';
    document.body.appendChild(d);
    qq('[data-cerrar]', d).forEach(function (b) { b.addEventListener('click', cerrar); });
    q('#inf-generar', d).addEventListener('click', generar);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !d.classList.contains('hidden')) cerrar();
    });
  }

  function abrir(origen) {
    E.origen = origen || 'solicitudes';
    E.ocupado = false;
    montar();

    var colsGuardadas = recordado('cols');
    E.cols = {};
    COLS.forEach(function (c) {
      E.cols[c.k] = colsGuardadas ? colsGuardadas.indexOf(c.k) >= 0 : c.pre;
    });
    var secGuardadas = recordado('sec');
    E.sec = {};
    SECCIONES.forEach(function (s) {
      E.sec[s.k] = secGuardadas ? secGuardadas.indexOf(s.k) >= 0 : s.pre;
    });

    E.formato = 'xlsx';
    q('#inf-titulo').textContent = (E.origen === 'mitrabajo') ? 'Informe de mi trabajo' : 'Generar informe';
    q('#inf-filtros').innerHTML = 'Se exporta lo que estás viendo: <b>' +
      esc(fraseFiltros(filtrosActuales())) + '</b>';
    pintarFormatos();
    pintarOpciones();
    document.getElementById('inf-modal').classList.remove('hidden');
    document.body.classList.add('inf-abierto');
  }

  function cerrar() {
    if (E.ocupado) return;
    var m = document.getElementById('inf-modal');
    if (m) m.classList.add('hidden');
    document.body.classList.remove('inf-abierto');
  }

  function pintarFormatos() {
    var cont = q('#inf-formatos');
    cont.innerHTML =
      tarjetaFormato('xlsx', 'Excel', 'Los datos, fila por fila, con una hoja de resumen. Para filtrar, sumar o cruzar.') +
      tarjetaFormato('pdf', 'PDF', 'Un informe listo para imprimir o mandar: cifras, barras y tablas.');
    qq('.inf-fmt', cont).forEach(function (b) {
      b.addEventListener('click', function () {
        E.formato = b.dataset.fmt;
        pintarFormatos(); pintarOpciones();
      });
    });
  }
  function tarjetaFormato(k, titulo, desc) {
    return '<button class="inf-fmt' + (E.formato === k ? ' is-active' : '') + '" data-fmt="' + k + '">' +
      '<span class="inf-fmt__t">' + esc(titulo) + '</span>' +
      '<span class="inf-fmt__d">' + esc(desc) + '</span></button>';
  }

  function pintarOpciones() {
    var cont = q('#inf-opciones');
    if (E.formato === 'xlsx') {
      cont.innerHTML = '<h4 class="inf-sub">Columnas del Excel</h4>' +
        '<div class="inf-checks">' + COLS.map(function (c) {
          return '<label class="inf-check"><input type="checkbox" data-col="' + c.k + '"' +
            (E.cols[c.k] ? ' checked' : '') + '><span>' + esc(c.t) + '</span></label>';
        }).join('') + '</div>' +
        '<div class="inf-atajos"><button type="button" data-todas="1">Todas</button>' +
        '<button type="button" data-ninguna="1">Ninguna</button></div>';
      qq('[data-col]', cont).forEach(function (i) {
        i.addEventListener('change', function () { E.cols[i.dataset.col] = i.checked; pintarResumen(); });
      });
      q('[data-todas]', cont).addEventListener('click', function () {
        COLS.forEach(function (c) { E.cols[c.k] = true; }); pintarOpciones();
      });
      q('[data-ninguna]', cont).addEventListener('click', function () {
        COLS.forEach(function (c) { E.cols[c.k] = false; }); pintarOpciones();
      });
    } else {
      cont.innerHTML = '<h4 class="inf-sub">Secciones del informe</h4>' +
        '<div class="inf-secs">' + SECCIONES.map(function (s) {
          return '<label class="inf-check inf-check--ancho"><input type="checkbox" data-sec="' + s.k + '"' +
            (E.sec[s.k] ? ' checked' : '') + '><span><b>' + esc(s.t) + '</b>' +
            '<small>' + esc(s.d) + '</small></span></label>';
        }).join('') + '</div>';
      qq('[data-sec]', cont).forEach(function (i) {
        i.addEventListener('change', function () { E.sec[i.dataset.sec] = i.checked; pintarResumen(); });
      });
    }
    pintarResumen();
  }

  function elegidas(mapa, catalogo) {
    return catalogo.filter(function (c) { return mapa[c.k]; }).map(function (c) { return c.k; });
  }

  function pintarResumen() {
    var el = q('#inf-resumen');
    if (!el) return;
    if (E.formato === 'xlsx') {
      var n = elegidas(E.cols, COLS).length;
      el.textContent = n + (n === 1 ? ' columna' : ' columnas') + ' · Excel';
      q('#inf-generar').disabled = (n === 0);
    } else {
      var s = elegidas(E.sec, SECCIONES).length;
      el.textContent = s + (s === 1 ? ' sección' : ' secciones') + ' · PDF';
      q('#inf-generar').disabled = (s === 0);
    }
  }

  /* ------------------------------------------------------------
     GENERAR
     ------------------------------------------------------------ */
  async function generar() {
    if (E.ocupado) return;
    var btn = q('#inf-generar');
    E.ocupado = true;
    btn.disabled = true;
    var textoPrevio = btn.textContent;
    btn.textContent = 'Preparando…';
    try {
      if (E.formato === 'xlsx') await excel();
      else await pdf();
      cerrar();
    } catch (e) {
      if (typeof alertErr === 'function') alertErr('No se pudo generar', esc(e.message));
      else alert('No se pudo generar: ' + e.message);
    } finally {
      E.ocupado = false;
      btn.disabled = false;
      btn.textContent = textoPrevio;
    }
  }

  function bajar(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function cargarExcelJS() {
    if (window.ExcelJS) return Promise.resolve();
    return new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = EXCELJS_CDN;
      s.onload = function () { window.ExcelJS ? ok() : mal(new Error('La librería no cargó bien.')); };
      s.onerror = function () {
        mal(new Error('No se pudo bajar la librería del Excel. Revisa la conexión e inténtalo otra vez; el PDF sí funciona sin ella.'));
      };
      document.head.appendChild(s);
    });
  }

  function nombreArchivo(ext) {
    var d = new Date();
    var p2 = function (n) { return String(n).padStart(2, '0'); };
    return 'IPS_Vascular_' + d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) +
      '_' + p2(d.getHours()) + p2(d.getMinutes()) + '.' + ext;
  }

  async function excel() {
    var f = filtrosActuales();
    var cols = elegidas(E.cols, COLS);
    /* Se piden los datos ANTES de bajar la librería: si el servidor
       responde vacío, no tiene sentido bajar 900 KB. */
    var d = await apiPost('exportarDatos', Object.assign({}, f, { cols: cols.join(',') }));
    if (!d.filas.length) throw new Error('No hay ninguna solicitud con esta selección.');
    recordar('cols', cols);

    await cargarExcelJS();

    var wb = new window.ExcelJS.Workbook();
    wb.creator = 'IPS Vascular';
    wb.created = new Date();

    /* ---- Hoja de datos ---- */
    var hoja = wb.addWorksheet('Solicitudes', { views: [{ state: 'frozen', ySplit: 1 }] });
    hoja.addRow(d.titulos);
    var cab = hoja.getRow(1);
    cab.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    cab.alignment = { vertical: 'middle' };
    cab.height = 20;
    d.filas.forEach(function (r) { hoja.addRow(r); });
    d.anchos.forEach(function (w, i) { hoja.getColumn(i + 1).width = w; });
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: d.titulos.length } };
    /* Bandas suaves: con 1.500 filas, seguir una línea sin esto es
       imposible en pantalla. */
    for (var i = 2; i <= d.filas.length + 1; i++) {
      if (i % 2 === 0) {
        hoja.getRow(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_SUAVE } };
      }
      hoja.getRow(i).font = { size: 10 };
    }

    /* ---- Hoja de resumen ---- */
    var R = d.resumen;
    var res = wb.addWorksheet('Resumen');
    res.getColumn(1).width = 34; res.getColumn(2).width = 18;
    function t(txt) {
      var r = res.addRow([txt, '']);
      r.font = { bold: true, size: 11, color: { argb: AZUL } };
      return r;
    }
    function l(a, b) { res.addRow([a, b]).font = { size: 10 }; }

    t('IPS VASCULAR · Resumen de la exportación');
    l('Generado', d.generado);
    l('Por', d.porUsuario);
    l('Selección', d.filtros);
    l('Filas exportadas', d.filas.length);
    if (d.recortado) l('AVISO', 'Se cortó en ' + d.tope + ' filas de ' + d.total);
    res.addRow([]);

    t('Cifras');
    l('Solicitudes en el contexto', R.total);
    l('Abiertas', R.abiertas);
    l('Cerradas', R.cerradas);
    l('Confirmadas', R.confirmadas);
    l('Efectividad (%)', R.pctEfectivas);
    l('Pérdida (%)', R.pctPerdidas);
    res.addRow([]);

    t('Por estado');
    Object.keys(R.porEstado).forEach(function (k) { l(k, R.porEstado[k]); });
    res.addRow([]);

    t('Por origen');
    l('Desde la aplicación', R.porOrigen.APP || 0);
    l('Desde WhatsApp', R.porOrigen.BOT || 0);
    l('Histórico sin dueño', R.porOrigen.HISTORICO || 0);
    res.addRow([]);

    t('Agenda');
    l('Citas hoy', R.agenda.hoy);
    l('Próximos 7 días', R.agenda.semana);
    l('Próximos 30 días', R.agenda.mes);
    l('Vencidas y abiertas', R.agenda.vencidas);
    res.addRow([]);

    t('Datos que faltan');
    l('Sin profesional', R.sinProfesional);
    l('Sin fecha de cita', R.sinFecha);
    l('Sin tratamiento', R.sinTratamiento);
    l('Sin WhatsApp', R.sinWhatsapp);
    res.addRow([]);

    t('Servicios más solicitados');
    (R.topServicios || []).forEach(function (x) { l(x.nombre, x.total); });
    res.addRow([]);

    t('Carga por profesional');
    (R.profesionales || []).forEach(function (x) {
      l(x.nombre === 'N/A' ? 'Sin profesional' : x.nombre, x.total);
    });

    var buf = await wb.xlsx.writeBuffer();
    bajar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      nombreArchivo('xlsx'));

    if (d.recortado && typeof alertWarn === 'function') {
      alertWarn('Se exportaron ' + d.tope + ' filas',
        'La selección tiene ' + d.total + '. Afina los filtros si necesitas el resto.');
    }
  }

  async function pdf() {
    var f = filtrosActuales();
    var sec = elegidas(E.sec, SECCIONES);
    var d = await apiPost('exportarInforme', Object.assign({}, f, { secciones: sec.join(',') }));
    recordar('sec', sec);

    /* base64 → bytes. En trozos: con un anexo grande, un solo
       String.fromCharCode.apply revienta la pila del navegador. */
    var bin = atob(d.pdf);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    bajar(new Blob([bytes], { type: 'application/pdf' }), d.nombre || nombreArchivo('pdf'));

    if (d.anexoRecortado && typeof alertWarn === 'function') {
      alertWarn('El anexo trae ' + d.anexoTope + ' filas',
        'La selección tiene ' + d.total + '. Para el listado completo usa la exportación a Excel.');
    }
  }

  /* ------------------------------------------------------------
     BOTONES
     ------------------------------------------------------------ */
  function engancharBotones() {
    [['inf-btn-solicitudes', 'solicitudes'], ['inf-btn-mitrabajo', 'mitrabajo']].forEach(function (par) {
      var b = document.getElementById(par[0]);
      if (!b || b.getAttribute('data-inf')) return;
      b.setAttribute('data-inf', '1');
      b.addEventListener('click', function () {
        try { snd(SONIDOS.click); } catch (e) {}
        abrir(par[1]);
      });
    });
  }

  window.Informes = { abrir: abrir, cerrar: cerrar };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', engancharBotones);
  else engancharBotones();
  setTimeout(engancharBotones, 600);
})();
