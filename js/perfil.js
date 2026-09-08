/* ============================================================
 * IPS VASCULAR — js/perfil.js                (NUEVO · FASE 7)
 * ------------------------------------------------------------
 * © Oscar Polanía — Experto en Soluciones Digitales
 *
 * QUÉ HACE (ajuste 10)
 *   Guardar, ver con zoom y editar la foto de perfil.
 *     · El avatar de Inicio deja de ser una letra y pasa a ser la
 *       foto, con un botón de cámara encima.
 *     · Al tocarlo se abre "Mi perfil": ver la foto en grande,
 *       cambiarla o quitarla.
 *     · Al elegir una imagen se abre un recortador: se arrastra,
 *       se acerca con la rueda o con dos dedos y se puede girar.
 *       Lo que se sube es un cuadrado de 512 px, no el archivo
 *       original de 4 MB del celular.
 *     · En Configuración → Usuarios, el DESARROLLADOR ve las caras
 *       y puede cambiar o quitar la de cualquiera.
 *
 * DÓNDE QUEDA LA FOTO
 *   En la carpeta de Drive que indicaste. El servidor (Perfil.gs)
 *   la sube, la comparte por enlace y guarda su id y un SELLO en
 *   la hoja USUARIOS. Aquí se guarda una copia en el teléfono con
 *   ese mismo sello: mientras no cambie, la foto se pinta al
 *   instante y no se vuelve a pedir.
 *
 * CÓMO SE ENGANCHA
 *   No se modifica app.js. Envuelve irAInicio (para pintar el
 *   avatar) y Config.render (para las caras de la lista). Si se
 *   borra este archivo, la app vuelve sola a la Fase 6.
 *
 * INSTALACIÓN (al final del <body>)
 *   <script src="./js/perfil.js"></script>
 * PAREJA
 *   css/perfil.css
 * ============================================================ */
(function () {
  'use strict';
  if (window.__ipsPerfil) return;
  window.__ipsPerfil = true;

  var LADO_SUBIDA = 512;          // lo que se guarda en Drive
  var CALIDAD     = 0.85;
  var MAX_ARCHIVO = 12 * 1024 * 1024;
  var LS = 'ips.foto.';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function inicial(n) { return String(n || '?').trim().charAt(0).toUpperCase(); }
  function aviso(icono, titulo) {
    if (typeof Toast !== 'undefined' && Toast) Toast.fire({ icon: icono, title: titulo });
  }
  function error(t, h) {
    if (typeof alertErr === 'function') alertErr(t, h || '');
    else alert(t + '\n' + (h || ''));
  }

  /* ---------- copia local ---------- */
  function leerCache(id) {
    try {
      var v = localStorage.getItem(LS + id);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }
  function guardarCache(id, sello, url) {
    try {
      if (!sello || !url) { localStorage.removeItem(LS + id); return; }
      localStorage.setItem(LS + id, JSON.stringify({ sello: sello, url: url }));
    } catch (e) { /* memoria llena: la foto se volverá a pedir, nada más */ }
  }
  function borrarCache(id) { try { localStorage.removeItem(LS + id); } catch (e) { } }
  function fotoDe(id) { var c = leerCache(id); return (c && c.url) || ''; }

  var P = window.Perfil = {

    /* ============================================================
       AVATAR DE INICIO
       ============================================================ */
    pintarAvatar: function () {
      var el = document.getElementById('welcome-avatar');
      if (!el || typeof state === 'undefined' || !state.user) return;
      var url = fotoDe(state.user.id);
      el.classList.add('pf-av');
      el.innerHTML = url
        ? '<img class="pf-av__img" src="' + esc(url) + '" alt="Tu foto de perfil">' +
          '<span class="pf-av__cam" aria-hidden="true">' + camaraSVG() + '</span>'
        : esc(inicial(state.user.nombre)) +
          '<span class="pf-av__cam" aria-hidden="true">' + camaraSVG() + '</span>';
      if (!el.dataset.pfListo) {
        el.dataset.pfListo = '1';
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('title', 'Mi perfil');
        el.addEventListener('click', function () { P.abrirMiPerfil(); });
        el.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); P.abrirMiPerfil(); }
        });
      }
    },

    /* Pregunta al servidor si la foto guardada sigue siendo la buena.
       Va en silencio: si falla, se queda la que ya estaba. */
    revalidar: function (ids) {
      if (typeof state === 'undefined' || !state.user) return Promise.resolve();
      var lista = (ids && ids.length) ? ids : [state.user.id];
      var sellos = {};
      lista.forEach(function (id) { var c = leerCache(id); if (c && c.sello) sellos[id] = c.sello; });
      return apiPost('perfilFotos', withUser({ ids: lista, sellos: sellos })).then(function (d) {
        (d.fotos || []).forEach(function (f) {
          if (f.igual) return;
          if (!f.sello) borrarCache(f.id);
          else if (f.dataUrl) guardarCache(f.id, f.sello, f.dataUrl);
        });
        P.pintarAvatar();
        P.pintarUsuarios();
      }).catch(function () { });
    },

    /* ============================================================
       HOJA "MI PERFIL"
       ============================================================ */
    abrirMiPerfil: function (idObjetivo, nombreObjetivo, rolObjetivo) {
      if (typeof state === 'undefined' || !state.user) return;
      var id = idObjetivo || state.user.id;
      var nombre = nombreObjetivo || state.user.nombre;
      var rol = rolObjetivo || state.user.rol;
      var propio = (id === state.user.id);
      var url = fotoDe(id);

      cerrarHoja(true);
      var velo = document.createElement('div');
      velo.className = 'pf-velo';
      velo.id = 'pf-velo';
      velo.innerHTML =
        '<div class="pf-hoja" role="dialog" aria-modal="true" aria-label="Foto de perfil">' +
          '<div class="pf-hoja__asa"></div>' +
          '<div class="pf-hoja__cara">' +
            (url ? '<img id="pf-grande" src="' + esc(url) + '" alt="Foto de ' + esc(nombre) + '">'
                 : '<span class="pf-hoja__letra">' + esc(inicial(nombre)) + '</span>') +
          '</div>' +
          '<h3 class="pf-hoja__nombre">' + esc(nombre) + '</h3>' +
          '<p class="pf-hoja__rol">' + esc(rol || '') + (propio ? '' : ' · otro usuario') + '</p>' +
          '<div class="pf-hoja__botones">' +
            (url ? '<button class="btn btn-ghost btn-block" id="pf-ver">🔍 Ver con zoom</button>' : '') +
            '<button class="btn btn-primary btn-block" id="pf-cambiar">' + (url ? '🖼️ Cambiar foto' : '📷 Poner una foto') + '</button>' +
            (url ? '<button class="btn btn-danger btn-block" id="pf-quitar">Quitar foto</button>' : '') +
            '<button class="btn btn-ghost btn-block" id="pf-cerrar">Cerrar</button>' +
          '</div>' +
          '<p class="pf-hoja__pie">La foto se guarda en la carpeta de Drive de la IPS.</p>' +
        '</div>';
      document.body.appendChild(velo);
      document.body.classList.add('pf-bloqueado');
      requestAnimationFrame(function () { velo.classList.add('abierto'); });

      velo.addEventListener('click', function (ev) { if (ev.target === velo) cerrarHoja(); });
      document.getElementById('pf-cerrar').addEventListener('click', cerrarHoja);
      var bVer = document.getElementById('pf-ver');
      if (bVer) bVer.addEventListener('click', function () { P.abrirVisor(fotoDe(id), nombre); });
      document.getElementById('pf-cambiar').addEventListener('click', function () { P.elegirArchivo(id, nombre); });
      var bQ = document.getElementById('pf-quitar');
      if (bQ) bQ.addEventListener('click', function () { P.quitar(id, nombre); });
      document.addEventListener('keydown', escapeHoja);
    },

    /* ============================================================
       VISOR CON ZOOM
       ============================================================ */
    abrirVisor: function (url, nombre) {
      if (!url) return;
      var v = document.createElement('div');
      v.className = 'pf-visor';
      v.innerHTML =
        '<div class="pf-visor__barra">' +
          '<span class="pf-visor__titulo">' + esc(nombre || 'Foto de perfil') + '</span>' +
          '<button class="pf-visor__x" id="pf-visor-x" title="Cerrar">✕</button>' +
        '</div>' +
        '<div class="pf-visor__lienzo" id="pf-visor-lienzo">' +
          '<img id="pf-visor-img" src="' + esc(url) + '" alt="' + esc(nombre || '') + '" draggable="false">' +
        '</div>' +
        '<div class="pf-visor__pie">' +
          '<button class="pf-visor__btn" id="pf-menos">−</button>' +
          '<span class="pf-visor__nivel" id="pf-nivel">100%</span>' +
          '<button class="pf-visor__btn" id="pf-mas">+</button>' +
          '<button class="pf-visor__btn pf-visor__btn--txt" id="pf-reset">Ajustar</button>' +
        '</div>';
      document.body.appendChild(v);
      document.body.classList.add('pf-bloqueado');
      requestAnimationFrame(function () { v.classList.add('abierto'); });

      var img = v.querySelector('#pf-visor-img');
      var lienzo = v.querySelector('#pf-visor-lienzo');
      var z = 1, x = 0, y = 0, arrastrando = false, px = 0, py = 0;
      var punteros = {}, distIni = 0, zIni = 1;

      function aplicar() {
        if (z <= 1) { x = 0; y = 0; }
        img.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + z + ')';
        v.querySelector('#pf-nivel').textContent = Math.round(z * 100) + '%';
        lienzo.classList.toggle('pf-visor__lienzo--movible', z > 1);
      }
      function zoom(nuevo, cx, cy) {
        var antes = z;
        z = Math.min(6, Math.max(1, nuevo));
        if (cx != null && antes !== z) {
          var r = lienzo.getBoundingClientRect();
          var dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
          x = (x - dx) * (z / antes) + dx;
          y = (y - dy) * (z / antes) + dy;
        }
        aplicar();
      }
      v.querySelector('#pf-mas').addEventListener('click', function () { zoom(z + 0.5); });
      v.querySelector('#pf-menos').addEventListener('click', function () { zoom(z - 0.5); });
      v.querySelector('#pf-reset').addEventListener('click', function () { z = 1; x = 0; y = 0; aplicar(); });
      v.querySelector('#pf-visor-x').addEventListener('click', cerrar);
      lienzo.addEventListener('wheel', function (ev) {
        ev.preventDefault();
        zoom(z + (ev.deltaY < 0 ? 0.25 : -0.25), ev.clientX, ev.clientY);
      }, { passive: false });
      lienzo.addEventListener('dblclick', function (ev) {
        if (z > 1) { z = 1; x = 0; y = 0; aplicar(); } else zoom(2.5, ev.clientX, ev.clientY);
      });
      lienzo.addEventListener('pointerdown', function (ev) {
        punteros[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
        var k = Object.keys(punteros);
        if (k.length === 2) {
          distIni = dist(punteros[k[0]], punteros[k[1]]); zIni = z;
        } else if (z > 1) {
          arrastrando = true; px = ev.clientX; py = ev.clientY;
          try { lienzo.setPointerCapture(ev.pointerId); } catch (e) { }
        }
      });
      lienzo.addEventListener('pointermove', function (ev) {
        if (punteros[ev.pointerId]) punteros[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
        var k = Object.keys(punteros);
        if (k.length === 2 && distIni) {
          var d = dist(punteros[k[0]], punteros[k[1]]);
          zoom(zIni * (d / distIni));
          return;
        }
        if (!arrastrando) return;
        x += ev.clientX - px; y += ev.clientY - py; px = ev.clientX; py = ev.clientY;
        aplicar();
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
        lienzo.addEventListener(t, function (ev) {
          delete punteros[ev.pointerId];
          if (Object.keys(punteros).length < 2) distIni = 0;
          arrastrando = false;
        });
      });
      document.addEventListener('keydown', teclas);
      function teclas(ev) { if (ev.key === 'Escape') cerrar(); }
      function cerrar() {
        document.removeEventListener('keydown', teclas);
        v.classList.remove('abierto');
        setTimeout(function () {
          if (v.parentNode) v.parentNode.removeChild(v);
          if (!document.querySelector('.pf-velo')) document.body.classList.remove('pf-bloqueado');
        }, 180);
      }
      function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
      aplicar();
    },

    /* ============================================================
       ELEGIR ARCHIVO
       ============================================================ */
    elegirArchivo: function (id, nombre) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (input.parentNode) input.parentNode.removeChild(input);
        if (!f) return;
        if (f.size > MAX_ARCHIVO) {
          error('Esa imagen pesa demasiado', 'Elige una de menos de 12 MB.');
          return;
        }
        var lector = new FileReader();
        lector.onload = function () { P.abrirEditor(String(lector.result || ''), id, nombre); };
        lector.onerror = function () { error('No se pudo leer la imagen', 'Vuelve a intentarlo.'); };
        lector.readAsDataURL(f);
      });
      input.click();
    },

    /* ============================================================
       RECORTADOR
       ============================================================ */
    abrirEditor: function (dataUrl, id, nombre) {
      var img = new Image();
      img.onerror = function () {
        error('Ese formato no se puede abrir', 'El navegador no entiende esa imagen. Usa una JPG o PNG.');
      };
      img.onload = function () { montarEditor(img, id, nombre); };
      img.src = dataUrl;
    },

    /* ============================================================
       QUITAR
       ============================================================ */
    quitar: function (id, nombre) {
      var pregunta = (typeof confirmar === 'function')
        ? confirmar('Quitar la foto', '¿Quitar la foto de perfil de <b>' + esc(nombre) + '</b>?', 'Sí, quitar')
        : Promise.resolve(window.confirm('¿Quitar la foto?'));
      pregunta.then(function (ok) {
        if (!ok) return;
        startLoading();
        apiPost('eliminarFotoPerfil', withUser({ id: id })).then(function () {
          borrarCache(id);
          stopLoading();
          aviso('success', 'Foto quitada');
          cerrarHoja();
          P.pintarAvatar();
          P.pintarUsuarios();
        }).catch(function (e) { stopLoading(); error('No se pudo quitar', e.message); });
      });
    },

    /* ============================================================
       CARAS EN CONFIGURACIÓN → USUARIOS
       ============================================================ */
    pintarUsuarios: function () {
      var tarjetas = document.querySelectorAll('#cfg-content .usr-card[data-usr]');
      if (!tarjetas.length) return;
      Array.prototype.forEach.call(tarjetas, function (card) {
        var id = card.getAttribute('data-usr');
        var av = card.querySelector('.usr-card__avatar');
        var url = fotoDe(id);
        if (av) {
          av.classList.add('pf-usr-av');
          if (url) {
            if (!av.querySelector('img')) av.innerHTML = '<img src="' + esc(url) + '" alt="">';
            else av.querySelector('img').src = url;
          } else if (av.querySelector('img')) {
            av.innerHTML = esc(inicial(card.querySelector('.usr-card__name') &&
                                       card.querySelector('.usr-card__name').textContent));
          }
        }
        if (!card.querySelector('.pf-usr-cam')) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'pf-usr-cam';
          b.title = 'Foto de perfil';
          b.innerHTML = camaraSVG();
          b.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var nombre = card.querySelector('.usr-card__name');
            var rol = card.querySelector('.usr-chip');
            P.abrirMiPerfil(id, nombre ? nombre.textContent : '', rol ? rol.textContent : '');
          });
          card.appendChild(b);
        }
      });
    }
  };

  /* ============================================================
     EDITOR (recortar / acercar / girar)
     ============================================================ */
  function montarEditor(img, id, nombre) {
    cerrarHoja(true);
    var velo = document.createElement('div');
    velo.className = 'pf-velo abierto';
    velo.id = 'pf-velo';
    velo.innerHTML =
      '<div class="pf-hoja pf-hoja--editor" role="dialog" aria-modal="true" aria-label="Recortar la foto">' +
        '<h3 class="pf-ed__titulo">Ajusta tu foto</h3>' +
        '<p class="pf-ed__ayuda">Arrastra para mover · rueda o dos dedos para acercar</p>' +
        '<div class="pf-ed__marco" id="pf-ed-marco">' +
          '<canvas id="pf-ed-lienzo"></canvas>' +
          '<div class="pf-ed__mascara"></div>' +
        '</div>' +
        '<div class="pf-ed__controles">' +
          '<span class="pf-ed__icono">🔍</span>' +
          '<input type="range" id="pf-ed-zoom" min="100" max="400" value="100" aria-label="Acercar">' +
          '<button class="pf-ed__girar" id="pf-ed-girar" title="Girar 90°">⟳</button>' +
        '</div>' +
        '<div class="pf-hoja__botones">' +
          '<button class="btn btn-primary btn-block" id="pf-ed-guardar">Guardar foto</button>' +
          '<button class="btn btn-ghost btn-block" id="pf-ed-cancelar">Cancelar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(velo);
    document.body.classList.add('pf-bloqueado');
    document.addEventListener('keydown', escapeHoja);

    var marco = velo.querySelector('#pf-ed-marco');
    var lienzo = velo.querySelector('#pf-ed-lienzo');
    var ctx = lienzo.getContext('2d');
    var lado = Math.round(Math.min(320, Math.max(220, (window.innerWidth || 360) - 96)));
    lienzo.width = lado; lienzo.height = lado;
    marco.style.width = lado + 'px'; marco.style.height = lado + 'px';

    var rot = 0, zoom = 1, tx = 0, ty = 0;

    function anchoRot() { return (rot % 180 === 0) ? img.naturalWidth : img.naturalHeight; }
    function altoRot() { return (rot % 180 === 0) ? img.naturalHeight : img.naturalWidth; }
    function cubrir() { return Math.max(lado / anchoRot(), lado / altoRot()); }

    function limitar() {
      var e = cubrir() * zoom;
      var mx = (anchoRot() * e) / 2 - lado / 2;
      var my = (altoRot() * e) / 2 - lado / 2;
      tx = mx <= 0 ? 0 : Math.min(mx, Math.max(-mx, tx));
      ty = my <= 0 ? 0 : Math.min(my, Math.max(-my, ty));
    }
    function dibujar(destino, ladoDest) {
      var k = ladoDest / lado;
      var e = cubrir() * zoom * k;
      destino.save();
      destino.clearRect(0, 0, ladoDest, ladoDest);
      destino.fillStyle = '#ffffff';
      destino.fillRect(0, 0, ladoDest, ladoDest);
      destino.translate(ladoDest / 2 + tx * k, ladoDest / 2 + ty * k);
      destino.rotate(rot * Math.PI / 180);
      destino.scale(e, e);
      destino.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      destino.restore();
    }
    function pintar() { limitar(); dibujar(ctx, lado); }

    var rango = velo.querySelector('#pf-ed-zoom');
    rango.addEventListener('input', function () { zoom = Number(rango.value) / 100; pintar(); });
    velo.querySelector('#pf-ed-girar').addEventListener('click', function () {
      rot = (rot + 90) % 360; tx = 0; ty = 0; pintar();
    });

    var arrastrando = false, px = 0, py = 0, punteros = {}, distIni = 0, zIni = 1;
    marco.addEventListener('pointerdown', function (ev) {
      punteros[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var k = Object.keys(punteros);
      if (k.length === 2) { distIni = Math.hypot(punteros[k[0]].x - punteros[k[1]].x, punteros[k[0]].y - punteros[k[1]].y); zIni = zoom; }
      else { arrastrando = true; px = ev.clientX; py = ev.clientY; try { marco.setPointerCapture(ev.pointerId); } catch (e) { } }
    });
    marco.addEventListener('pointermove', function (ev) {
      if (punteros[ev.pointerId]) punteros[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var k = Object.keys(punteros);
      if (k.length === 2 && distIni) {
        var d = Math.hypot(punteros[k[0]].x - punteros[k[1]].x, punteros[k[0]].y - punteros[k[1]].y);
        zoom = Math.min(4, Math.max(1, zIni * (d / distIni)));
        rango.value = String(Math.round(zoom * 100));
        pintar();
        return;
      }
      if (!arrastrando) return;
      tx += ev.clientX - px; ty += ev.clientY - py; px = ev.clientX; py = ev.clientY;
      pintar();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
      marco.addEventListener(t, function (ev) {
        delete punteros[ev.pointerId];
        if (Object.keys(punteros).length < 2) distIni = 0;
        arrastrando = false;
      });
    });
    marco.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      zoom = Math.min(4, Math.max(1, zoom + (ev.deltaY < 0 ? 0.1 : -0.1)));
      rango.value = String(Math.round(zoom * 100));
      pintar();
    }, { passive: false });

    velo.querySelector('#pf-ed-cancelar').addEventListener('click', cerrarHoja);
    velo.querySelector('#pf-ed-guardar').addEventListener('click', function () {
      var salida = document.createElement('canvas');
      salida.width = LADO_SUBIDA; salida.height = LADO_SUBIDA;
      dibujar(salida.getContext('2d'), LADO_SUBIDA);
      var url;
      try { url = salida.toDataURL('image/jpeg', CALIDAD); }
      catch (e) { error('No se pudo preparar la foto', 'Vuelve a intentarlo con otra imagen.'); return; }

      startLoading();
      apiPost('guardarFotoPerfil', withUser({ id: id, dataUrl: url })).then(function (d) {
        guardarCache(d.id, d.sello, d.dataUrl || url);
        stopLoading();
        aviso('success', 'Foto guardada');
        cerrarHoja();
        P.pintarAvatar();
        P.pintarUsuarios();
      }).catch(function (e) { stopLoading(); error('No se pudo guardar', e.message); });
    });

    pintar();
  }

  /* ---------- utilidades de la hoja ----------
     Se cierran TODAS las hojas abiertas, no "la del id pf-velo".
     La hoja de perfil y el recortador comparten ese id, y al abrir
     el segundo mientras el primero se estaba desvaneciendo, cerrar
     por id apagaba el que ya iba de salida y dejaba el nuevo vivo
     para siempre, tapando la pantalla. */
  function cerrarHoja(inmediato) {
    document.removeEventListener('keydown', escapeHoja);
    var velos = Array.prototype.slice.call(document.querySelectorAll('.pf-velo'));
    if (!velos.length) return;
    velos.forEach(function (v) {
      if (inmediato) { quitar(v); return; }
      v.classList.remove('abierto');
      setTimeout(function () { quitar(v); }, 180);
    });
    function quitar(v) {
      if (v.parentNode) v.parentNode.removeChild(v);
      if (!document.querySelector('.pf-visor') && !document.querySelector('.pf-velo')) {
        document.body.classList.remove('pf-bloqueado');
      }
    }
  }
  function escapeHoja(ev) { if (ev.key === 'Escape') cerrarHoja(); }

  function camaraSVG() {
    return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>' +
      '<circle cx="12" cy="13" r="4"/></svg>';
  }

  /* ============================================================
     ENGANCHES
     ============================================================ */
  function enganchar() {
    if (typeof window.irAInicio === 'function') {
      var ir = window.irAInicio;
      window.irAInicio = function () {
        var r = ir.apply(this, arguments);
        P.pintarAvatar();
        P.revalidar();
        return r;
      };
    }
    if (typeof Config !== 'undefined' && typeof Config.render === 'function') {
      var rend = Config.render;
      Config.render = function () {
        var r = rend.apply(this, arguments);
        P.pintarUsuarios();
        /* El DESARROLLADOR ve las cuatro caras: se piden de una sola vez. */
        var ids = (this.usuarios || []).map(function (u) { return u.id; });
        if (ids.length) P.revalidar(ids);
        return r;
      };
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enganchar);
  else enganchar();
})();
