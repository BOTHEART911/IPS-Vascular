/* ============================================================
 * IPS VASCULAR — js/mitrabajo.js           (NUEVO · FASE 5)
 * ------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales
 *
 * QUÉ HACE (ajuste 7)
 *   Una vista propia con dos pestañas:
 *     · LO MÍO   → lo que ha tomado quien está en sesión: cuántas,
 *                  en qué estados, creadas/asignadas/movidas, sus
 *                  servicios y sus últimas diez.
 *     · EL EQUIPO→ una fila por persona activa, para ver el reparto.
 *
 *   Nadie deja de ver nada: los usuarios GENERAL siguen viendo TODAS
 *   las solicitudes (decisión del 07/09). Esto solo SEPARA lo propio.
 *   Por eso además enciende un filtro "solo lo mío" en la vista de
 *   Solicitudes, que se puede quitar de un toque.
 *
 * DE DÓNDE SALEN LOS NÚMEROS
 *   getMiTrabajo y getEquipo (Trazabilidad.gs, Fase 2). "Tomar" una
 *   solicitud = haberla creado, asignado o haber sido el último en
 *   moverla; cada solicitud cuenta una sola vez por persona.
 *
 * POR QUÉ ARRANCA EN CERO
 *   La trazabilidad empezó a guardarse con la Fase 2. Las 1.559
 *   solicitudes anteriores quedaron marcadas HISTÓRICO porque nunca
 *   se guardó quién las atendió, y las que entran por WhatsApp no
 *   tienen persona. El estado vacío lo dice con todas las letras:
 *   una pantalla en blanco sin explicación parece una app rota.
 *
 * CÓMO SE ENGANCHA
 *   No se modifica app.js. Envuelve pintarMenu (para añadir el tile),
 *   abrirModulo, y Solicitudes.params/hayFiltros/limpiarFiltros/render
 *   (para el filtro "solo lo mío"). Si se borra este archivo, la app
 *   vuelve sola a la Fase 4.
 *
 * INSTALACIÓN (al final del <body>, después de js/tableros.js)
 *   <script src="./js/mitrabajo.js"></script>
 * PAREJA
 *   css/mitrabajo.css   ·   sección #view-mitrabajo en index.html
 * ============================================================ */
(function () {
  'use strict';
  if (window.__ipsMiTrabajo) return;
  window.__ipsMiTrabajo = true;

  var ESTADOS_ORD = ['PENDIENTE', 'ASIGNADA', 'CONFIRMADA', 'REALIZADA', 'DESCARTADA', 'CANCELADA'];
  var COLOR = {
    PENDIENTE: 'var(--e-pendiente)', ASIGNADA: 'var(--e-asignada)', CONFIRMADA: 'var(--e-confirmada)',
    REALIZADA: 'var(--e-realizada)', DESCARTADA: 'var(--e-descartada)', CANCELADA: 'var(--e-cancelada)'
  };
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
               'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

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

  /* Icono del tile. Va en SVG y no como imagen: los otros cinco iconos
     son ilustraciones que ya existían; inventar una que desentone se
     nota más que usar el mismo trazo de los iconos de cabecera. */
  var ICONO_SVG =
    '<svg class="menu-tile__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 7h-3V5.5A2.5 2.5 0 0 0 14.5 3h-5A2.5 2.5 0 0 0 7 5.5V7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Z"/>' +
    '<path d="M9 7V5.6a.6.6 0 0 1 .6-.6h4.8a.6.6 0 0 1 .6.6V7"/>' +
    '<path d="M3 12h18"/><path d="M10.5 12v1.6h3V12"/></svg>';

  var MT = window.MiTrabajo = {
    pestana: 'mio',
    mio: null,
    equipo: null,

    async abrir() {
      showView('mitrabajo');
      this.medirEncabezado();
      this.pintarPestanas();
      await this.cargar();
    },
    medirEncabezado() {
      var h = document.querySelector('#view-mitrabajo .app-header');
      if (h) document.documentElement.style.setProperty('--hdr-h', h.offsetHeight + 'px');
    },

    async cargar(forzar) {
      var cont = document.getElementById('mt-content');
      if (!cont) return;
      var quiereMio = this.pestana === 'mio';
      if (!forzar && ((quiereMio && this.mio) || (!quiereMio && this.equipo))) { this.render(); return; }
      cont.innerHTML = esqueleto();
      try {
        if (quiereMio) this.mio = await apiGet('getMiTrabajo');
        else this.equipo = await apiGet('getEquipo');
        this.render();
      } catch (e) {
        cont.innerHTML = '<div class="bloque"><p class="bloque__vacio">No se pudo cargar: ' +
          esc(e.message) + '</p></div>';
      }
    },

    pintarPestanas() {
      var cont = document.getElementById('mt-tabs');
      if (!cont) return;
      var defs = [['mio', 'Lo mío'], ['equipo', 'El equipo']];
      var self = this;
      cont.innerHTML = defs.map(function (d) {
        return '<button class="mt-tab' + (self.pestana === d[0] ? ' is-active' : '') +
          '" data-tab="' + d[0] + '">' + d[1] + '</button>';
      }).join('');
      Array.prototype.forEach.call(cont.querySelectorAll('.mt-tab'), function (b) {
        b.addEventListener('click', function () {
          if (self.pestana === b.dataset.tab) return;
          self.pestana = b.dataset.tab;
          self.pintarPestanas();
          self.cargar();
        });
      });
    },

    render() {
      var cont = document.getElementById('mt-content');
      if (!cont) return;
      cont.innerHTML = (this.pestana === 'mio') ? htmlMio(this.mio) : htmlEquipo(this.equipo);
      enganchar(cont);
    },

    /* Refresco desde el tirón hacia abajo y desde el botón. */
    async recargar() {
      this.mio = null; this.equipo = null;
      await this.cargar(true);
    }
  };

  /* ---------------- piezas ---------------- */

  function esqueleto() {
    return '<div class="tab"><div class="tab__cuerpo" style="padding-top:14px;">' +
      '<div class="fx-skel-card fx-skel-card--list"><div class="fx-skel-col">' +
      '<div class="fx-skel-line w40"></div><div class="fx-skel-line w70 sm"></div></div></div>' +
      '<div class="fx-skel-card fx-skel-card--list"><div class="fx-skel-col">' +
      '<div class="fx-skel-line w55"></div><div class="fx-skel-line w80 sm"></div>' +
      '<div class="fx-skel-line w60 sm"></div></div></div>' +
      '</div></div>';
  }

  function anillo(porEstado, total, etiqueta) {
    var R = 52, C = 2 * Math.PI * R, off = 0, segs = '';
    ESTADOS_ORD.forEach(function (e) {
      var v = (porEstado || {})[e] || 0;
      if (!v || !total) return;
      var largo = C * v / total;
      segs += '<circle class="anillo__seg" cx="60" cy="60" r="' + R + '" stroke="' + COLOR[e] + '"' +
        ' stroke-dasharray="' + largo.toFixed(2) + ' ' + (C - largo).toFixed(2) + '"' +
        ' stroke-dashoffset="' + (-off).toFixed(2) + '"><title>' + bonito(e) + ': ' + num(v) + '</title></circle>';
      off += largo;
    });
    return '<div class="anillo"><svg viewBox="0 0 120 120" role="img" aria-label="Mis solicitudes por estado">' +
      '<circle class="anillo__pista" cx="60" cy="60" r="' + R + '"/>' + segs + '</svg>' +
      '<div class="anillo__centro"><span class="anillo__val">' + num(total) + '</span>' +
      '<span class="anillo__lbl">' + esc(etiqueta) + '</span></div></div>';
  }

  function leyenda(porEstado, total) {
    return '<div class="leyenda">' + ESTADOS_ORD.map(function (e) {
      var v = (porEstado || {})[e] || 0;
      return '<button class="leyenda__fila" data-estado="' + e + '"' + (v ? '' : ' disabled') + '>' +
        '<span class="leyenda__punto" style="background:' + COLOR[e] + '"></span>' +
        '<span class="leyenda__txt">' + bonito(e) + '</span>' +
        '<span class="leyenda__n">' + num(v) + '</span>' +
        '<span class="leyenda__pct">' + pc(v, total) + ' %</span></button>';
    }).join('') + '</div>';
  }

  function barras(items, verde) {
    if (!items || !items.length) return '<p class="bloque__vacio">Sin datos todavía.</p>';
    var max = items.reduce(function (m, x) { return Math.max(m, x.total); }, 1);
    return items.map(function (x) {
      return '<div class="barra"><div style="min-width:0">' +
        '<div class="barra__n">' + esc(x.nombre) + '</div>' +
        '<div class="barra__pista"><i class="barra__fill' + (verde ? ' barra__fill--verde' : '') +
        '" style="width:' + (x.total / max * 100).toFixed(1) + '%"></i></div></div>' +
        '<span class="barra__q">' + num(x.total) + '</span></div>';
    }).join('');
  }

  function cifra(valor, etiqueta, mod) {
    return '<div class="cifra' + (mod ? ' cifra--' + mod : '') + '">' +
      '<div class="cifra__val">' + num(valor) + '</div>' +
      '<div class="cifra__lbl">' + esc(etiqueta) + '</div></div>';
  }

  function panel(titulo, pista, cuerpo) {
    return '<section class="tab"><div class="tab__head"><h3 class="tab__titulo">' + esc(titulo) + '</h3>' +
      (pista ? '<span class="tab__pista">' + esc(pista) + '</span>' : '') + '</div>' +
      '<div class="tab__cuerpo">' + cuerpo + '</div></section>';
  }

  /* La nota explica el cero. Se muestra siempre, no solo cuando está
     vacío: dentro de tres meses, con datos, seguirá siendo cierto que
     lo histórico no se le cuenta a nadie. */
  function nota(historicas) {
    return '<p class="mt-nota">El conteo por persona empieza desde que se publicó la trazabilidad. ' +
      (historicas ? 'Las ' + num(historicas) + ' solicitudes anteriores están marcadas como HISTÓRICO ' : 'Lo anterior está marcado como HISTÓRICO ') +
      'porque nunca se guardó quién las atendió, y lo que entra por WhatsApp no tiene persona hasta que alguien la mueve.</p>';
  }

  function htmlMio(d) {
    if (!d) return '';
    if (!d.total) {
      return panel('Lo mío', '', vacioMio(d.usuario)) + nota(0);
    }
    var h = '';
    h += '<div class="tab__hero">' + anillo(d.porEstado, d.total, 'a mi nombre') +
         leyenda(d.porEstado, d.total) + '</div>';
    h += '<div class="tab__cifras">' +
      cifra(d.abiertas, 'Abiertas', d.abiertas ? 'alerta' : '') +
      cifra(d.cerradas, 'Cerradas', 'ok') +
      cifra(d.creadas, 'Creadas por mí') +
      cifra(d.asignadas, 'Asignadas por mí') +
      '</div>';
    h += '<div class="tab__bloques">' +
      '<div class="bloque"><h4 class="bloque__t">Mis servicios</h4>' + barras(d.topServicios) + '</div>' +
      '<div class="bloque"><h4 class="bloque__t">Por mes</h4>' +
        barras(serieOrdenada(d.serieMes).map(function (x) {
          return { nombre: x.mes + (x.anio ? ' ' + x.anio : ''), total: x.total };
        }), true) + '</div>' +
      '</div>';
    h += '<div class="bloque mt-ultimas"><h4 class="bloque__t">Mis últimas ' +
      (d.ultimas || []).length + '</h4>' + listaUltimas(d.ultimas) + '</div>';
    h += '<button class="btn btn-primary btn-block mt-sm" id="mt-ver-mias">' +
      'Ver mis ' + num(d.total) + ' solicitudes en la lista</button>';
    return panel('Lo mío', d.usuario ? esc(d.usuario) : '', h) + nota(0);
  }

  function vacioMio(usuario) {
    return '<div class="mt-vacio">' +
      '<div class="mt-vacio__icono">' + ICONO_SVG + '</div>' +
      '<h4>Todavía no hay nada a tu nombre' + (usuario ? ', ' + esc(String(usuario).split(' ')[0].toLowerCase().replace(/^./, function (c) { return c.toUpperCase(); })) : '') + '</h4>' +
      '<p>Esta pantalla se llena sola. En cuanto crees una solicitud, asignes una cita o cambies un estado, ' +
      'esa solicitud queda a tu nombre y aparece aquí.</p>' +
      '<button class="btn btn-primary" id="mt-ir-solicitudes">Ir a Solicitudes</button>' +
      '</div>';
  }

  function serieOrdenada(serie) {
    return (serie || []).slice().sort(function (a, b) {
      return (a.anio - b.anio) || (MESES.indexOf(a.mes) - MESES.indexOf(b.mes));
    });
  }

  function fechaCita(iso) {
    if (!iso) return 'Sin cita';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return 'Sin cita'; }
  }

  function listaUltimas(items) {
    if (!items || !items.length) return '<p class="bloque__vacio">Sin movimientos todavía.</p>';
    return '<div class="mt-lista">' + items.map(function (s) {
      var cls = String(s.estado || '').toLowerCase();
      return '<button class="mt-fila" data-sol="' + esc(s.id) + '">' +
        '<span class="mt-fila__id">' + esc(s.id) + '</span>' +
        '<span class="mt-fila__pac">' + esc(s.paciente) + '</span>' +
        '<span class="mt-fila__fecha">' + esc(fechaCita(s.fechaHora)) + '</span>' +
        '<span class="estado-badge badge-' + cls + '">' + esc(s.estado) + '</span>' +
        '</button>';
    }).join('') + '</div>';
  }

  function htmlEquipo(d) {
    if (!d) return '';
    var us = d.usuarios || [];
    var conTrabajo = us.filter(function (u) { return u.total > 0; }).length;
    var h = '';
    h += '<div class="tab__cifras">' +
      cifra(d.total, 'Solicitudes en total') +
      cifra(d.porOrigen.APP || 0, 'Desde la aplicación') +
      cifra(d.porOrigen.BOT || 0, 'Desde WhatsApp') +
      cifra(d.porOrigen.HISTORICO || 0, 'Histórico sin dueño') +
      '</div>';

    if (!conTrabajo) {
      h += '<div class="mt-vacio mt-vacio--chico">' +
        '<h4>Nadie tiene solicitudes a su nombre todavía</h4>' +
        '<p>El reparto empieza a llenarse con el primer movimiento que haga cualquiera del equipo.</p>' +
        '</div>';
    }

    h += '<div class="mt-equipo">' + us.map(function (u) {
      var pe = u.porEstado || {};
      var realizadas = pe.REALIZADA || 0;
      var pct = d.total ? (u.total / d.total * 100) : 0;
      return '<article class="mt-persona">' +
        '<div class="mt-persona__cab">' +
          '<span class="mt-persona__ini">' + esc(String(u.nombre || '?').trim().charAt(0).toUpperCase()) + '</span>' +
          '<div class="mt-persona__id"><strong>' + esc(u.nombre) + '</strong>' +
          '<span class="mt-persona__rol">' + esc(u.rol) + '</span></div>' +
          '<span class="mt-persona__total">' + num(u.total) + '</span>' +
        '</div>' +
        '<div class="barra__pista"><i class="barra__fill" style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '<div class="mt-persona__pie">' +
          '<span>Abiertas <b>' + num(u.abiertas) + '</b></span>' +
          '<span>Confirmadas <b>' + num(pe.CONFIRMADA || 0) + '</b></span>' +
          '<span>Realizadas <b>' + num(realizadas) + '</b></span>' +
        '</div></article>';
    }).join('') + '</div>';

    return panel('El equipo', num(us.length) + ' personas activas', h) + nota(d.porOrigen.HISTORICO || 0);
  }

  /* ---------------- enganches de la propia vista ---------------- */
  function enganchar(cont) {
    var ver = cont.querySelector('#mt-ver-mias') || cont.querySelector('#mt-ir-solicitudes');
    if (ver) {
      ver.addEventListener('click', function () {
        if (typeof Solicitudes === 'undefined') return;
        Solicitudes.filtroMias = (ver.id === 'mt-ver-mias');
        Solicitudes.filtroEstado = 'TODOS';
        Solicitudes.filtroProfesional = ''; Solicitudes.filtroOrigen = '';
        Solicitudes.abrir();
      });
    }
    Array.prototype.forEach.call(cont.querySelectorAll('.leyenda__fila'), function (b) {
      b.addEventListener('click', function () {
        if (typeof Solicitudes === 'undefined' || b.disabled) return;
        Solicitudes.filtroMias = true;
        Solicitudes.filtroEstado = b.dataset.estado;
        Solicitudes.filtroProfesional = ''; Solicitudes.filtroOrigen = '';
        Solicitudes.abrir();
      });
    });
    /* Tocar una de "mis últimas" abre su detalle, sin pasar por la
       lista: es el atajo que justifica que la lista esté aquí. */
    Array.prototype.forEach.call(cont.querySelectorAll('[data-sol]'), function (b) {
      b.addEventListener('click', async function () {
        if (typeof Solicitudes === 'undefined') return;
        var id = b.dataset.sol;
        var s = (MT.mio && MT.mio.ultimas || []).filter(function (x) { return String(x.id) === id; })[0];
        if (s && typeof Solicitudes.abrirDetalle === 'function') Solicitudes.abrirDetalle(s);
      });
    });
  }

  /* ============================================================
     ENGANCHES SOBRE app.js (sin tocarlo)
     ============================================================ */
  function engancharApp() {
    /* 1) El tile del menú. pintarMenu se declara con `function`, así
       que sí existe en window y se puede envolver. */
    if (typeof window.pintarMenu === 'function') {
      var pm = window.pintarMenu;
      window.pintarMenu = function () {
        pm.apply(this, arguments);
        try { anadirTile(); } catch (e) {}
      };
    }
    if (typeof window.abrirModulo === 'function') {
      var am = window.abrirModulo;
      window.abrirModulo = function (key) {
        if (key === 'mitrabajo') return MT.abrir();
        return am.apply(this, arguments);
      };
    }

    /* 2) El filtro "solo lo mío" en la vista de Solicitudes. */
    if (typeof Solicitudes !== 'undefined') {
      Solicitudes.filtroMias = false;

      var params = Solicitudes.params;
      Solicitudes.params = function (pagina) {
        var o = params.call(this, pagina);
        if (this.filtroMias) o.mias = '1';
        return o;
      };
      var hayF = Solicitudes.hayFiltros;
      Solicitudes.hayFiltros = function () { return !!this.filtroMias || hayF.call(this); };
      var limpiar = Solicitudes.limpiarFiltros;
      Solicitudes.limpiarFiltros = function () { this.filtroMias = false; return limpiar.call(this); };

      var render = Solicitudes.render;
      Solicitudes.render = function () {
        var v = render.call(this);
        try { pintarAviso(this); } catch (e) {}
        return v;
      };
    }
  }

  function anadirTile() {
    var grid = document.getElementById('menu-grid');
    if (!grid || grid.querySelector('[data-tile="mitrabajo"]')) return;
    var el = document.createElement('button');
    el.className = 'menu-tile menu-tile--svg';
    el.setAttribute('data-tile', 'mitrabajo');
    el.innerHTML = ICONO_SVG +
      '<div class="menu-tile__title">Mi trabajo</div>' +
      '<div class="menu-tile__desc">Lo mío y lo del equipo</div>';
    el.addEventListener('click', function () {
      try { snd(SONIDOS.click); } catch (e) {}
      MT.abrir();
    });
    /* Va después de Solicitudes: es la vista con la que se trabaja
       a diario, no la última del cajón. */
    var primero = grid.children[1];
    if (primero) grid.insertBefore(el, primero); else grid.appendChild(el);
  }

  /* Aviso dentro de Solicitudes cuando el filtro propio está puesto.
     Sin esto, la lista se ve "incompleta" y nadie sabe por qué.
     Va ARRIBA DEL TODO, antes de los filtros: pegado a la lista
     quedaba debajo del tablero, y había que bajar media pantalla
     para enterarse de por qué faltaban solicitudes. */
  function pintarAviso(S) {
    var caja = document.querySelector('#view-solicitudes .container');
    if (!caja) return;
    var previo = document.getElementById('mt-aviso');
    if (previo) previo.remove();
    if (!S.filtroMias) return;
    var el = document.createElement('div');
    el.id = 'mt-aviso';
    el.className = 'mt-aviso';
    el.innerHTML = '<span>Viendo solo lo que has tomado tú</span>' +
      '<button class="mt-aviso__x" type="button" aria-label="Quitar este filtro">Ver todas</button>';
    el.querySelector('.mt-aviso__x').addEventListener('click', function () {
      S.filtroMias = false;
      S.cargar();
    });
    caja.insertBefore(el, caja.firstElementChild);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', engancharApp);
  else engancharApp();
})();
