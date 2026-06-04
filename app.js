/* ============================================================
   IPS VASCULAR — app.js
   Login PIN · Dashboard · Solicitudes · Profesionales · Pacientes
   · Bot (BuilderBot) · Configuración + Usuarios (solo DESARROLLADOR)
   ============================================================
   ⚠️ PEGA AQUÍ LA URL /exec DE TU APPS SCRIPT:
   ============================================================ */
const API_BASE = 'https://script.google.com/macros/s/AKfycbyLA6OaoplbY2-SlwvlAN-Vy3Ep07DK4QMcJ12E5nR09O-DOLCoaV4idtQ-_FX_zq_MOg/exec';

const SESSION_KEY = 'ipsSession';
let APP_VERSION_LOADED = '';

const SONIDOS = {
  login: 'https://res.cloudinary.com/dqqeavica/video/upload/v1759011577/Siri_star_g1owy4.mp3',
  click: 'https://res.cloudinary.com/dqqeavica/video/upload/v1759011577/Namedrop_Popup_ale2zy.mp3',
  ok:    'https://res.cloudinary.com/dqqeavica/video/upload/v1759011578/Keyboard_Enter_b9k2dc.mp3',
  err:   'https://res.cloudinary.com/dqqeavica/video/upload/v1759011578/Low_battery_d5qua1.mp3'
};

const ICONOS = {
  solicitudes:   'https://res.cloudinary.com/dqqeavica/image/upload/v1778860849/expedientes_evq6df.webp',
  pacientes:     'https://res.cloudinary.com/dqqeavica/image/upload/v1780574926/pacientes_ngrqck.webp',
  profesionales: 'https://res.cloudinary.com/dqqeavica/image/upload/v1780574926/medicos_zgjsf9.png',
  bot:           'https://res.cloudinary.com/dqqeavica/image/upload/v1780053848/heartsync_ojmqxm.gif',
  config:        'https://res.cloudinary.com/dqqeavica/image/upload/v1778186304/impresora_gkpbci.webp'
};

const ESTADOS = ['PENDIENTE','ASIGNADA','CONFIRMADA','REALIZADA','DESCARTADA','CANCELADA'];

const state = { user:null, pinBuffer:'' };

/* ---------- Helpers UI ---------- */
const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
function startLoading(){ $('#loader')?.classList.remove('hidden'); }
function stopLoading(){ $('#loader')?.classList.add('hidden'); }

let _lastSnd=0;
function snd(url){ const n=Date.now(); if(n-_lastSnd<150)return; _lastSnd=n; try{const a=new Audio(url);a.volume=0.6;a.play().catch(()=>{});}catch(e){} }
function escapeHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function showView(id){ $$('.view').forEach(v=>v.classList.remove('active')); const v=$('#view-'+id); if(v){v.classList.add('active'); window.scrollTo({top:0,behavior:'instant'});} }
function esDev(){ return String(state.user?.rol||'').toUpperCase()==='DESARROLLADOR'; }

function fmtFecha(iso){
  if(!iso) return '—';
  const d=new Date(iso); if(isNaN(d.getTime())) return '—';
  const dias=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  let h=d.getHours(); const m=('0'+d.getMinutes()).slice(-2); const ampm=h<12?'AM':'PM'; const h12=h===0?12:(h>12?h-12:h);
  return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]} · ${h12}:${m} ${ampm}`;
}

/* ---------- SweetAlert wrappers ---------- */
const Toast = (typeof Swal!=='undefined') ? Swal.mixin({toast:true,position:'top',showConfirmButton:false,timer:2400,timerProgressBar:true}) : null;
function alertOk(t,h=''){ snd(SONIDOS.ok); return Swal.fire({icon:'success',title:t,html:h,timer:2200,showConfirmButton:false}); }
function alertErr(t,h=''){ snd(SONIDOS.err); return Swal.fire({icon:'error',title:t,html:h,confirmButtonText:'Entendido'}); }
function alertWarn(t,h=''){ return Swal.fire({icon:'warning',title:t,html:h,confirmButtonText:'Entendido'}); }
function confirmar(t,h='',c='Sí, continuar'){ return Swal.fire({icon:'question',title:t,html:h,showCancelButton:true,confirmButtonText:c,cancelButtonText:'Cancelar',reverseButtons:true}).then(r=>r.isConfirmed); }

/* ---------- API ---------- */
async function apiGet(action, params={}){
  const qs=new URLSearchParams({action,...params}).toString();
  const r=await fetch(`${API_BASE}?${qs}`,{method:'GET'});
  const j=await r.json();
  if(!j.ok) throw new Error(j.error||'Error desconocido');
  return j.data;
}
async function apiPost(action, body={}){
  const r=await fetch(`${API_BASE}?action=${encodeURIComponent(action)}`,{
    method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(body)
  });
  const j=await r.json();
  if(!j.ok) throw new Error(j.error||'Error desconocido');
  return j.data;
}
function withUser(b={}){ return {...b, usuario: state.user?{id:state.user.id,nombre:state.user.nombre,rol:state.user.rol}:null}; }

/* ============================================================
   LOGIN (PIN)
   ============================================================ */
function setupLogin(){
  $$('.pin-key').forEach(k=>{
    k.addEventListener('click',()=>{
      const key=k.dataset.key;
      if(key==='clear') state.pinBuffer='';
      else if(key==='back') state.pinBuffer=state.pinBuffer.slice(0,-1);
      else if(/^\d$/.test(key)){ if(state.pinBuffer.length<4){ state.pinBuffer+=key; snd(SONIDOS.click); } }
      pintarPin();
      if(state.pinBuffer.length===4) loginPin();
    });
  });
}
function pintarPin(){ $$('.pin-dot').forEach((d,i)=>d.classList.toggle('filled', i<state.pinBuffer.length)); }

async function loginPin(){
  startLoading();
  try{
    const data=await apiGet('loginPin',{pin:state.pinBuffer});
    if(!data.encontrado){ state.pinBuffer=''; pintarPin(); stopLoading(); return alertErr('PIN incorrecto','Verifica tu PIN de 4 dígitos.'); }
    state.user=data; localStorage.setItem(SESSION_KEY,JSON.stringify(data));
    snd(SONIDOS.login); stopLoading(); irAInicio();
  }catch(e){ state.pinBuffer=''; pintarPin(); stopLoading(); alertErr('Error',e.message); }
}
function logout(){ localStorage.removeItem(SESSION_KEY); state.user=null; state.pinBuffer=''; pintarPin(); showView('login'); }

/* ============================================================
   INICIO + DASHBOARD
   ============================================================ */
async function irAInicio(){
  if(!state.user) return showView('login');
  $('#welcome-name').textContent=state.user.nombre;
  $('#welcome-rol').textContent=state.user.rol;
  $('#welcome-avatar').textContent=String(state.user.nombre||'?').trim().charAt(0).toUpperCase();
  pintarMenu();
  showView('inicio');
  cargarDashboard();
}

function pintarMenu(){
  const tiles=[
    {key:'solicitudes', titulo:'Solicitudes', desc:'Gestión de citas', icono:ICONOS.solicitudes, dev:false},
    {key:'profesionales', titulo:'Profesionales', desc:'Estadísticas por doctor', icono:ICONOS.profesionales, dev:false},
    {key:'pacientes', titulo:'Pacientes', desc:'Historial por paciente', icono:ICONOS.pacientes, dev:false},
    {key:'bot', titulo:'Mi Bot', desc:'Control de WhatsApp', icono:ICONOS.bot, dev:false},
    {key:'configuracion', titulo:'Configuración', desc:'Ajustes y usuarios', icono:ICONOS.config, dev:true}
  ];
  const grid=$('#menu-grid'); grid.innerHTML='';
  tiles.filter(t=>!t.dev || esDev()).forEach(t=>{
    const el=document.createElement('button');
    el.className='menu-tile';
    el.innerHTML=`<img src="${t.icono}" alt="${t.titulo}" loading="lazy"/><div class="menu-tile__title">${t.titulo}</div><div class="menu-tile__desc">${t.desc}</div>`;
    el.addEventListener('click',()=>{ snd(SONIDOS.click); abrirModulo(t.key); });
    grid.appendChild(el);
  });
}
function abrirModulo(key){
  if(key==='solicitudes') Solicitudes.abrir();
  else if(key==='profesionales') Profesionales.abrir();
  else if(key==='pacientes') Pacientes.abrir();
  else if(key==='bot') Bot.abrir();
  else if(key==='configuracion') Config.abrir();
}

async function cargarDashboard(){
  const cont=$('#dash-content');
  cont.innerHTML='<div class="dash-section"><p class="muted text-center">Cargando indicadores…</p></div>';
  try{
    const d=await apiGet('getDashboard');
    cont.innerHTML = renderKpis(d) + renderEstados(d) + renderBarChart(d) + renderTopServicios(d);
  }catch(e){ cont.innerHTML=`<div class="dash-section"><p class="muted">No se pudo cargar el panel: ${escapeHtml(e.message)}</p></div>`; }
}
function renderKpis(d){
  return `<div class="dash-kpis">
    <div class="kpi"><div class="kpi__icon">🧾</div><div class="kpi__val">${d.total}</div><div class="kpi__lbl">Solicitudes</div></div>
    <div class="kpi"><div class="kpi__icon">⏳</div><div class="kpi__val">${d.porEstado.PENDIENTE||0}</div><div class="kpi__lbl">Pendientes</div></div>
    <div class="kpi"><div class="kpi__icon">👤</div><div class="kpi__val">${d.totalPacientes}</div><div class="kpi__lbl">Pacientes</div></div>
    <div class="kpi"><div class="kpi__icon">🩺</div><div class="kpi__val">${d.totalProfesionales}</div><div class="kpi__lbl">Profesionales</div></div>
  </div>`;
}
function renderEstados(d){
  const max=Math.max(...ESTADOS.map(e=>d.porEstado[e]||0),1);
  const rows=ESTADOS.map(e=>{
    const v=d.porEstado[e]||0; const pct=(v/max*100).toFixed(1);
    return `<div class="estado-row">
      <span class="estado-row__lbl">${e.charAt(0)+e.slice(1).toLowerCase()}</span>
      <div class="estado-row__bar"><div class="estado-row__fill fill-${e.toLowerCase()}" style="width:${pct}%"></div></div>
      <span class="estado-row__qty">${v}</span></div>`;
  }).join('');
  return `<div class="dash-section"><h3 class="dash-section__title">📊 Solicitudes por estado</h3><div class="estado-bars">${rows}</div></div>`;
}
function renderBarChart(d){
  const serie=d.serieMes||[]; if(!serie.length) return '';
  const max=Math.max(...serie.map(x=>x.total),1);
  const bw=100/serie.length;
  const best=serie.reduce((a,b)=>b.total>a.total?b:a,serie[0]);

  // Barras
  const bars=serie.map((x,i)=>{
    const h=(x.total/max)*100;
    const isb=(x.mes===best.mes && x.anio===best.anio);
    return `<g class="bc-bar ${isb?'bc-bar--best':''}"><rect x="${i*bw+bw*0.15}" y="${100-h}" width="${bw*0.7}" height="${h}" rx="2"/><title>${etiquetaMes(x)}: ${x.total}</title></g>`;
  }).join('');

// Etiquetas de mes + año pequeñito debajo de cada mes
  const labelsMes=serie.map((x,i)=>{
    const anioPrev = i>0 ? serie[i-1].anio : null;
    const esNuevo  = x.anio && x.anio!==anioPrev;   // resalta el primer mes de cada año
    return `<div class="bc-lbl-cell">
      <span class="bc-lbl-mes">${String(x.mes).slice(0,3)}</span>
      ${x.anio?`<span class="bc-lbl-anio ${esNuevo?'is-new':''}">'${String(x.anio).slice(-2)}</span>`:''}
    </div>`;
  }).join('');

  return `<div class="dash-section"><h3 class="dash-section__title">📈 Solicitudes por mes</h3>
    <div class="bar-chart-wrap">
      <svg class="bar-chart" viewBox="0 0 100 110" preserveAspectRatio="none">${bars}</svg>
      <div class="bar-chart-labels">${labelsMes}</div>
    </div></div>`;
}

function etiquetaMes(x){ return x.anio ? `${String(x.mes).slice(0,3)} ${x.anio}` : String(x.mes); }

function renderTopServicios(d){
  const top=d.topServicios||[]; if(!top.length) return '';
  const max=Math.max(...top.map(x=>x.total),1);
  const rows=top.map(x=>`<div class="rank-row"><div style="min-width:0">
    <div class="rank-row__name">${escapeHtml(x.nombre)}</div>
    <div class="rank-row__bar"><div class="rank-row__fill" style="width:${(x.total/max*100).toFixed(1)}%"></div></div></div>
    <div class="rank-row__qty">${x.total}</div></div>`).join('');
  return `<div class="dash-section"><h3 class="dash-section__title">🏆 Servicios más solicitados</h3><div class="rank-list">${rows}</div></div>`;
}

/* ============================================================
   SOLICITUDES
   ============================================================ */
const Solicitudes = {
  data:[], filtroEstado:'TODOS', filtroTexto:'', profesionales:[], catalogos:null,

  async abrir(){
    showView('solicitudes');
    if(!this.profesionales.length){ try{ this.profesionales=await apiGet('getProfesionales'); }catch(e){} }
    if(!this.catalogos){ try{ this.catalogos=await apiGet('getCatalogos'); }catch(e){} }
    await this.cargar();
  },
  async cargar(){
    startLoading();
    try{
      this.data=await apiGet('getSolicitudes',{estado:this.filtroEstado, q:this.filtroTexto});
      this.render();
    }catch(e){ alertErr('Error al cargar',e.message); }
    finally{ stopLoading(); }
  },
  render(){
    const sub=$('#sol-subtitle');
    if(sub) sub.textContent=`${this.data.length} solicitud${this.data.length===1?'':'es'}`;
    const cont=$('#sol-content');
    if(!this.data.length){ cont.innerHTML=`<div class="card text-center"><h3>Sin resultados</h3><p class="muted">No hay solicitudes con este filtro.</p></div>`; return; }
    cont.innerHTML=this.data.map(s=>{
      const cls=s.estado.toLowerCase();
      return `<article class="sol-card sol-card--${cls}" data-sol="${escapeHtml(s.id)}">
        <div class="sol-card__body">
          <h4 class="sol-card__name">${escapeHtml(s.paciente)}</h4>
          <div class="sol-card__doc">${escapeHtml(s.documento)}</div>
          <div class="sol-card__serv">${escapeHtml(s.servicio)}</div>
        </div>
        <div class="sol-card__right">
          <span class="estado-badge badge-${cls}">${s.estado}</span>
          ${s.fechaHora?`<span class="sol-card__fecha">${fmtFecha(s.fechaHora)}</span>`:''}
        </div></article>`;
    }).join('');
    $$('[data-sol]',cont).forEach(el=>el.addEventListener('click',()=>{
      const s=this.data.find(x=>String(x.id)===el.dataset.sol); if(s) this.abrirDetalle(s);
    }));
  },

  abrirDetalle(s){
    const cls=s.estado.toLowerCase();
    const html=`<div class="sol-detalle">
      <div style="text-align:center;margin-bottom:10px;"><span class="estado-badge badge-${cls}" style="font-size:0.72rem;">${s.estado}</span></div>
      <div class="sol-detalle__row"><span>ID</span><b>${escapeHtml(s.id)}</b></div>
      <div class="sol-detalle__row"><span>Paciente</span><b>${escapeHtml(s.paciente)}</b></div>
      <div class="sol-detalle__row"><span>Documento</span><b>${escapeHtml(s.documento)}</b></div>
      <div class="sol-detalle__row"><span>WhatsApp</span><b>${escapeHtml(s.whatsapp)}</b></div>
      <div class="sol-detalle__row"><span>Servicio</span><b>${escapeHtml(s.servicio)}</b></div>
      <div class="sol-detalle__row"><span>Tratamiento</span><b>${escapeHtml(s.tratamiento)}</b></div>
      <div class="sol-detalle__row"><span>Profesional</span><b>${escapeHtml(s.profesional)}</b></div>
      <div class="sol-detalle__row"><span>Fecha/Hora</span><b>${s.fechaHora?fmtFecha(s.fechaHora):'—'}</b></div>
      ${s.bitacora?`<div class="sol-detalle__row"><span>Observación</span><b>${escapeHtml(s.bitacora)}</b></div>`:''}
    </div>`;
    const self=this;
    Swal.fire({
      title:'Solicitud', html, width:520, showConfirmButton:false, showCloseButton:true,
      footer:'<div id="sol-acc-wrap" style="width:100%"></div>',
      didOpen:()=>{
        const wrap=document.getElementById('sol-acc-wrap');
        const acc=[];
        if(s.estado==='PENDIENTE'){
          acc.push(['asignar','📅 Asignar cita','btn-accent']);
          acc.push(['descartar','✕ Descartar','btn-danger']);
        } else if(s.estado==='ASIGNADA'){
          acc.push(['confirmar','✓ Confirmar','btn-success']);
          acc.push(['reenviar','🔁 Reenviar WhatsApp','btn-ghost']);
          acc.push(['cancelar','✕ Cancelar','btn-danger']);
        } else if(s.estado==='CONFIRMADA'){
          acc.push(['realizar','✓ Marcar realizada','btn-success']);
          acc.push(['cancelar','✕ Cancelar','btn-danger']);
        } else {
          acc.push(['pendiente','↶ Volver a pendiente','btn-ghost']);
        }
        wrap.innerHTML=`<div class="sol-acciones">${acc.map(a=>`<button class="btn ${a[2]}" data-acc="${a[0]}">${a[1]}</button>`).join('')}</div>`;
        $$('[data-acc]',wrap).forEach(b=>b.addEventListener('click',()=>{
          const a=b.dataset.acc; Swal.close();
          setTimeout(()=>self.ejecutarAccion(s,a),150);
        }));
      }
    });
  },

  async ejecutarAccion(s,acc){
    if(acc==='asignar') return this.modalAsignar(s);
    const mapa={ descartar:'DESCARTADA', cancelar:'CANCELADA', confirmar:'CONFIRMADA', realizar:'REALIZADA', pendiente:'PENDIENTE' };
    if(acc==='reenviar'){ return this.modalAsignar(s, true); }
    const nuevo=mapa[acc]; if(!nuevo) return;
    const ok=await confirmar('Cambiar estado', `¿Marcar la solicitud de <b>${escapeHtml(s.paciente)}</b> como <b>${nuevo}</b>?`, 'Sí');
    if(!ok) return;
    startLoading();
    try{ await apiPost('cambiarEstado', withUser({id:s.id, estado:nuevo})); stopLoading(); Toast&&Toast.fire({icon:'success',title:'Estado actualizado'}); this.cargar(); }
    catch(e){ stopLoading(); alertErr('Error',e.message); }
  },

  modalAsignar(s, reenvio=false){
    const profs=this.profesionales.map(p=>`<option value="${escapeHtml(p.nombre)}" ${p.nombre===s.profesional?'selected':''}>${escapeHtml(p.nombre)}</option>`).join('');
    // valor datetime-local
    let dt=''; if(s.fechaHora){ const d=new Date(s.fechaHora); if(!isNaN(d)) dt=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); }
    Swal.fire({
      title: reenvio?'Reenviar WhatsApp':'Asignar cita',
      html:`<div style="text-align:left">
        <label>Profesional</label><select id="as-prof">${profs}<option value="${escapeHtml(s.profesional)}" ${this.profesionales.find(p=>p.nombre===s.profesional)?'':'selected'}>${escapeHtml(s.profesional||'N/A')}</option></select>
        <label>Fecha y hora</label><input id="as-fecha" type="datetime-local" value="${dt}"/>
        <label>Observaciones (opcional)</label><textarea id="as-obs" placeholder="Notas para el paciente…">${escapeHtml(s.bitacora||'')}</textarea>
        <p class="muted" style="margin-top:10px;font-size:0.78rem;">Al confirmar se enviará el WhatsApp pidiendo "CONFIRMO CITA".</p>
      </div>`,
      width:520, showCancelButton:true, confirmButtonText: reenvio?'Reenviar':'Asignar y enviar', cancelButtonText:'Cancelar', reverseButtons:true,
      preConfirm:()=>{
        const fecha=$('#as-fecha').value;
        if(!fecha){ Swal.showValidationMessage('Selecciona fecha y hora'); return false; }
        return { profesional:$('#as-prof').value, fechaHora:new Date(fecha).toISOString(), bitacora:$('#as-obs').value.trim() };
      }
    }).then(async r=>{
      if(!r.isConfirmed) return;
      startLoading();
      try{
        const res=await apiPost('asignarSolicitud', withUser({id:s.id, ...r.value}));
        stopLoading();
        if(res.whatsapp && res.whatsapp.ok) alertOk('Cita asignada','WhatsApp enviado al paciente.');
        else alertWarn('Cita asignada','La cita quedó asignada, pero el WhatsApp no se pudo confirmar. Revisa el bot.');
        this.cargar();
      }catch(e){ stopLoading(); alertErr('Error',e.message); }
    });
  },

  modalNueva(){
    if(!this.catalogos){ return alertWarn('Un momento','Cargando catálogos, intenta de nuevo.'); }
    const servs=this.catalogos.servicios.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
    const trats=this.catalogos.tratamientos.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
    const profs=this.profesionales.map(p=>`<option value="${escapeHtml(p.nombre)}">${escapeHtml(p.nombre)}</option>`).join('');
    Swal.fire({
      title:'Nueva solicitud',
      html:`<div style="text-align:left">
        <label>Documento del paciente</label><input id="ns-doc" inputmode="numeric" placeholder="Número de documento"/>
        <label>Nombre del paciente</label><input id="ns-nombre" placeholder="NOMBRE COMPLETO"/>
        <label>WhatsApp (con 57)</label><input id="ns-wa" inputmode="numeric" placeholder="573001234567"/>
        <label>Servicio</label><select id="ns-serv">${servs}</select>
        <label>Tratamiento</label><select id="ns-trat">${trats}</select>
        <label>Profesional</label><select id="ns-prof"><option value="N/A">N/A</option>${profs}</select>
        <label>Observación (opcional)</label><textarea id="ns-obs"></textarea>
      </div>`,
      width:560, showCancelButton:true, confirmButtonText:'Crear', cancelButtonText:'Cancelar', reverseButtons:true,
      preConfirm:()=>{
        const doc=$('#ns-doc').value.trim(), nombre=$('#ns-nombre').value.trim();
        if(!doc){ Swal.showValidationMessage('Documento requerido'); return false; }
        if(!nombre){ Swal.showValidationMessage('Nombre requerido'); return false; }
        return { documento:doc, paciente:nombre, whatsapp:$('#ns-wa').value.trim(), servicio:$('#ns-serv').value, tratamiento:$('#ns-trat').value, profesional:$('#ns-prof').value, bitacora:$('#ns-obs').value.trim() };
      }
    }).then(async r=>{
      if(!r.isConfirmed) return;
      startLoading();
      try{ await apiPost('crearSolicitud', withUser(r.value)); stopLoading(); Toast&&Toast.fire({icon:'success',title:'Solicitud creada'}); this.cargar(); }
      catch(e){ stopLoading(); alertErr('Error',e.message); }
    });
  },

  setupListeners(){
    $$('#sol-chips-estado .chip').forEach(c=>c.addEventListener('click',()=>{
      $$('#sol-chips-estado .chip').forEach(x=>x.classList.remove('is-active'));
      c.classList.add('is-active'); this.filtroEstado=c.dataset.estado; this.cargar();
    }));
    const fab=$('#sol-fab'); if(fab) fab.addEventListener('click',()=>this.modalNueva());
    const sBtn=$('#sol-search-btn'), sBar=$('#sol-search-bar'), sInp=$('#sol-search-input');
    if(sBtn) sBtn.addEventListener('click',()=>{ sBar.classList.toggle('hidden'); if(!sBar.classList.contains('hidden')) sInp.focus(); else { sInp.value=''; this.filtroTexto=''; this.cargar(); } });
    if(sInp){ let t=null; sInp.addEventListener('input',()=>{ clearTimeout(t); t=setTimeout(()=>{ this.filtroTexto=sInp.value.trim(); this.cargar(); },350); }); }
  }
};

/* ============================================================
   PROFESIONALES (dashboard por doctor)
   ============================================================ */
const Profesionales = {
  data:[],
  async abrir(){ showView('profesionales'); await this.cargar(); },
  async cargar(){
    startLoading();
    try{
      const profs=await apiGet('getProfesionales');
      // conteos rápidos vía solicitudes del dashboard no incluye por prof; usamos getStats por doctor al abrir
      const d=await apiGet('getDashboard');
      this.dashTotal=d.total;
      this.data=profs;
      this.render();
    }catch(e){ alertErr('Error',e.message); }
    finally{ stopLoading(); }
  },
  render(){
    const cont=$('#prof-content');
    if(!this.data.length){ cont.innerHTML='<div class="card text-center"><h3>Sin profesionales</h3></div>'; return; }
    cont.innerHTML=this.data.map(p=>{
      const ini=String(p.nombre||'?').replace('Dr.','').trim().charAt(0).toUpperCase();
      return `<article class="prof-card" data-prof="${escapeHtml(p.nombre)}">
        <div class="prof-card__avatar">${ini||'D'}</div>
        <div class="prof-card__body"><h4 class="prof-card__name">${escapeHtml(p.nombre)}</h4>
        <div class="prof-card__meta">Toca para ver estadísticas</div></div>
        <span class="prof-card__arrow">›</span></article>`;
    }).join('');
    $$('[data-prof]',cont).forEach(el=>el.addEventListener('click',()=>this.abrirStats(el.dataset.prof)));
  },
  async abrirStats(nombre){
    startLoading();
    try{
      const d=await apiGet('getStatsProfesional',{profesional:nombre});
      stopLoading();
      const maxE=Math.max(...ESTADOS.map(e=>d.porEstado[e]||0),1);
      const estados=ESTADOS.map(e=>{ const v=d.porEstado[e]||0;
        return `<div class="estado-row"><span class="estado-row__lbl">${e.charAt(0)+e.slice(1).toLowerCase()}</span>
        <div class="estado-row__bar"><div class="estado-row__fill fill-${e.toLowerCase()}" style="width:${(v/maxE*100).toFixed(1)}%"></div></div>
        <span class="estado-row__qty">${v}</span></div>`; }).join('');
      const serie=d.serieMes||[]; const maxM=Math.max(...serie.map(x=>x.total),1); const bw=serie.length?100/serie.length:0;
      const bars=serie.map((x,i)=>{const h=(x.total/maxM)*100; return `<g class="bc-bar"><rect x="${i*bw+bw*0.15}" y="${100-h}" width="${bw*0.7}" height="${h}" rx="2"/><title>${x.anio?String(x.mes).slice(0,3)+' '+x.anio:x.mes}: ${x.total}</title></g>`;}).join('');
     const labels=serie.map((x,i)=>{
        const anioPrev = i>0 ? serie[i-1].anio : null;
        const esNuevo  = x.anio && x.anio!==anioPrev;
        return `<div class="bc-lbl-cell">
          <span class="bc-lbl-mes">${String(x.mes).slice(0,3)}</span>
          ${x.anio?`<span class="bc-lbl-anio ${esNuevo?'is-new':''}">'${String(x.anio).slice(-2)}</span>`:''}
        </div>`;
      }).join('');
      const top=d.topServicios||[]; const maxS=Math.max(...top.map(x=>x.total),1);
      const servicios=top.map(x=>`<div class="rank-row"><div style="min-width:0"><div class="rank-row__name">${escapeHtml(x.nombre)}</div>
        <div class="rank-row__bar"><div class="rank-row__fill" style="width:${(x.total/maxS*100).toFixed(1)}%"></div></div></div><div class="rank-row__qty">${x.total}</div></div>`).join('');
      Swal.fire({
        title:nombre, width:600, confirmButtonText:'Cerrar',
        html:`<div class="prof-stats">
          <div class="prof-stats__kpis">
            <div class="prof-stats__kpi"><div class="prof-stats__kpi-val">${d.total}</div><div class="prof-stats__kpi-lbl">Total</div></div>
            <div class="prof-stats__kpi"><div class="prof-stats__kpi-val">${d.porEstado.CONFIRMADA||0}</div><div class="prof-stats__kpi-lbl">Confirmadas</div></div>
            <div class="prof-stats__kpi"><div class="prof-stats__kpi-val">${d.porEstado.REALIZADA||0}</div><div class="prof-stats__kpi-lbl">Realizadas</div></div>
          </div>
          <h4 style="margin:6px 0 8px;color:var(--primary)">Por estado</h4><div class="estado-bars">${estados}</div>
     ${serie.length?`<h4 style="margin:14px 0 6px;color:var(--primary)">Por mes</h4>
            <svg class="bar-chart" viewBox="0 0 100 110" preserveAspectRatio="none">${bars}</svg>
            <div class="bar-chart-labels">${labels}</div>`:''}
          ${top.length?`<h4 style="margin:14px 0 6px;color:var(--primary)">Servicios</h4><div class="rank-list">${servicios}</div>`:''}
        </div>`
      });
    }catch(e){ stopLoading(); alertErr('Error',e.message); }
  }
};

/* ============================================================
   PACIENTES (historial)
   ============================================================ */
const Pacientes = {
  data:[], filtro:'',
  async abrir(){ showView('pacientes'); await this.cargar(); },
  async cargar(){
    startLoading();
    try{ this.data=await apiGet('getPacientes',{q:this.filtro}); this.render(); }
    catch(e){ alertErr('Error',e.message); }
    finally{ stopLoading(); }
  },
  render(){
    const sub=$('#pac-subtitle'); if(sub) sub.textContent=`${this.data.length} paciente${this.data.length===1?'':'s'}`;
    const cont=$('#pac-content');
    if(!this.data.length){ cont.innerHTML='<div class="card text-center"><h3>Sin pacientes</h3></div>'; return; }
    cont.innerHTML=this.data.map(p=>{
      const ini=String(p.nombre||'?').trim().charAt(0).toUpperCase();
      return `<article class="pac-card" data-pac="${escapeHtml(p.documento)}">
        <div class="pac-card__avatar">${ini}</div>
        <div class="pac-card__body"><h4 class="pac-card__name">${escapeHtml(p.nombre)}</h4>
        <div class="pac-card__meta">Doc: ${escapeHtml(p.documento)} · ${p.solicitudes} cita${p.solicitudes===1?'':'s'}</div></div>
        <span class="prof-card__arrow">›</span></article>`;
    }).join('');
    $$('[data-pac]',cont).forEach(el=>el.addEventListener('click',()=>this.abrirHistorial(el.dataset.pac)));
  },
  async abrirHistorial(doc){
    startLoading();
    try{
      const d=await apiGet('getHistorialPaciente',{documento:doc});
      stopLoading();
      const p=d.paciente; const sols=d.solicitudes||[];
      const tel=String(p.telefono||'').replace(/\D/g,'');
      const items=sols.length? sols.map(s=>`<div class="hist-item sol-card--${s.estado.toLowerCase()}" style="border-left-color:var(--e-${s.estado.toLowerCase()})">
        <div style="min-width:0"><div class="hist-item__serv">${escapeHtml(s.servicio)}</div>
        <div class="hist-item__meta">${escapeHtml(s.profesional)} · ${s.fechaHora?fmtFecha(s.fechaHora):'sin fecha'}</div></div>
        <span class="estado-badge badge-${s.estado.toLowerCase()}" style="align-self:center">${s.estado}</span></div>`).join('')
        : '<p class="muted">Sin citas registradas.</p>';
      Swal.fire({
        title:escapeHtml(p.nombre), width:560, confirmButtonText:'Cerrar',
        html:`<div style="text-align:left">
          <div class="sol-detalle__row"><span>Documento</span><b>${escapeHtml(p.documento)}</b></div>
          <div class="sol-detalle__row"><span>Teléfono</span><b>${escapeHtml(p.telefono||'—')}</b></div>
          ${tel?`<div style="display:flex;gap:8px;margin:10px 0 14px"><a class="btn btn-ghost btn-sm" style="flex:1" href="tel:${tel}">📞 Llamar</a><a class="btn btn-ghost btn-sm" style="flex:1" href="https://wa.me/${tel}" target="_blank" rel="noopener">💬 WhatsApp</a></div>`:''}
          <h4 style="margin:8px 0;color:var(--primary)">Historial (${sols.length})</h4>${items}
        </div>`
      });
    }catch(e){ stopLoading(); alertErr('Error',e.message); }
  },
  setupListeners(){
    const sBtn=$('#pac-search-btn'), sBar=$('#pac-search-bar'), sInp=$('#pac-search-input');
    if(sBtn) sBtn.addEventListener('click',()=>{ sBar.classList.toggle('hidden'); if(!sBar.classList.contains('hidden')) sInp.focus(); else { sInp.value=''; this.filtro=''; this.cargar(); } });
    if(sInp){ let t=null; sInp.addEventListener('input',()=>{ clearTimeout(t); t=setTimeout(()=>{ this.filtro=sInp.value.trim(); this.cargar(); },350); }); }
  }
};

/* ============================================================
   BOT (control, lenguaje simple — sin API keys)
   ============================================================ */
const Bot = {
  silenciado:false,
  async abrir(){ showView('bot'); this.render(); await this.refrescarEstado(); },
  render(){
    $('#bot-content').innerHTML=`
      <div id="bot-status" class="bot-status bot-status--unknown">
        <div class="bot-status__icon">⏳</div>
        <div class="bot-status__txt">Consultando estado…</div>
        <div class="bot-status__sub">Un momento por favor</div>
      </div>

      <div class="bot-section">
        <h3 class="bot-section__title">📱 Conectar WhatsApp</h3>
        <p class="muted">Si tu bot está desconectado, genera el código QR y escanéalo desde WhatsApp en tu teléfono.</p>
        <button id="bot-qr-btn" class="btn btn-primary btn-block mt-sm">Mostrar código QR</button>
        <div id="bot-qr-box" style="text-align:center"></div>
      </div>

      <div class="bot-section">
        <h3 class="bot-section__title">🛠 Controles del bot</h3>
        <div class="bot-btn-grid">
          <button class="bot-action" id="bot-reboot"><span class="bot-action__icon">🔄</span>Reiniciar</button>
          <button class="bot-action" id="bot-mute"><span class="bot-action__icon">🔇</span><span id="bot-mute-lbl">Silenciar</span></button>
        </div>
      </div>

      <div class="bot-section">
        <h3 class="bot-section__title">👤 Gestionar un contacto</h3>
        <p class="muted">Escribe el número (con 57) para bloquearlo, desbloquearlo o limpiar su conversación.</p>
        <div class="bot-contacto-row">
          <input id="bot-num" inputmode="numeric" placeholder="573001234567"/>
        </div>
        <div class="bot-btn-grid mt-sm">
          <button class="bot-action" id="bot-block"><span class="bot-action__icon">🚫</span>Bloquear</button>
          <button class="bot-action" id="bot-unblock"><span class="bot-action__icon">✅</span>Desbloquear</button>
        </div>
        <button class="bot-action" id="bot-clear" style="width:100%;margin-top:10px;flex-direction:row;gap:10px"><span class="bot-action__icon">🧹</span>Limpiar conversación</button>
      </div>`;

    $('#bot-qr-btn').addEventListener('click',()=>this.mostrarQR());
    $('#bot-reboot').addEventListener('click',()=>this.reiniciar());
    $('#bot-mute').addEventListener('click',()=>this.toggleMute());
    $('#bot-block').addEventListener('click',()=>this.contacto('botBloquear','Bloquear contacto'));
    $('#bot-unblock').addEventListener('click',()=>this.contacto('botDesbloquear','Desbloquear contacto'));
    $('#bot-clear').addEventListener('click',()=>this.contacto('botLimpiar','Limpiar conversación'));
  },

  async refrescarEstado(){
    const box=$('#bot-status'); if(!box) return;
    try{
      const r=await apiGet('botEstado');
      const st=String(r.status||'UNKNOWN').toUpperCase();
      if(st==='ONLINE'){ box.className='bot-status bot-status--online'; box.innerHTML='<div class="bot-status__icon">🟢</div><div class="bot-status__txt">Tu bot está conectado</div><div class="bot-status__sub">Funcionando correctamente</div>'; }
      else if(st==='READY_TO_SCAN'){ box.className='bot-status bot-status--scan'; box.innerHTML='<div class="bot-status__icon">🟡</div><div class="bot-status__txt">Esperando que escanees el QR</div><div class="bot-status__sub">Genera el QR abajo y escanéalo</div>'; }
      else if(st==='OFFLINE'||st==='FAILED'){ box.className='bot-status bot-status--offline'; box.innerHTML='<div class="bot-status__icon">🔴</div><div class="bot-status__txt">Tu bot está desconectado</div><div class="bot-status__sub">Genera el QR para reconectarlo</div>'; }
      else { box.className='bot-status bot-status--unknown'; box.innerHTML=`<div class="bot-status__icon">⚪</div><div class="bot-status__txt">Estado: ${escapeHtml(st)}</div><div class="bot-status__sub">Toca actualizar para reintentar</div>`; }
    }catch(e){
      box.className='bot-status bot-status--unknown';
      box.innerHTML=`<div class="bot-status__icon">⚪</div><div class="bot-status__txt">No se pudo consultar</div><div class="bot-status__sub">${escapeHtml(e.message)}</div>`;
    }
  },

async mostrarQR(){
    const boxQR=$('#bot-qr-box');
    boxQR.innerHTML='<p class="muted">Generando código QR… (si el bot estaba apagado puede tardar unos segundos)</p>';
    const panelUrl='https://link.bbot.site/85c2e4d1-278c-45a8-af29-03b6cb3b32ac';
    try{
      const r=await apiGet('botQR');
      const qr=r && r.qr ? String(r.qr) : '';
      if(!qr){
        boxQR.innerHTML=`<p class="muted">${escapeHtml((r&&r.error)||'No se recibió el QR. Toca de nuevo en unos segundos.')}</p>
          <div class="bot-btn-grid">
            <button class="bot-action" id="bot-qr-regen"><span class="bot-action__icon">🔄</span>Reintentar</button>
            <a class="bot-action" href="${panelUrl}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span class="bot-action__icon">🔗</span>Abrir en pestaña</a>
          </div>`;
        $('#bot-qr-regen')?.addEventListener('click',()=>this.mostrarQR()); return;
      }
      const src = qr.indexOf('data:')===0 ? qr : (/^https?:\/\//.test(qr) ? qr : 'data:image/png;base64,'+qr);
      boxQR.innerHTML=`
        <img class="bot-qr-img" src="${src}" alt="Código QR de WhatsApp"
             onerror="this.replaceWith(document.createTextNode('No se pudo mostrar el QR. Toca Regenerar.'))"/>
        <p class="muted">Escanéalo desde WhatsApp → <b>Dispositivos vinculados</b>. El código se renueva cada cierto tiempo.</p>
        <div class="bot-btn-grid">
          <button class="bot-action" id="bot-qr-regen"><span class="bot-action__icon">🔄</span>Regenerar QR</button>
          <a class="bot-action" href="${panelUrl}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span class="bot-action__icon">🔗</span>Abrir en pestaña</a>
        </div>`;
      $('#bot-qr-regen')?.addEventListener('click',()=>this.mostrarQR());
    }catch(e){ boxQR.innerHTML=`<p class="muted">Error al generar QR: ${escapeHtml(e.message)}</p>`; }
  },
   
  async reiniciar(){
    const ok=await confirmar('Reiniciar bot','El bot se reiniciará. Puede tardar unos segundos en volver a conectarse. ¿Continuar?','Sí, reiniciar');
    if(!ok) return;
    startLoading();
    try{ const r=await apiPost('botReiniciar',withUser({})); stopLoading(); if(r.ok) alertOk('Bot reiniciado'); else alertWarn('Aviso','No se confirmó el reinicio.'); setTimeout(()=>this.refrescarEstado(),2000); }
    catch(e){ stopLoading(); alertErr('Error',e.message); }
  },

  async toggleMute(){
    const nuevo=!this.silenciado;
    const ok=await confirmar(nuevo?'Silenciar bot':'Activar bot', nuevo?'El bot dejará de responder mensajes. ¿Continuar?':'El bot volverá a responder mensajes. ¿Continuar?','Sí');
    if(!ok) return;
    startLoading();
    try{ const r=await apiPost('botMute',withUser({flag:nuevo})); stopLoading();
      if(r.ok){ this.silenciado=nuevo; $('#bot-mute-lbl').textContent=nuevo?'Activar':'Silenciar'; Toast&&Toast.fire({icon:'success',title:nuevo?'Bot silenciado':'Bot activado'}); }
      else alertWarn('Aviso','No se confirmó el cambio.');
    }catch(e){ stopLoading(); alertErr('Error',e.message); }
  },

  async contacto(action,titulo){
    const num=$('#bot-num').value.trim().replace(/\D/g,'');
    if(num.length<8) return alertWarn('Número inválido','Escribe un número válido con código de país (57).');
    const ok=await confirmar(titulo, `Acción sobre el número <b>${num}</b>. ¿Continuar?`,'Sí');
    if(!ok) return;
    startLoading();
    try{ const r=await apiPost(action,withUser({numero:num})); stopLoading(); if(r.ok) alertOk('Listo'); else alertWarn('Aviso','No se confirmó la acción.'); }
    catch(e){ stopLoading(); alertErr('Error',e.message); }
  },

  setupListeners(){ const r=$('#bot-refresh'); if(r) r.addEventListener('click',()=>this.refrescarEstado()); }
};

/* ============================================================
   CONFIGURACIÓN + USUARIOS (solo DESARROLLADOR)
   ============================================================ */
const Config = {
  cfg:{}, usuarios:[],
  async abrir(){
    if(!esDev()) return alertWarn('Acceso restringido','Solo el DESARROLLADOR puede ver esta sección.');
    showView('configuracion');
    await this.cargar();
  },
  async cargar(){
    startLoading();
    try{
      this.cfg=await apiPost('getConfig',withUser({}));
      this.usuarios=await apiPost('listUsuarios',withUser({}));
      this.render();
    }catch(e){ alertErr('Error',e.message); }
    finally{ stopLoading(); }
  },
  render(){
    const c=this.cfg;
    const v=(k)=>escapeHtml(String(c[k]==null?'':c[k]));
    const cont=$('#cfg-content');
    cont.innerHTML=`
      ${this.seccion('usuarios','👥 Usuarios', this.renderUsuarios())}
   ${this.seccion('bot','🤖 Conexión HeartSync', `
        <label>Endpoint base</label>
        <div class="cfg-secret-row"><input id="cfg-BB_ENDPOINT_BASE" type="password" value="${v('BB_ENDPOINT_BASE')}"/>
          <button type="button" class="cfg-secret-toggle" data-toggle="cfg-BB_ENDPOINT_BASE">👁</button></div>
        <label>Bot ID (API v2)</label>
        <div class="cfg-secret-row"><input id="cfg-BB_BOT_ID" type="password" value="${v('BB_BOT_ID')}"/>
          <button type="button" class="cfg-secret-toggle" data-toggle="cfg-BB_BOT_ID">👁</button></div>
        <label>Project ID (API v1 manager)</label>
        <div class="cfg-secret-row"><input id="cfg-BB_PROJECT_ID" type="password" value="${v('BB_PROJECT_ID')}"/>
          <button type="button" class="cfg-secret-toggle" data-toggle="cfg-BB_PROJECT_ID">👁</button></div>
        <label>API Manager · general (bbc-…) — estado y QR</label>
        <div class="cfg-secret-row"><input id="cfg-BB_MANAGER_API" type="password" value="${v('BB_MANAGER_API')}"/>
          <button type="button" class="cfg-secret-toggle" data-toggle="cfg-BB_MANAGER_API">👁</button></div>
        <label>API Key · bot (bb-…) — mensajes y control</label>
        <div class="cfg-secret-row"><input id="cfg-BB_API_KEY" type="password" value="${v('BB_API_KEY')}"/>
          <button type="button" class="cfg-secret-toggle" data-toggle="cfg-BB_API_KEY">👁</button></div>
        <div class="cfg-section__foot"><button class="btn btn-primary btn-sm" data-save="bot">💾 Guardar</button></div>
      `)}
      ${this.seccion('wa','💬 Plantilla de WhatsApp (al asignar)', `
        <p class="muted" style="font-size:0.78rem">Variables: {paciente} {servicio} {tratamiento} {profesional} {fechaTexto} {complemento}</p>
        <div class="cfg-template"><textarea id="cfg-WA_TEMPLATE_ASIGNADA" rows="12">${v('WA_TEMPLATE_ASIGNADA')}</textarea></div>
        <div class="cfg-section__foot"><button class="btn btn-primary btn-sm" data-save="wa">💾 Guardar</button></div>
      `)}`;
    // acordeón
    $$('[data-cfg-toggle]',cont).forEach(h=>h.addEventListener('click',()=>{ h.parentElement.classList.toggle('open'); }));
    // toggles secretos
    $$('[data-toggle]',cont).forEach(b=>b.addEventListener('click',()=>{ const i=$('#'+b.dataset.toggle); i.type=i.type==='password'?'text':'password'; b.textContent=i.type==='password'?'👁':'🙈'; }));
    // guardar
    $$('[data-save]',cont).forEach(b=>b.addEventListener('click',()=>this.guardar(b.dataset.save)));
    // usuarios
    $('#cfg-usr-nuevo')?.addEventListener('click',()=>this.modalUsuario(null));
    $$('[data-usr]',cont).forEach(el=>el.addEventListener('click',()=>{ const u=this.usuarios.find(x=>x.id===el.dataset.usr); if(u) this.modalUsuario(u); }));
  },
  seccion(key,titulo,body){
    const open = key==='usuarios' ? 'open' : '';
    return `<section class="cfg-section ${open}">
      <button type="button" class="cfg-section__head" data-cfg-toggle="${key}">
        <span class="cfg-section__title">${titulo}</span>
        <svg class="cfg-section__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="cfg-section__body">${body}</div></section>`;
  },
  renderUsuarios(){
    const list=this.usuarios.map(u=>{
      const ini=String(u.nombre||'?').trim().charAt(0).toUpperCase();
      const rk=u.rol.toLowerCase();
      return `<article class="usr-card" data-usr="${u.id}">
        <div class="usr-card__avatar usr-card__avatar--${rk}">${ini}</div>
        <div class="usr-card__body"><h4 class="usr-card__name">${escapeHtml(u.nombre)}</h4>
        <span class="usr-chip usr-chip--${rk}">${u.rol}</span> <span class="muted">PIN: ${escapeHtml(u.pin)}</span></div>
      </article>`;
    }).join('');
    return `<div class="usr-list">${list||'<p class="muted">Sin usuarios.</p>'}</div>
      <button class="btn btn-accent btn-block mt-md" id="cfg-usr-nuevo">+ Nuevo usuario</button>`;
  },
  modalUsuario(u){
    const isNew=!u; const x=u||{nombre:'',pin:'',rol:'GENERAL',activo:'SI'};
    Swal.fire({
      title:isNew?'Nuevo usuario':'Editar usuario',
      html:`<div style="text-align:left">
        <label>Nombre</label><input id="u-nombre" value="${escapeHtml(x.nombre)}" placeholder="NOMBRE COMPLETO"/>
        <label>PIN (4 dígitos)</label><input id="u-pin" maxlength="4" inputmode="numeric" value="${escapeHtml(x.pin)}"/>
        <label>Rol</label><select id="u-rol">
          <option value="GENERAL" ${x.rol==='GENERAL'?'selected':''}>GENERAL</option>
          <option value="DESARROLLADOR" ${x.rol==='DESARROLLADOR'?'selected':''}>DESARROLLADOR</option>
        </select>
        <label>Activo</label><select id="u-activo">
          <option value="SI" ${x.activo!=='NO'?'selected':''}>Sí</option>
          <option value="NO" ${x.activo==='NO'?'selected':''}>No</option></select>
      </div>`,
      width:480, showCancelButton:true, confirmButtonText:isNew?'Crear':'Guardar', cancelButtonText:'Cancelar',
      showDenyButton:!isNew, denyButtonText:'Eliminar', reverseButtons:true,
      preConfirm:()=>{
        const nombre=$('#u-nombre').value.trim(), pin=$('#u-pin').value.trim();
        if(nombre.length<3){ Swal.showValidationMessage('Nombre muy corto'); return false; }
        if(!/^\d{4}$/.test(pin)){ Swal.showValidationMessage('PIN debe tener 4 dígitos'); return false; }
        return { id:u?u.id:null, nombre, pin, rol:$('#u-rol').value, activo:$('#u-activo').value };
      }
    }).then(async r=>{
      if(r.isDenied){
        const ok=await confirmar('Eliminar usuario',`¿Eliminar a <b>${escapeHtml(x.nombre)}</b>?`,'Sí, eliminar');
        if(ok){ startLoading(); try{ await apiPost('eliminarUsuario',withUser({id:u.id})); stopLoading(); Toast&&Toast.fire({icon:'success',title:'Usuario eliminado'}); this.cargar(); }catch(e){ stopLoading(); alertErr('Error',e.message); } }
      } else if(r.isConfirmed){
        startLoading();
        try{ await apiPost('upsertUsuario',withUser(r.value)); stopLoading(); Toast&&Toast.fire({icon:'success',title:isNew?'Usuario creado':'Usuario actualizado'}); this.cargar(); }
        catch(e){ stopLoading(); alertErr('Error',e.message); }
      }
    });
  },
  async guardar(seccion){
    let claves=[];
   if(seccion==='bot') claves=['BB_ENDPOINT_BASE','BB_BOT_ID','BB_PROJECT_ID','BB_MANAGER_API','BB_API_KEY'];
    else if(seccion==='wa') claves=['WA_TEMPLATE_ASIGNADA'];
    const obj={}; claves.forEach(k=>{ const el=$('#cfg-'+k); if(el) obj[k]=el.value; });
    startLoading();
    try{ await apiPost('setConfig',withUser({config:obj})); claves.forEach(k=>this.cfg[k]=obj[k]); stopLoading(); Toast&&Toast.fire({icon:'success',title:'Guardado'}); }
    catch(e){ stopLoading(); alertErr('Error',e.message); }
  }
};

/* ============================================================
   NAVEGACIÓN + PWA + ARRANQUE
   ============================================================ */
function setupNav(){
  document.addEventListener('click',(e)=>{
    const t=e.target.closest('[data-go]'); if(!t) return;
    const dest=t.dataset.go;
    if(dest==='inicio') irAInicio(); else showView(dest);
  });
  $('#btn-logout')?.addEventListener('click',async()=>{ if(await confirmar('Cerrar sesión','¿Salir de la aplicación?','Sí, salir')) logout(); });
}

/* PWA install */
let deferredPrompt=null;
function isStandalone(){ return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true; }
function isIOS(){ return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; }
function setupInstall(){
  $('#btn-install')?.addEventListener('click',async()=>{
    // Flujo iOS: instrucciones con GIF (idéntico a Ramírez Group)
    if(isIOS()){
      Swal.fire({
        icon:'info',
        title:'¡Para Instalar en tu iPhone!',
        html:`
          <div style="text-align:center; margin-top:8px;">
            <img src="https://res.cloudinary.com/dqqeavica/image/upload/v1780053848/heartsync_ojmqxm.gif" alt="Instalación de iOS"
                 style="width:180px; max-width:70vw; height:auto; display:block; margin:0 auto 12px;">
            <div style="margin-top:10px;">
              <b>1.</b> Toca Compartir.<br><b>2.</b> Elige "Agregar a pantalla de inicio".<br><b>3.</b> Confirma "Agregar".
            </div>
          </div>`
      });
      return;
    }
    // Android: requiere beforeinstallprompt
    if(!deferredPrompt){ Swal.fire({icon:'info',title:'Instalación no disponible todavía'}); return; }
    const dp=deferredPrompt;
    dp.prompt();
    const choice=await dp.userChoice;
    deferredPrompt=null;
    if(choice.outcome==='accepted'){
      Swal.fire({
        icon:'success',
        title:'¡App instalándose!',
        html:`
          <div style="text-align:center; margin-top:8px;">
            <img src="https://res.cloudinary.com/dqqeavica/image/upload/v1780053848/heartsync_ojmqxm.gif" alt="Instalando app"
                 style="width:180px; max-width:70vw; height:auto; display:block; margin:0 auto 12px;">
            <div>Debes esperar unos segundos mientras el sistema instala la App.</div>
            <div style="margin-top:10px;">
              <b>Al desaparecer este aviso, puedes salir de esta vista. La App aparecerá en la pantalla principal de este dispositivo.</b>
            </div>
          </div>`,
        timer:12000,
        showConfirmButton:false
      });
    } else {
      Swal.fire({icon:'info',title:'Instalación cancelada'});
    }
  });
  ['btn-cont-web','btn-cont-web-ios'].forEach(id=>$('#'+id)?.addEventListener('click',iniciarSesion));
}
  $('#btn-install')?.addEventListener('click',async()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; });
  ['btn-cont-web','btn-cont-web-ios'].forEach(id=>$('#'+id)?.addEventListener('click',iniciarSesion));

async function setupPWA(){
  if('serviceWorker' in navigator){ try{ await navigator.serviceWorker.register('./sw.js'); }catch(e){} }
  if(isStandalone()) iniciarSesion();
  else { showView('instalar'); $('#install-ios')?.classList.toggle('hidden',!isIOS()); $('#install-android')?.classList.toggle('hidden',isIOS()); }
}
function iniciarSesion(){
  const saved=localStorage.getItem(SESSION_KEY);
  if(saved){ try{ state.user=JSON.parse(saved); irAInicio(); return; }catch(e){} }
  showView('login');
}

/* Versión / auto-update */
async function checkVersion(){
  try{
    const r=await fetch('./version.js?t='+Date.now(),{cache:'no-store'}); if(!r.ok) return;
    const j=await r.json(); const sv=String(j.version||'').trim(); if(!sv) return;
    if(!APP_VERSION_LOADED){ APP_VERSION_LOADED=sv; ['#app-version-number','#app-version-number-2','#app-version-number-3'].forEach(s=>{const el=$(s); if(el) el.textContent='Versión '+sv;}); return; }
    if(sv!==APP_VERSION_LOADED){ try{ const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); }catch(e){} location.reload(); }
  }catch(e){}
}

window.addEventListener('DOMContentLoaded',()=>{
  setupLogin();
  setupNav();
  setupInstall();
  setupPWA();
  checkVersion();
  setInterval(checkVersion,5*60*1000);
  Solicitudes.setupListeners();
  Pacientes.setupListeners();
  Bot.setupListeners();
});
