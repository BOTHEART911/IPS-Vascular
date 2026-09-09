/* ============================================================
 * IPS VASCULAR — js/tablero-local.js          (NUEVO · 09/09/2026)
 * ------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales
 * ------------------------------------------------------------
 * QUÉ HACE
 *   Calcula en el teléfono el mismo tablero que antes calculaba el
 *   servidor dentro de getSolicitudes (Tablero.gs · agregadoSolicitudes_).
 *
 * POR QUÉ
 *   Con la carga única, los filtros de la vista viven en el teléfono:
 *   el servidor ya no sabe qué está viendo el usuario, así que no
 *   puede calcular un tablero que obedezca los filtros sin que cada
 *   pastilla vuelva a ser un viaje. Esto es EXACTAMENTE la misma
 *   cuenta, hecha sobre la lista que ya está en memoria.
 *
 * LA ZONA HORARIA VA FIJA (-05:00), NO LA DEL TELÉFONO
 *   El servidor usa Session.getScriptTimeZone() = America/Bogotá.
 *   Si aquí usáramos la hora del aparato, un teléfono configurado en
 *   otra zona movería el "hoy", las citas vencidas y la hora pico, y
 *   la pantalla dejaría de coincidir con el PDF (que sí lo calcula en
 *   el servidor). Colombia no cambia la hora en todo el año, así que
 *   el desfase fijo es exacto.
 *
 * PRUEBA
 *   El banco compara campo a campo esta salida contra la del servidor
 *   sobre las 1.571 solicitudes reales y varias combinaciones de
 *   filtros. Si no son idénticas, la prueba se pone roja.
 *
 * INSTALACIÓN (antes de js/tableros.js)
 *   <script src="./js/tablero-local.js"></script>
 * ============================================================ */
(function () {
  'use strict';

  var TZ_MIN = -5 * 60;                 // America/Bogotá, sin horario de verano
  var ESTADOS_T = ['PENDIENTE', 'ASIGNADA', 'CONFIRMADA', 'REALIZADA', 'DESCARTADA', 'CANCELADA'];
  var ABIERTOS = ['PENDIENTE', 'ASIGNADA'];
  var MESES_ORDEN = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var ORDEN_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  function p2(n) { return ('0' + n).slice(-2); }
  /* Un Date llevado a la hora del consultorio, para leerle el día y
     la hora con los métodos UTC (que no dependen del aparato). */
  function enZona(d) { return new Date(d.getTime() + TZ_MIN * 60000); }
  function diaTexto(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var z = enZona(d);
    return z.getUTCFullYear() + '-' + p2(z.getUTCMonth() + 1) + '-' + p2(z.getUTCDate());
  }
  function horaTexto(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return p2(enZona(d).getUTCHours());
  }
  function hoyTexto() {
    var z = enZona(new Date());
    return z.getUTCFullYear() + '-' + p2(z.getUTCMonth() + 1) + '-' + p2(z.getUTCDate());
  }
  /* Suma días sobre un 'aaaa-mm-dd' en calendario, sin husos de por
     medio (igual que sumarDias_ del servidor). */
  function sumarDias(ymd, n) {
    var p = String(ymd).split('-');
    var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
    d.setUTCDate(d.getUTCDate() + n);
    return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
  }
  /* La columna DIA de la hoja viene como "06 Jueves": el nombre del
     día ya está ahí calculado. */
  function diaSemana(s) {
    var p = String(s.dia || '').trim().split(/\s+/);
    return p.length > 1 ? p.slice(1).join(' ') : '';
  }
  function vacio(v) {
    var t = String(v == null ? '' : v).trim().toUpperCase();
    return !t || t === 'N/A' || t === '—' || t === '-';
  }
  function ordenarConteo(obj, tope) {
    var out = Object.keys(obj).map(function (k) { return { nombre: k, total: obj[k] }; })
      .sort(function (a, b) { return (b.total - a.total) || String(a.nombre).localeCompare(String(b.nombre)); });
    return tope ? out.slice(0, tope) : out;
  }
  function pct(a, t) { return t ? Math.round(a * 1000 / t) / 10 : 0; }

  /* Ventana de doce meses: año actual (Enero → mes actual) y luego
     el anterior. Idéntica a serieMesVentana_ del servidor. */
  function serieMesVentana(sols) {
    var z = enZona(new Date());
    var anioActual = z.getUTCFullYear();
    var mesActual = z.getUTCMonth() + 1;
    var cuenta = {};
    sols.forEach(function (s) {
      var a = Number(s.anio) || 0;
      var mi = MESES_ORDEN.indexOf(String(s.mes));
      if (a && mi >= 0) { var k = a + '|' + mi; cuenta[k] = (cuenta[k] || 0) + 1; }
    });
    var serie = [];
    for (var mi = 0; mi < mesActual; mi++)
      serie.push({ mes: MESES_ORDEN[mi], anio: anioActual, total: cuenta[anioActual + '|' + mi] || 0 });
    for (var mj = mesActual; mj < 12; mj++)
      serie.push({ mes: MESES_ORDEN[mj], anio: anioActual - 1, total: cuenta[(anioActual - 1) + '|' + mj] || 0 });
    return serie.filter(function (x) { return x.total > 0; });
  }

  function agregado(arr) {
    arr = arr || [];
    var hoy = hoyTexto();
    var tope7 = sumarDias(hoy, 7);
    var tope30 = sumarDias(hoy, 30);

    var porEstado = {}; ESTADOS_T.forEach(function (e) { porEstado[e] = 0; });
    var porOrigen = { APP: 0, BOT: 0, HISTORICO: 0 };
    var porServicio = {}, porTratamiento = {}, porProf = {}, porHora = {}, porDiaSem = {};
    var porPaciente = {};
    var sinProfesional = 0, sinFecha = 0, sinTratamiento = 0, sinWhatsapp = 0;
    var hoyN = 0, semanaN = 0, mes30 = 0, vencidas = 0, futuras = 0;
    var masVieja = null, proxima = null;

    arr.forEach(function (s) {
      var est = String(s.estado || '').toUpperCase();
      porEstado[est] = (porEstado[est] || 0) + 1;
      porOrigen[s.origen] = (porOrigen[s.origen] || 0) + 1;

      var serv = vacio(s.servicio) ? 'Sin servicio' : String(s.servicio);
      porServicio[serv] = (porServicio[serv] || 0) + 1;

      if (vacio(s.tratamiento)) sinTratamiento++;
      else porTratamiento[String(s.tratamiento)] = (porTratamiento[String(s.tratamiento)] || 0) + 1;

      var prof = vacio(s.profesional) ? 'Sin profesional' : String(s.profesional);
      if (prof === 'Sin profesional') sinProfesional++;
      if (!porProf[prof]) {
        porProf[prof] = { nombre: prof, total: 0, porEstado: {}, proximas: 0 };
        ESTADOS_T.forEach(function (e) { porProf[prof].porEstado[e] = 0; });
      }
      porProf[prof].total++;
      porProf[prof].porEstado[est] = (porProf[prof].porEstado[est] || 0) + 1;

      if (vacio(s.whatsapp)) sinWhatsapp++;

      var doc = String(s.documento || '');
      if (doc) {
        if (!porPaciente[doc]) porPaciente[doc] = { documento: doc, nombre: String(s.paciente || ''), total: 0 };
        porPaciente[doc].total++;
      }

      var d = diaTexto(s.fechaHora);
      if (!d) { sinFecha++; return; }

      var h = horaTexto(s.fechaHora);
      if (h) porHora[h] = (porHora[h] || 0) + 1;
      var ds = diaSemana(s);
      if (ds) porDiaSem[ds] = (porDiaSem[ds] || 0) + 1;

      if (d === hoy) hoyN++;
      if (d > hoy) {
        futuras++;
        if (d <= tope7) semanaN++;
        if (d <= tope30) mes30++;
        if (ABIERTOS.indexOf(est) >= 0) porProf[prof].proximas++;
        if (!proxima || d < proxima.fecha) proxima = { fecha: d, id: s.id, paciente: s.paciente, profesional: prof };
      }
      if (d < hoy && ABIERTOS.indexOf(est) >= 0) {
        vencidas++;
        if (!masVieja || d < masVieja.fecha) masVieja = { fecha: d, id: s.id, paciente: s.paciente, estado: est };
      }
    });

    var total = arr.length;
    var abiertas = ABIERTOS.reduce(function (a, e) { return a + (porEstado[e] || 0); }, 0);
    var cerradas = ['REALIZADA', 'DESCARTADA', 'CANCELADA'].reduce(function (a, e) { return a + (porEstado[e] || 0); }, 0);
    var confirmadas = porEstado.CONFIRMADA || 0;
    var gestionadas = total - (porEstado.PENDIENTE || 0);
    var efectivas = confirmadas + (porEstado.REALIZADA || 0);
    var perdidas = (porEstado.CANCELADA || 0) + (porEstado.DESCARTADA || 0);

    var serieMes = serieMesVentana(arr);
    var crono = serieMes.slice().sort(function (a, b) {
      return (a.anio - b.anio) || (MESES_ORDEN.indexOf(a.mes) - MESES_ORDEN.indexOf(b.mes));
    });
    var mejorMes = null;
    serieMes.forEach(function (x) { if (!mejorMes || x.total > mejorMes.total) mejorMes = x; });
    var ultimoMes = crono.length ? crono[crono.length - 1] : null;
    var anteriorMes = crono.length > 1 ? crono[crono.length - 2] : null;

    var horas = Object.keys(porHora).sort().map(function (h) { return { hora: h, total: porHora[h] }; });
    var horaPico = null;
    horas.forEach(function (x) { if (!horaPico || x.total > horaPico.total) horaPico = x; });

    var dias = ORDEN_DIAS.filter(function (d) { return porDiaSem[d]; })
      .map(function (d) { return { dia: d, total: porDiaSem[d] }; });
    var diaPico = null;
    dias.forEach(function (x) { if (!diaPico || x.total > diaPico.total) diaPico = x; });

    var profesionales = Object.keys(porProf).map(function (k) { return porProf[k]; })
      .sort(function (a, b) { return (b.total - a.total) || String(a.nombre).localeCompare(String(b.nombre)); });

    var topPacientes = Object.keys(porPaciente).map(function (k) { return porPaciente[k]; })
      .sort(function (a, b) { return (b.total - a.total) || String(a.nombre).localeCompare(String(b.nombre)); })
      .slice(0, 10);
    var recurrentes = Object.keys(porPaciente).filter(function (k) { return porPaciente[k].total > 1; }).length;

    return {
      total: total,
      porEstado: porEstado,
      porOrigen: porOrigen,
      abiertas: abiertas,
      cerradas: cerradas,
      confirmadas: confirmadas,
      gestionadas: gestionadas,
      efectivas: efectivas,
      perdidas: perdidas,
      pctAbiertas: pct(abiertas, total),
      pctEfectivas: pct(efectivas, gestionadas),
      pctPerdidas: pct(perdidas, gestionadas),
      sinProfesional: sinProfesional,
      sinFecha: sinFecha,
      sinTratamiento: sinTratamiento,
      sinWhatsapp: sinWhatsapp,
      agenda: { hoy: hoyN, semana: semanaN, mes: mes30, futuras: futuras, vencidas: vencidas,
                masVieja: masVieja, proxima: proxima },
      serieMes: serieMes,
      mejorMes: mejorMes,
      ultimoMes: ultimoMes,
      anteriorMes: anteriorMes,
      topServicios: ordenarConteo(porServicio, 8),
      serviciosTotal: Object.keys(porServicio).length,
      topTratamientos: ordenarConteo(porTratamiento, 6),
      profesionales: profesionales,
      horas: horas,
      horaPico: horaPico,
      dias: dias,
      diaPico: diaPico,
      topPacientes: topPacientes,
      pacientesUnicos: Object.keys(porPaciente).length,
      recurrentes: recurrentes,
      calculado: 'en este dispositivo'
    };
  }

  window.IPSTableroLocal = {
    agregado: agregado,
    diaTexto: diaTexto, horaTexto: horaTexto, hoyTexto: hoyTexto, sumarDias: sumarDias
  };
})();
