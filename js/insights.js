/* ============================================================
 * IPS VASCULAR — js/insights.js            (NUEVO · FASE 4)
 * ------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales
 * ------------------------------------------------------------
 * QUÉ HACE (ajuste 5)
 *   Botón flotante en Solicitudes y Profesionales. Abre un panel
 *   SIN campo de texto: abajo hay botones fijos y cada uno
 *   responde con un informe escrito, con efecto de tecleo, botón
 *   Copiar y envío por WhatsApp. Nada se lanza solo.
 *
 * DE DÓNDE SALEN LOS NÚMEROS
 *   NO hay ninguna IA y no viaja un solo dato a terceros. Cada
 *   informe se redacta aquí con las MISMAS cifras que pintó el
 *   tablero de la vista (window.IPSDatos, que llena
 *   js/tableros.js). Por eso salen al instante y siempre cuadran
 *   con lo que se está viendo, filtros incluidos.
 *
 * INSTALACIÓN (al final del <body>, después de js/tableros.js)
 *   <script src="./js/insights.js"></script>
 * PAREJA
 *   css/insights.css
 * ============================================================ */
(function () {
  'use strict';
  if (window.__ipsInsights) return;
  window.__ipsInsights = true;

  var ROBOT = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="11" rx="3.5"/><path d="M12 8V4.5"/><circle cx="12" cy="3.2" r="1.3"/><path d="M1.8 12.5v3M22.2 12.5v3"/><circle cx="9" cy="13" r="1.15" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1.15" fill="currentColor" stroke="none"/><path d="M9.5 16.3h5"/></svg>';
  var EQUIS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var ESTADOS_ORD = ['PENDIENTE', 'ASIGNADA', 'CONFIRMADA', 'REALIZADA', 'DESCARTADA', 'CANCELADA'];
  var vista = '', fab = null, hoja = null, velo = null, cuerpo = null, botonera = null, abierta = false;

  /* ---------------- utilidades ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v) {
    var x = Number(v || 0);
    try { return x.toLocaleString('es-CO'); } catch (e) { return String(x); }
  }
  function b(v) { return '**' + num(v) + '**'; }
  function pc(a, t) { return t ? Math.round(a * 100 / t) : 0; }
  function bp(a, t) { return '**' + pc(a, t) + ' %**'; }
  function bonito(e) { return String(e).charAt(0) + String(e).slice(1).toLowerCase(); }
  function plural(n, uno, varios) { return Number(n) === 1 ? uno : varios; }
  function fecha(d) {
    if (!d) return 'sin fecha';
    var p = String(d).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(d);
  }
  function nodo(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  }
  function reducido() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function T() { return window.IPSDatos && window.IPSDatos.solicitudes; }
  function P() { return window.IPSDatos && window.IPSDatos.profesionales; }

  /* ============================================================
     INFORMES DE SOLICITUDES
     ============================================================ */
  function ctx(t) {
    var f = (typeof Solicitudes !== 'undefined' && Solicitudes.hayFiltros && Solicitudes.hayFiltros());
    return f ? 'Sobre las solicitudes que tienes filtradas ahora.\n\n' + t : t;
  }

  var INFORMES_SOL = [
    { id: 'resumen', txt: 'Resumen', fn: function (t) {
      var a = t.agenda || {};
      return ctx('Hay ' + b(t.total) + ' ' + plural(t.total, 'solicitud', 'solicitudes') + ' en total.\n' +
        '• Sin cerrar: ' + b(t.abiertas) + ' (' + bp(t.abiertas, t.total) + ')\n' +
        '• Confirmadas: ' + b(t.porEstado.CONFIRMADA || 0) + '  ·  Realizadas: ' + b(t.porEstado.REALIZADA || 0) + '\n' +
        '• Efectividad sobre lo ya gestionado: **' + t.pctEfectivas + ' %**\n' +
        '• Hoy hay ' + b(a.hoy) + ' ' + plural(a.hoy, 'cita', 'citas') + ' y ' + b(a.semana) + ' en los próximos 7 días.\n' +
        (a.vencidas ? '• Atención: ' + b(a.vencidas) + ' con fecha pasada siguen sin cerrarse.\n' : '') +
        (t.sinProfesional ? '• ' + b(t.sinProfesional) + ' todavía no tienen profesional.\n' : '') +
        (t.mejorMes ? '\nEl mejor mes fue ' + t.mejorMes.mes + ' ' + t.mejorMes.anio + ' con ' + b(t.mejorMes.total) + '.' : ''));
    } },

    { id: 'estados', txt: 'Estado por estado', fn: function (t) {
      var l = ESTADOS_ORD.map(function (e) {
        var v = t.porEstado[e] || 0;
        return '• ' + bonito(e) + ': ' + b(v) + ' (' + bp(v, t.total) + ')';
      }).join('\n');
      return ctx('Así se reparten las ' + b(t.total) + ':\n' + l +
        '\n\nSin cerrar (pendientes + asignadas): ' + b(t.abiertas) + '.\n' +
        'Cerradas (realizadas, descartadas y canceladas): ' + b(t.cerradas) + '.');
    } },

    { id: 'urgente', txt: 'Qué es urgente', fn: function (t) {
      var a = t.agenda || {};
      var sinProf = (t.profesionales || []).filter(function (p) { return p.nombre === 'Sin profesional'; })[0];
      var l = [];
      if (a.vencidas) l.push('• ' + b(a.vencidas) + ' con fecha ya pasada y todavía sin cerrar' +
        (a.masVieja ? ', la más vieja es **' + a.masVieja.id + '** del ' + fecha(a.masVieja.fecha) : ''));
      if (t.sinProfesional) l.push('• ' + b(t.sinProfesional) + ' sin profesional asignado' +
        (sinProf && sinProf.proximas ? ', y ' + b(sinProf.proximas) + ' de ellas ya tienen fecha encima' : ''));
      if (t.porEstado.PENDIENTE) l.push('• ' + b(t.porEstado.PENDIENTE) + ' en pendiente esperando gestión');
      if (t.sinFecha) l.push('• ' + b(t.sinFecha) + ' sin fecha de cita todavía');
      if (a.hoy) l.push('• ' + b(a.hoy) + ' ' + plural(a.hoy, 'cita es', 'citas son') + ' hoy mismo');
      if (!l.length) return ctx('No hay nada atrasado: ni citas vencidas, ni solicitudes sin profesional, ni pendientes acumuladas.');
      return ctx('Lo que pide atención primero:\n' + l.join('\n'));
    } },

    { id: 'agenda', txt: 'Agenda', fn: function (t) {
      var a = t.agenda || {};
      return ctx('Cómo está la agenda:\n' +
        '• Hoy: ' + b(a.hoy) + '\n' +
        '• Próximos 7 días: ' + b(a.semana) + '\n' +
        '• Próximos 30 días: ' + b(a.mes) + '\n' +
        '• Todas las futuras: ' + b(a.futuras) + '\n' +
        '• Con fecha pasada y sin cerrar: ' + b(a.vencidas) + '\n' +
        '• Todavía sin fecha: ' + b(t.sinFecha) + ' (' + bp(t.sinFecha, t.total) + ' del total)\n' +
        (a.proxima ? '\nLa próxima cita es el ' + fecha(a.proxima.fecha) + ': ' + a.proxima.paciente +
          ' con ' + a.proxima.profesional + '.' : ''));
    } },

    { id: 'servicios', txt: 'Servicios', fn: function (t) {
      var top = t.topServicios || [];
      if (!top.length) return ctx('Todavía no hay servicios registrados.');
      var l = top.map(function (x, i) {
        return '• ' + (i + 1) + '. ' + x.nombre + ': ' + b(x.total) + ' (' + bp(x.total, t.total) + ')';
      }).join('\n');
      var suma = top.reduce(function (s, x) { return s + x.total; }, 0);
      return ctx('Se prestan **' + t.serviciosTotal + '** servicios distintos. Los más pedidos:\n' + l +
        '\n\nEstos ' + top.length + ' concentran ' + bp(suma, t.total) + ' de todo.');
    } },

    { id: 'tratamientos', txt: 'Tratamientos', fn: function (t) {
      var top = t.topTratamientos || [];
      if (!top.length) return ctx('Ninguna de estas solicitudes tiene tratamiento anotado.');
      return ctx('Tratamientos más frecuentes:\n' + top.map(function (x) {
        return '• ' + x.nombre + ': ' + b(x.total);
      }).join('\n') + '\n\n' + b(t.sinTratamiento) + ' solicitudes (' + bp(t.sinTratamiento, t.total) +
        ') no tienen tratamiento anotado.');
    } },

    { id: 'profesionales', txt: 'Reparto entre doctores', fn: function (t) {
      var ps = (t.profesionales || []);
      if (!ps.length) return ctx('No hay solicitudes para repartir.');
      var l = ps.map(function (p) {
        var ab = (p.porEstado.PENDIENTE || 0) + (p.porEstado.ASIGNADA || 0);
        return '• ' + p.nombre + ': ' + b(p.total) + ' (' + bp(p.total, t.total) + '), ' +
          b(ab) + ' sin cerrar y ' + b(p.proximas) + ' con fecha futura';
      }).join('\n');
      return ctx('Así está repartida la carga:\n' + l);
    } },

    { id: 'origen', txt: 'De dónde llegan', fn: function (t) {
      var o = t.porOrigen || {};
      return ctx('De dónde salieron estas solicitudes:\n' +
        '• Por WhatsApp (el bot): ' + b(o.BOT) + ' (' + bp(o.BOT, t.total) + ')\n' +
        '• Creadas dentro de la app: ' + b(o.APP) + ' (' + bp(o.APP, t.total) + ')\n' +
        '• Anteriores al registro por usuario: ' + b(o.HISTORICO) + ' (' + bp(o.HISTORICO, t.total) + ')\n\n' +
        (o.HISTORICO === t.total
          ? 'Todavía todas son históricas: el reparto por origen se empieza a llenar con las que entren desde ahora.'
          : 'El bot está trayendo ' + bp(o.BOT, (o.BOT + o.APP) || 1) + ' de lo nuevo.'));
    } },

    { id: 'meses', txt: 'Mes a mes', fn: function (t) {
      var s = t.serieMes || [];
      if (!s.length) return ctx('No hay meses con solicitudes todavía.');
      var suma = s.reduce(function (a, x) { return a + x.total; }, 0);
      var l = s.slice().sort(function (a, c) { return c.total - a.total; }).slice(0, 6).map(function (x) {
        return '• ' + x.mes + ' ' + x.anio + ': ' + b(x.total);
      }).join('\n');
      var txt = 'En los últimos ' + s.length + ' meses con movimiento entraron ' + b(suma) +
        ', un promedio de ' + b(Math.round(suma / s.length)) + ' por mes.\n\nLos más movidos:\n' + l;
      if (t.ultimoMes) {
        txt += '\n\nEn ' + t.ultimoMes.mes + ' ' + t.ultimoMes.anio + ' van ' + b(t.ultimoMes.total);
        if (t.anteriorMes) {
          var d = t.ultimoMes.total - t.anteriorMes.total;
          txt += d === 0 ? ', lo mismo que en ' + t.anteriorMes.mes + '.'
            : (d > 0 ? ', ' + b(d) + ' más que en ' + t.anteriorMes.mes + '.'
                     : ', ' + b(-d) + ' menos que en ' + t.anteriorMes.mes + '.');
        }
      }
      return ctx(txt);
    } },

    { id: 'horarios', txt: 'Horarios y días', fn: function (t) {
      var h = (t.horas || []).slice().sort(function (a, c) { return c.total - a.total; }).slice(0, 4);
      if (!h.length) return ctx('Ninguna de estas solicitudes tiene fecha, así que no hay horarios que analizar.');
      var conFecha = t.total - t.sinFecha;
      return ctx('De las ' + b(conFecha) + ' solicitudes que ya tienen fecha:\n' +
        '\nFranjas más ocupadas:\n' + h.map(function (x) {
          return '• ' + x.hora + ':00 → ' + b(x.total) + ' ' + plural(x.total, 'cita', 'citas');
        }).join('\n') +
        '\n\nDías con más citas:\n' + (t.dias || []).slice().sort(function (a, c) { return c.total - a.total; })
          .slice(0, 3).map(function (x) { return '• ' + x.dia + ': ' + b(x.total); }).join('\n'));
    } },

    { id: 'pacientes', txt: 'Pacientes', fn: function (t) {
      var top = (t.topPacientes || []).slice(0, 5);
      return ctx('Estas ' + b(t.total) + ' solicitudes corresponden a ' + b(t.pacientesUnicos) + ' pacientes distintos.\n' +
        '• Han pedido más de una vez: ' + b(t.recurrentes) + ' (' + bp(t.recurrentes, t.pacientesUnicos) + ')\n' +
        (top.length ? '\nLos que más han pedido:\n' + top.map(function (x) {
          return '• ' + x.nombre + ': ' + b(x.total);
        }).join('\n') : ''));
    } },

    { id: 'calidad', txt: 'Datos incompletos', fn: function (t) {
      var l = [
        ['Sin fecha de cita', t.sinFecha],
        ['Sin profesional', t.sinProfesional],
        ['Sin tratamiento', t.sinTratamiento],
        ['Sin número de WhatsApp', t.sinWhatsapp]
      ].filter(function (x) { return x[1] > 0; });
      if (!l.length) return ctx('No falta ningún dato: fecha, profesional, tratamiento y WhatsApp están completos.');
      return ctx('Datos que faltan por llenar:\n' + l.map(function (x) {
        return '• ' + x[0] + ': ' + b(x[1]) + ' (' + bp(x[1], t.total) + ')';
      }).join('\n') + '\n\nSin WhatsApp no se le puede avisar al paciente cuando se asigna la cita.');
    } }
  ];

  /* ============================================================
     INFORMES DE PROFESIONALES
     ============================================================ */
  var INFORMES_PROF = [
    { id: 'equipo', txt: 'Cómo va el equipo', fn: function (p) {
      var act = (p.profesionales || []).filter(function (x) { return x.total > 0; });
      var hoy = act.reduce(function (a, x) { return a + x.hoy; }, 0) + (p.sinAsignar ? p.sinAsignar.hoy : 0);
      var venc = act.reduce(function (a, x) { return a + x.vencidas; }, 0) + (p.sinAsignar ? p.sinAsignar.vencidas : 0);
      return 'El equipo tiene ' + b(p.total) + ' solicitudes en total.\n' +
        '• Con profesional asignado: ' + b(p.conProfesional) + ' (' + bp(p.conProfesional, p.total) + ')\n' +
        '• Sin asignar: ' + b(p.sinAsignar ? p.sinAsignar.total : 0) + '\n' +
        '• Profesionales con carga: ' + b(act.length) + '\n' +
        '• Citas hoy: ' + b(hoy) + '\n' +
        (venc ? '• Vencidas sin cerrar entre todos: ' + b(venc) + '\n' : '');
    } },

    { id: 'ranking', txt: 'Quién tiene más', fn: function (p) {
      var act = (p.profesionales || []).filter(function (x) { return x.total > 0; });
      if (!act.length) return 'Todavía no hay solicitudes asignadas a ningún profesional.';
      var l = act.map(function (x, i) {
        return '• ' + (i + 1) + '. ' + x.nombre + ': ' + b(x.total) + ' (' + x.pctCarga + ' % del total), ' +
          b(x.abiertas) + ' sin cerrar';
      }).join('\n');
      var dif = act.length > 1 ? act[0].total - act[act.length - 1].total : 0;
      return 'Carga de cada profesional:\n' + l +
        (dif ? '\n\nEntre el primero y el último hay ' + b(dif) + ' solicitudes de diferencia.' : '');
    } },

    { id: 'efectividad', txt: 'Efectividad', fn: function (p) {
      var act = (p.profesionales || []).filter(function (x) { return x.gestionadas > 0; })
        .sort(function (a, c) { return c.pctEfectivas - a.pctEfectivas; });
      if (!act.length) return 'Todavía no hay solicitudes gestionadas para medir efectividad.';
      return 'Confirmadas y realizadas frente a todo lo que ya salió de pendiente:\n' +
        act.map(function (x) {
          return '• ' + x.nombre + ': **' + x.pctEfectivas + ' %** (' + b(x.efectivas) + ' de ' + b(x.gestionadas) + ')' +
            (x.perdidas ? ', con ' + b(x.perdidas) + ' canceladas o descartadas' : '');
        }).join('\n');
    } },

    { id: 'agendaprof', txt: 'Agenda de cada uno', fn: function (p) {
      var act = (p.profesionales || []).filter(function (x) { return x.total > 0; });
      var l = act.map(function (x) {
        return '• ' + x.nombre + ': hoy ' + b(x.hoy) + ', esta semana ' + b(x.semana) +
          ', futuras ' + b(x.futuras) + (x.ultima ? ' (la última agendada, el ' + fecha(x.ultima) + ')' : '');
      }).join('\n');
      var s = p.sinAsignar;
      return 'Cómo viene la agenda:\n' + l +
        (s && s.futuras ? '\n\nOjo: ' + b(s.futuras) + ' citas futuras no tienen profesional asignado.' : '');
    } },

    { id: 'alertas', txt: 'Alertas', fn: function (p) {
      var l = [];
      (p.profesionales || []).forEach(function (x) {
        if (x.vencidas) l.push('• ' + x.nombre + ': ' + b(x.vencidas) + ' con fecha pasada sin cerrar');
      });
      var s = p.sinAsignar;
      if (s && s.total) l.push('• Sin profesional: ' + b(s.total) + ' solicitudes' +
        (s.vencidas ? ', ' + b(s.vencidas) + ' de ellas ya vencidas' : ''));
      (p.profesionales || []).forEach(function (x) {
        if (x.sinFecha) l.push('• ' + x.nombre + ': ' + b(x.sinFecha) + ' sin fecha de cita');
      });
      if (!l.length) return 'Nada que reportar: ningún profesional tiene citas vencidas ni solicitudes sin fecha.';
      return 'Lo que hay que revisar:\n' + l.join('\n');
    } },

    { id: 'servprof', txt: 'En qué se especializa cada uno', fn: function (p) {
      var act = (p.profesionales || []).filter(function (x) { return x.total > 0; });
      if (!act.length) return 'Todavía no hay solicitudes asignadas.';
      return act.map(function (x) {
        return x.nombre + ':\n' + (x.topServicios || []).map(function (s) {
          return '   • ' + s.nombre + ': ' + b(s.total) + ' (' + bp(s.total, x.total) + ' de lo suyo)';
        }).join('\n');
      }).join('\n\n');
    } },

    { id: 'balance', txt: 'Cómo repartir mejor', fn: function (p) {
      var act = (p.profesionales || []).filter(function (x) { return x.total > 0; })
        .sort(function (a, c) { return c.abiertas - a.abiertas; });
      if (act.length < 2) return 'Con un solo profesional con carga no hay nada que repartir.';
      var alto = act[0], bajo = act[act.length - 1];
      var dif = alto.abiertas - bajo.abiertas;
      var sin = p.sinAsignar ? p.sinAsignar.total : 0;
      var t = 'Mirando solo lo que sigue sin cerrar:\n' +
        act.map(function (x) { return '• ' + x.nombre + ': ' + b(x.abiertas) + ' abiertas'; }).join('\n');
      if (dif > 0) t += '\n\n' + alto.nombre + ' lleva ' + b(dif) + ' más que ' + bajo.nombre +
        '. Pasar ' + b(Math.floor(dif / 2)) + ' dejaría la carga pareja.';
      if (sin) t += '\n\nQuedan ' + b(sin) + ' sin dueño: repartirlas es lo que más descongestiona.';
      return t;
    } }
  ];

  /* Una ficha por doctor, generada a partir de los que existan. */
  function informesDeCadaDoctor(p) {
    return (p.profesionales || []).filter(function (x) { return x.total > 0; }).map(function (x) {
      return {
        id: 'ficha-' + x.nombre,
        txt: x.nombre.replace(/^Dr\.?\s*/i, 'Dr. ').split(' ').slice(0, 2).join(' '),
        fn: function () {
          return 'Ficha de ' + x.nombre + '\n' +
            '• Solicitudes: ' + b(x.total) + ' (' + x.pctCarga + ' % de todo)\n' +
            ESTADOS_ORD.map(function (e) {
              return '   • ' + bonito(e) + ': ' + b(x.porEstado[e] || 0);
            }).join('\n') + '\n' +
            '• Sin cerrar: ' + b(x.abiertas) + '  ·  Efectividad: **' + x.pctEfectivas + ' %**\n' +
            '• Hoy: ' + b(x.hoy) + '  ·  Esta semana: ' + b(x.semana) + '  ·  Futuras: ' + b(x.futuras) + '\n' +
            (x.vencidas ? '• Vencidas sin cerrar: ' + b(x.vencidas) + '\n' : '') +
            (x.sinFecha ? '• Sin fecha todavía: ' + b(x.sinFecha) + '\n' : '') +
            (x.primera ? '• Citas agendadas entre el ' + fecha(x.primera) + ' y el ' + fecha(x.ultima) + '\n' : '') +
            ((x.topServicios || []).length ? '\nLo que más atiende:\n' + x.topServicios.map(function (s) {
              return '   • ' + s.nombre + ': ' + b(s.total);
            }).join('\n') : '');
        }
      };
    });
  }

  /* ============================================================
     PANEL
     ============================================================ */
  function construir() {
    if (hoja) return;
    fab = nodo('<button class="ins-fab" type="button" title="Consultas rápidas" aria-label="Consultas rápidas">' + ROBOT + '</button>');
    velo = nodo('<div class="ins-velo"></div>');
    hoja = nodo('<div class="ins-hoja" role="dialog" aria-modal="true" aria-label="Consultas rápidas">' +
      '<div class="ins-cab"><span class="ins-cab__ico">' + ROBOT + '</span>' +
      '<div><h3 class="ins-cab__t">Consultas rápidas</h3><span class="ins-cab__s"></span></div>' +
      '<button class="ins-cab__x" type="button" aria-label="Cerrar">' + EQUIS + '</button></div>' +
      '<div class="ins-cuerpo"></div>' +
      '<div class="ins-pie"><div class="ins-botones"></div></div></div>');
    document.body.appendChild(fab);
    document.body.appendChild(velo);
    document.body.appendChild(hoja);
    cuerpo = hoja.querySelector('.ins-cuerpo');
    botonera = hoja.querySelector('.ins-botones');
    fab.addEventListener('click', abrir);
    velo.addEventListener('click', cerrar);
    hoja.querySelector('.ins-cab__x').addEventListener('click', cerrar);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && abierta) cerrar(); });
  }

  function abrir() {
    construir();
    abierta = true;
    velo.classList.add('is-abierta');
    hoja.classList.add('is-abierta');
    hoja.querySelector('.ins-cab__s').textContent =
      (vista === 'profesionales') ? 'Sobre el equipo' : 'Sobre lo que tienes en pantalla';
    cuerpo.innerHTML = '<div class="ins-vacio"><b>Elige una consulta</b>' +
      'Los informes se calculan aquí mismo con las cifras de la vista. Nada sale del teléfono.</div>';
    pintarBotones();
  }
  function cerrar() {
    abierta = false;
    if (velo) velo.classList.remove('is-abierta');
    if (hoja) hoja.classList.remove('is-abierta');
  }

  function catalogo() {
    if (vista === 'profesionales') {
      var p = P();
      return p ? INFORMES_PROF.concat(informesDeCadaDoctor(p)) : INFORMES_PROF;
    }
    return INFORMES_SOL;
  }

  function pintarBotones() {
    var datos = (vista === 'profesionales') ? P() : T();
    if (!datos) {
      botonera.innerHTML = '<span class="ins-b" style="cursor:default">Cargando cifras…</span>';
      return;
    }
    botonera.innerHTML = catalogo().map(function (c, i) {
      return '<button class="ins-b" type="button" data-i="' + i + '">' + esc(c.txt) + '</button>';
    }).join('');
    Array.prototype.forEach.call(botonera.querySelectorAll('.ins-b'), function (bt) {
      bt.addEventListener('click', function () { responder(Number(bt.dataset.i)); });
    });
  }

  function responder(i) {
    var lista = catalogo();
    var c = lista[i];
    if (!c) return;
    var datos = (vista === 'profesionales') ? P() : T();
    if (!datos) return;
    var texto;
    try { texto = c.fn(datos); } catch (e) { texto = 'No se pudo calcular este informe: ' + e.message; }

    var vacio = cuerpo.querySelector('.ins-vacio');
    if (vacio) vacio.remove();
    var msg = nodo('<div class="ins-msg"><p class="ins-msg__t">' + esc(c.txt) + '</p>' +
      '<p class="ins-msg__c"></p><div class="ins-msg__pie">' +
      '<button class="ins-msg__b" type="button" data-c="copiar">Copiar</button>' +
      '<button class="ins-msg__b ins-msg__b--wa" type="button" data-c="wa">Enviar por WhatsApp</button>' +
      '</div></div>');
    cuerpo.appendChild(msg);
    var p = msg.querySelector('.ins-msg__c');
    escribir(p, texto);
    msg.scrollIntoView({ block: 'start', behavior: reducido() ? 'auto' : 'smooth' });

    var plano = texto.replace(/\*\*/g, '');
    msg.querySelector('[data-c="copiar"]').addEventListener('click', function () {
      copiar(plano, this);
    });
    msg.querySelector('[data-c="wa"]').addEventListener('click', function () {
      var t = '*' + c.txt + ' — IPS Vascular*\n\n' + plano;
      window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
    });
  }

  function marcado(t) {
    return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }

  /* Efecto de tecleo: escribe por trozos, no letra por letra (en un
     informe largo letra a letra se hace eterno). Con el ajuste de
     "menos movimiento" del teléfono aparece de una. */
  function escribir(el, texto) {
    if (reducido()) { el.innerHTML = marcado(texto); return; }
    var i = 0, paso = Math.max(3, Math.round(texto.length / 90));
    el.innerHTML = '<span class="ins-cursor">&nbsp;</span>';
    var reloj = setInterval(function () {
      i += paso;
      if (i >= texto.length) {
        clearInterval(reloj);
        el.innerHTML = marcado(texto);
        return;
      }
      el.innerHTML = marcado(texto.slice(0, i)) + '<span class="ins-cursor">&nbsp;</span>';
    }, 18);
  }

  function copiar(txt, boton) {
    var listo = function () {
      var antes = boton.textContent;
      boton.textContent = 'Copiado';
      setTimeout(function () { boton.textContent = antes; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(listo, function () { copiarViejo(txt, listo); });
    } else copiarViejo(txt, listo);
  }
  function copiarViejo(txt, listo) {
    var a = document.createElement('textarea');
    a.value = txt; a.style.position = 'fixed'; a.style.opacity = '0';
    document.body.appendChild(a); a.select();
    try { document.execCommand('copy'); listo(); } catch (e) {}
    document.body.removeChild(a);
  }

  /* ============================================================
     VISIBILIDAD SEGÚN LA VISTA
     ============================================================ */
  function actualizarFab() {
    construir();
    var hay = (vista === 'solicitudes' || vista === 'profesionales');
    fab.classList.toggle('is-visible', hay);
    fab.classList.toggle('is-arriba', vista === 'solicitudes');   // encima del botón "+"
    if (!hay && abierta) cerrar();
    if (abierta) pintarBotones();
  }

  function enganchar() {
    construir();
    if (typeof window.showView === 'function') {
      var orig = window.showView;
      window.showView = function (id) {
        var v = orig.apply(this, arguments);
        vista = id;
        try { actualizarFab(); } catch (e) {}
        return v;
      };
    }
    /* Cuando la vista termina de cargar sus cifras, los botones se
       habilitan solos si el panel estaba abierto. */
    if (typeof Solicitudes !== 'undefined') {
      var r = Solicitudes.render;
      Solicitudes.render = function () {
        var v = r.call(this);
        if (abierta && vista === 'solicitudes') { try { pintarBotones(); } catch (e) {} }
        return v;
      };
    }
    if (typeof Profesionales !== 'undefined') {
      var rp = Profesionales.render;
      Profesionales.render = function () {
        var v = rp.call(this);
        if (abierta && vista === 'profesionales') { try { pintarBotones(); } catch (e) {} }
        return v;
      };
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enganchar);
  else enganchar();
})();
