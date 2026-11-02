(function(){
  "use strict";

  /* ---------------- CONFIG / CONSTANTS ---------------- */
  const TIPOS = ["Furto","Roubo","Agressão","Vandalismo","Ameaça"];
  const KEY_OCC = "occurrences_v2";   // v2: base com o Quilombo
  // Tempo mínimo do skeleton. Hoje os dados vêm do localStorage (instantâneo);
  // com a API real o skeleton fica na tela durante o fetch de verdade.
  const SKELETON_MIN_MS = 600;

  const BAIRROS = [
    {nome:"Centro Norte", lat:-15.5950, lng:-56.0925},
    {nome:"Coxipó", lat:-15.6350, lng:-56.0700},
    {nome:"CPA", lat:-15.5750, lng:-56.0500},
    {nome:"Jardim das Palmeiras", lat:-15.5650, lng:-56.0850},
    {nome:"Boa Esperança", lat:-15.5450, lng:-56.0650},
    {nome:"Osmar Cabral", lat:-15.5550, lng:-56.1150},
    {nome:"Pascoal Ramos", lat:-15.6500, lng:-56.1200},
    {nome:"Verdão", lat:-15.6100, lng:-56.0800},
    {nome:"Grande Terceiro", lat:-15.6250, lng:-56.1000},
    {nome:"Bandeirantes", lat:-15.6050, lng:-56.1150},
    // Bairro do escopo do TAP. Centro aproximado pelo CEP 78045-010 (Rua dos Nhambiquaras): confirmar no mapa.
    {nome:"Quilombo", lat:-15.5821, lng:-56.0925}
  ];

  /* deterministic PRNG for reproducible synthetic seed data */
  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function seedOccurrences(){
    const rnd = mulberry32(20260905);
    const list = [];
    let idc = 1;
    const now = new Date();
    BAIRROS.forEach(b=>{
      const count = 12 + Math.floor(rnd()*14);
      for(let i=0;i<count;i++){
        const daysAgo = Math.floor(rnd()*365);
        const dt = new Date(now.getTime() - daysAgo*86400000);
        const tipo = TIPOS[Math.floor(rnd()*TIPOS.length)];
        list.push({
          id: "OC" + String(idc++).padStart(4,"0"),
          data_hora: dt.toISOString().slice(0,10),
          tipo_ocorrencia: tipo,
          bairro: b.nome,
          lat: b.lat + (rnd()-0.5)*0.018,
          lng: b.lng + (rnd()-0.5)*0.018,
          descricao_resumida: "Registro simulado sem identificação de pessoas envolvidas.",
          fonte: "Boletim de ocorrência (simulado)",
          data_atualizacao: now.toISOString().slice(0,10),
          status: "ativo"
        });
      }
    });
    return list;
  }

  /* ---------------- STORAGE LAYER ----------------
     Usa o localStorage do navegador. Cada navegador guarda sua própria cópia.
     Só as ocorrências (dados fictícios de demonstração) ficam aqui; a posição
     do usuário NUNCA (RN-G2). Para dados reais, troque loadOccurrences() por
     uma chamada à API (ex.: fetch('/api/ocorrencias')); o skeleton já cobre a espera. */
  function readKey(key){
    try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch(e){ return null; }
  }
  function writeKey(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch(e){ console.error('Falha ao salvar', e); return false; }
  }
  async function loadOccurrences(){
    const saved = readKey(KEY_OCC);
    if(Array.isArray(saved) && saved.length) return saved;
    const seeded = seedOccurrences();
    writeKey(KEY_OCC, seeded);
    return seeded;
  }
  /* ---------------- UTILS ---------------- */
  const esc = UI.esc;
  // avisos passam sempre pelo componente UI.toast (SweetAlert2 com cara de notificação)
  function toast(msg, tipo){ UI.toast(msg, tipo || 'info'); }
  /* distância em metros entre dois pontos (fórmula de Haversine) */
  function distM(lat1,lng1,lat2,lng2){
    const R = 6371000, toR = Math.PI/180;
    const dLat = (lat2-lat1)*toR, dLng = (lng2-lng1)*toR;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toR)*Math.cos(lat2*toR)*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
  }
  function fmtDist(m){ return m < 1000 ? Math.round(m)+' m' : (m/1000).toFixed(1).replace('.',',')+' km'; }
  function tipoCounts(items){
    const c = {};
    items.forEach(o=>{ c[o.tipo_ocorrencia] = (c[o.tipo_ocorrencia]||0)+1; });
    return Object.entries(c).sort((a,b)=>b[1]-a[1]);
  }
  const $ = id => document.getElementById(id);
  const fmtData = iso => iso.slice(8,10) + '/' + iso.slice(5,7) + '/' + iso.slice(0,4);
  const CHEVRON = '<svg class="cell-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  const CHECK = '<span class="check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>';

  /* ---------------- STATE ---------------- */
  let occurrences = [];
  let filtered = [];
  let map, heatLayer, occLayerGroup, bairroLayerGroup, searchLayer;
  let searchPoint = null;
  let pinsVisible = false;
  let periodSeg = null;   // controle segmentado do período (UI.segmented)
  const NEAR_RADIUS = 1000; // raio, em metros, do resumo "perto de você"
  const CITY_CENTER = [-15.601, -56.0979];

  /* ---------------- HEAT LAYER (canvas, no external plugin) ---------------- */
  const HeatLayer = L.Layer.extend({
    initialize(points, options){
      this._points = points || [];
      this._opt = Object.assign({radius:28, maxOpacity:0.82}, options);
    },
    setPoints(points){ this._points = points; this._redraw(); },
    onAdd(map){
      this._map = map;
      this._canvas = L.DomUtil.create('canvas','heat-canvas');
      map.getPanes().overlayPane.appendChild(this._canvas);
      map.on('moveend zoomend resize', this._reset, this);
      this._reset();
    },
    onRemove(map){
      L.DomUtil.remove(this._canvas);
      map.off('moveend zoomend resize', this._reset, this);
    },
    _reset(){
      const size = this._map.getSize();
      const topLeft = this._map.containerPointToLayerPoint([0,0]);
      L.DomUtil.setPosition(this._canvas, topLeft);
      this._canvas.width = size.x; this._canvas.height = size.y;
      this._redraw();
    },
    _circle(r){
      const c = document.createElement('canvas');
      c.width = c.height = r*2;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(r,r,0,r,r,r);
      g.addColorStop(0,'rgba(0,0,0,1)');
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,r*2,r*2);
      return c;
    },
    _gradient(){
      if(this._gcache) return this._gcache;
      const c = document.createElement('canvas');
      c.width = 1; c.height = 256;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0,0,0,256);
      g.addColorStop(0.00,'#4a0d12');
      g.addColorStop(0.40,'#c4161c');
      g.addColorStop(0.72,'#ff6b2c');
      g.addColorStop(1.00,'#ffd23f');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,1,256);
      this._gcache = ctx.getImageData(0,0,1,256).data;
      return this._gcache;
    },
    _redraw(){
      if(!this._map || !this._canvas) return;
      const ctx = this._canvas.getContext('2d');
      ctx.clearRect(0,0,this._canvas.width,this._canvas.height);
      if(!this._points.length) return;
      const r = this._opt.radius;
      const off = document.createElement('canvas');
      off.width = this._canvas.width; off.height = this._canvas.height;
      const octx = off.getContext('2d');
      const circle = this._circle(r);
      this._points.forEach(p=>{
        const cp = this._map.latLngToContainerPoint([p.lat,p.lng]);
        if(cp.x < -r || cp.y < -r || cp.x > off.width+r || cp.y > off.height+r) return;
        octx.globalAlpha = 0.5;
        octx.drawImage(circle, cp.x-r, cp.y-r);
      });
      let img;
      try{ img = octx.getImageData(0,0,off.width,off.height); } catch(e){ return; }
      const data = img.data;
      const grad = this._gradient();
      for(let i=3;i<data.length;i+=4){
        const a = data[i];
        if(a){
          const idx = a*4;
          data[i-3] = grad[idx]; data[i-2] = grad[idx+1]; data[i-1] = grad[idx+2];
          data[i] = Math.min(a, 255*this._opt.maxOpacity);
        }
      }
      ctx.putImageData(img,0,0);
    }
  });

  /* ---------------- MAPA BASE (OpenStreetMap) ----------------
     Mapa vetorial escuro do OpenFreeMap, feito com dados do OpenStreetMap.
     É gratuito e não precisa de chave de API. Carregado no Leaflet pelo
     plugin @maplibre/maplibre-gl-leaflet.
     Se o navegador não tiver WebGL ou o estilo não carregar, usa tiles
     raster escuros (CARTO, também com dados do OSM).                     */
  const OSM_STYLE = 'https://tiles.openfreemap.org/styles/dark';
  const OSM_ATTRIB = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
    '&copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
    'Dados &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  let baseLayer = null, usingFallback = false;

  function hasWebGL(){
    try{
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    }catch(e){ return false; }
  }

  /* skeleton do mapa (item 2): some com fade quando o mapa base carrega */
  let mapReady = false;
  function hideMapSkeleton(){
    if(mapReady) return;
    mapReady = true;
    const s = $('mapSkeleton');
    if(!s) return;
    s.classList.add('done');
    setTimeout(()=>s.remove(), 700);
  }

  function useRasterFallback(reason){
    if(usingFallback) return;
    usingFallback = true;
    console.warn('Mapa vetorial indisponível, usando raster:', reason);
    if(baseLayer){ map.removeLayer(baseLayer); map.attributionControl.removeAttribution(OSM_ATTRIB); }
    baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO',
      subdomains:'abcd', maxZoom: 19
    }).addTo(map);
    baseLayer.once('load', hideMapSkeleton);
  }

  function addBaseMap(){
    if(!L.maplibreGL || !window.maplibregl || !hasWebGL()){
      useRasterFallback('sem WebGL ou plugin');
      return;
    }
    try{
      baseLayer = L.maplibreGL({ style: OSM_STYLE }).addTo(map);
      // o plugin não publica o crédito no Leaflet; a licença do OSM exige que ele apareça
      map.attributionControl.addAttribution(OSM_ATTRIB);
      const ml = baseLayer.getMaplibreMap();
      let loaded = false;
      ml.on('load', ()=>{ loaded = true; hideMapSkeleton(); });
      ml.on('error', e=>{ if(!loaded) useRasterFallback(e && e.error ? e.error.message : 'erro no estilo'); });
      setTimeout(()=>{ if(!loaded) useRasterFallback('tempo esgotado'); }, 10000);
    }catch(e){
      useRasterFallback(e.message);
    }
  }

  /* ---------------- MAP INIT ---------------- */
  function initMap(){
    map = L.map('map', {zoomControl:false, minZoom:4, maxZoom:19})
      .setView(CITY_CENTER, 12);
    addBaseMap();
    setTimeout(hideMapSkeleton, 12000);   // nunca deixa o skeleton preso na tela
    L.control.scale({position:'bottomleft', imperial:false}).addTo(map);
    heatLayer = new HeatLayer([]).addTo(map);
    occLayerGroup = L.layerGroup().addTo(map);
    bairroLayerGroup = L.layerGroup().addTo(map);
    searchLayer = L.layerGroup().addTo(map);
    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);
    map.on('zoomend', ()=>{
      renderPointMarkers(!pinsVisible);   // os alfinetes só "caem" quando aparecem
      const note = $('legendNote');
      if(note) note.textContent = map.getZoom() >= 14
        ? 'Clique num ícone para ver a ocorrência.'
        : 'Aproxime o mapa para ver cada ocorrência.';
    });
  }

  /* ---------------- FILTERING ---------------- */
  function selectedTipos(){
    return Array.from(document.querySelectorAll('#typeChecks input:checked')).map(i=>i.value);
  }
  function applyFilters(opts){
    const from = $('dateFrom').value;
    const to = $('dateTo').value;
    const tipos = selectedTipos();
    const inPeriod = occurrences.filter(o=>{
      if(o.status === 'inativo') return false;
      if(from && o.data_hora < from) return false;
      if(to && o.data_hora > to) return false;
      return true;
    });
    filtered = tipos.length ? inPeriod.filter(o=>tipos.includes(o.tipo_ocorrencia)) : inPeriod;
    renderTypeCounts(inPeriod, tipos);
    renderAll(opts);
    // RN-G7: com a localização ligada, o contador acompanha os filtros
    if(GEO.ultimaPos && (GEO.estado === 'ativo' || GEO.estado === 'pausado')) atualizarProximidade(true);
  }

  function renderAll(opts){
    heatLayer.setPoints(filtered.map(o=>({lat:o.lat,lng:o.lng,weight:1})));
    renderBairroMarkers();
    renderPointMarkers(true);
    $('emptyState').classList.toggle('show', filtered.length === 0);
    UI.countTo($('statTotal'), filtered.length);
    UI.countTo($('countPill'), filtered.length);
    generateSummary(opts && opts.animate);
    const view = $('detailPanel').dataset.view;
    if(view === 'me' && GEO.ultimaPos) showNearMe(false);
    if(view === 'search' && searchPoint) showPointSummary(searchPoint, 'search', false);
  }

  function renderBairroMarkers(){
    bairroLayerGroup.clearLayers();
    BAIRROS.forEach(b=>{
      const items = filtered.filter(o=>o.bairro === b.nome);
      const icon = L.divIcon({
        className:'',
        html:`<div class="bairro-label">${b.nome} · <b>${items.length}</b></div>`,
        iconSize:[0,0]
      });
      const marker = L.marker([b.lat,b.lng], {icon}).addTo(bairroLayerGroup);
      marker.on('click', ()=>showBairroSummary(b, items));
    });
  }

  /* ---------------- ÍCONES POR TIPO ----------------
     Conjunto único de ícones: selo redondo com degradê, contorno branco e
     brilho, com um desenho branco/colorido no centro. No mapa o selo vira
     um alfinete (com ponta), igual ao Waze; nos filtros e painéis aparece
     só o selo redondo. Os degradês ficam num <svg> de definições único.  */
  const ICON_THEME = {
    'Furto':      {id:'furto',      c1:'#FFC15A', c2:'#F07A12', base:'#ff9f1c'},
    'Roubo':      {id:'roubo',      c1:'#FF6B6B', c2:'#C3121C', base:'#ff4d4d'},
    'Agressão':   {id:'agressao',   c1:'#FF7AA2', c2:'#C21A55', base:'#ff5c8a'},
    'Vandalismo': {id:'vandalismo', c1:'#4FD0F2', c2:'#1572B6', base:'#3fb8e8'},
    'Ameaça':     {id:'ameaca',     c1:'#B887F0', c2:'#6326A8', base:'#a774e6'}
  };

  (function injectIconDefs(){
    const grads = Object.values(ICON_THEME).map(t=>`
      <linearGradient id="ig-${t.id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${t.c1}"/><stop offset="1" stop-color="${t.c2}"/>
      </linearGradient>`).join('');
    const defs = document.createElement('div');
    defs.setAttribute('aria-hidden','true');
    // não pode ser display:none, senão os degradês não aparecem em alguns navegadores
    defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    defs.innerHTML = `<svg width="0" height="0"><defs>${grads}
      <linearGradient id="ig-gloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <clipPath id="ig-clip"><circle cx="24" cy="24" r="19"/></clipPath>
    </defs></svg>`;
    document.body.prepend(defs);
  })();

  /* desenho central de cada tipo (sistema de coordenadas 48x48, centro 24,24) */
  const ICON_GLYPH = {
    // Furto — mascarado de gorro
    'Furto': `
      <circle cx="24" cy="28.5" r="10" fill="#FFDDB8"/>
      <path d="M13.6 22 Q13.8 9.8 24 9.8 Q34.2 9.8 34.4 22 Z" fill="#262A35"/>
      <rect x="12.6" y="19" width="22.8" height="4.2" rx="2.1" fill="#3A4050"/>
      <circle cx="24" cy="9.4" r="2.4" fill="#3A4050"/>
      <rect x="13.4" y="23.6" width="21.2" height="6.4" rx="3.2" fill="#1B1E26"/>
      <ellipse cx="19.4" cy="26.8" rx="2.2" ry="1.7" fill="#fff"/>
      <ellipse cx="28.6" cy="26.8" rx="2.2" ry="1.7" fill="#fff"/>
      <circle cx="19.8" cy="26.9" r=".95" fill="#1B1E26"/>
      <circle cx="29" cy="26.9" r=".95" fill="#1B1E26"/>
      <path d="M21 33.6 q3 1.9 6 0" stroke="#A35F33" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,

    // Roubo — mascarado com sacola de dinheiro
    'Roubo': `
      <g clip-path="url(#ig-clip)">
        <path d="M8.5 46 Q9.5 31.5 24 31.5 Q38.5 31.5 39.5 46 Z" fill="#fff"/>
        <path d="M19.5 31.8 L24 36.5 L28.5 31.8" stroke="#E2E4EA" stroke-width="1.4" fill="none"/>
      </g>
      <circle cx="24" cy="20.5" r="7.6" fill="#FFDDB8"/>
      <path d="M16.3 20 Q16.2 11.6 24 11.6 Q31.8 11.6 31.7 20 Q28.4 16.2 24 16.4 Q19.6 16.2 16.3 20 Z" fill="#262A35"/>
      <rect x="16.1" y="18.4" width="15.8" height="4.8" rx="2.4" fill="#1B1E26"/>
      <ellipse cx="21" cy="20.8" rx="1.6" ry="1.2" fill="#fff"/>
      <ellipse cx="27" cy="20.8" rx="1.6" ry="1.2" fill="#fff"/>
      <path d="M30.6 27.4 l1.3 -1.9 h3.4 l1.3 1.9 q-.9 1.4 -3 1.4 q-2.1 0 -3 -1.4z" fill="#E0A21A"/>
      <circle cx="33.6" cy="34.6" r="6.6" fill="#FFCB3D" stroke="#C88A0E" stroke-width="1.1"/>
      <rect x="30.4" y="27.9" width="6.4" height="1.6" rx=".8" fill="#9A6608"/>
      <text x="33.6" y="38.1" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="9.5" fill="#7A4E00">$</text>`,

    // Agressão — rosto bravo (o próprio selo é o rosto)
    'Agressão': `
      <path d="M11 16.2 L21.6 20.4 L20.6 23.4 L10 19.4 Z" fill="#3D0A1C"/>
      <path d="M37 16.2 L26.4 20.4 L27.4 23.4 L38 19.4 Z" fill="#3D0A1C"/>
      <path d="M13.6 29 a5.4 5.4 0 0 1 10.8 0 Z" fill="#fff"/>
      <path d="M23.6 29 a5.4 5.4 0 0 1 10.8 0 Z" fill="#fff"/>
      <path d="M16.7 29 a2.6 2.6 0 0 1 5.2 0 Z" fill="#3D0A1C"/>
      <path d="M26.1 29 a2.6 2.6 0 0 1 5.2 0 Z" fill="#3D0A1C"/>
      <path d="M16.4 37.6 Q24 31.2 31.6 37.6" stroke="#3D0A1C" stroke-width="3" fill="none" stroke-linecap="round"/>`,

    // Vandalismo — lata de spray pichando
    'Vandalismo': `
      <path d="M27.6 12.6 Q33 7.8 38.6 10.2 Q36.4 14.8 38 19 Q32.4 18.8 28.6 15.8 Z" fill="#FFE14D" opacity=".35"/>
      <g transform="rotate(-22 23 27)">
        <rect x="16.6" y="19.4" width="13.6" height="19" rx="3.2" fill="#F5F8FB"/>
        <rect x="16.6" y="19.4" width="13.6" height="3.2" rx="1.6" fill="#CFD9E2"/>
        <rect x="16.6" y="25.4" width="13.6" height="6.2" fill="#FF4D6D"/>
        <rect x="16.6" y="31.6" width="13.6" height="1.3" fill="#D93454"/>
        <rect x="27" y="22" width="1.8" height="14" rx=".9" fill="#fff" opacity=".7"/>
        <rect x="20.6" y="15.4" width="5.6" height="4.4" rx="1.1" fill="#1D3A4E"/>
        <rect x="22.2" y="13" width="2.4" height="2.8" rx=".6" fill="#1D3A4E"/>
      </g>
      <circle cx="29.2" cy="13" r="1.7" fill="#FFE14D"/>
      <circle cx="32.6" cy="10.6" r="1.5" fill="#FFE14D"/>
      <circle cx="33" cy="15" r="1.9" fill="#FFE14D"/>
      <circle cx="36.4" cy="12.4" r="1.3" fill="#FFE14D"/>
      <circle cx="36.6" cy="16.8" r="1.4" fill="#FFE14D"/>
      <circle cx="35.2" cy="8.4" r="1" fill="#FFE14D"/>
      <circle cx="31" cy="17.8" r="1" fill="#FFE14D"/>`,

    // Ameaça — balão de fala com exclamação
    'Ameaça': `
      <path d="M15.2 12.6 h17.6 a4.2 4.2 0 0 1 4.2 4.2 v10.4 a4.2 4.2 0 0 1 -4.2 4.2 h-8.6 l-6.4 5.4 v-5.4 h-2.6 a4.2 4.2 0 0 1 -4.2 -4.2 v-10.4 a4.2 4.2 0 0 1 4.2 -4.2 z" fill="#fff"/>
      <rect x="22.3" y="15.6" width="3.4" height="9" rx="1.7" fill="#5A2290"/>
      <circle cx="24" cy="27.7" r="1.9" fill="#5A2290"/>`
  };

  /* selo redondo: base + brilho + desenho */
  function badgeSvg(tipo){
    const t = ICON_THEME[tipo];
    return `
      <circle cx="24" cy="24" r="21.5" fill="#fff"/>
      <circle cx="24" cy="24" r="19" fill="url(#ig-${t.id})"/>
      <ellipse cx="24" cy="13.5" rx="13.5" ry="7.5" fill="url(#ig-gloss)"/>
      ${ICON_GLYPH[tipo]}`;
  }

  /* ícone redondo para filtros, legenda e painéis */
  function iconHtml(tipo, size){
    if(!ICON_THEME[tipo]){
      return `<span class="ico" style="width:${size}px;height:${size}px;border-radius:50%;background:${tipoColor(tipo)};display:inline-block;"></span>`;
    }
    return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"
      style="display:inline-block;flex-shrink:0;" aria-hidden="true">${badgeSvg(tipo)}</svg>`;
  }

  /* alfinete para o mapa: selo + ponta + sombra no chão; a ponta marca o local */
  function pinHtml(tipo, w){
    const h = Math.round(w * 60/48);
    return `<svg class="pin" width="${w}" height="${h}" viewBox="0 0 48 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="24" cy="56.5" rx="6.5" ry="2.2" fill="#000" opacity=".38"/>
      <path d="M15.5 39 L24 54 L32.5 39 Z" fill="#fff"/>
      <path d="M18.6 39 L24 49.4 L29.4 39 Z" fill="${ICON_THEME[tipo].c2}"/>
      ${badgeSvg(tipo)}
    </svg>`;
  }

  const MARKER_ICONS = {};
  function markerIcon(tipo){
    if(!MARKER_ICONS[tipo]){
      const w = 38, h = Math.round(w * 60/48);
      MARKER_ICONS[tipo] = ICON_THEME[tipo]
        ? L.divIcon({className:'occ-marker', html:pinHtml(tipo, w), iconSize:[w,h], iconAnchor:[w/2, Math.round(h*54/60)]})
        : L.divIcon({className:'occ-marker', html:iconHtml(tipo, 24), iconSize:[24,24], iconAnchor:[12,12]});
    }
    return MARKER_ICONS[tipo];
  }

  /* animate=false: só mudou o zoom com os alfinetes já na tela, então eles não "caem" de novo */
  function renderPointMarkers(animate){
    $('map').classList.toggle('pins-static', !animate);
    occLayerGroup.clearLayers();
    pinsVisible = map.getZoom() >= 14;
    if(!pinsVisible) return;
    filtered.forEach(o=>{
      L.marker([o.lat,o.lng], {icon:markerIcon(o.tipo_ocorrencia), title:o.tipo_ocorrencia, alt:o.tipo_ocorrencia, zIndexOffset:500})
        .on('click', ()=>showOccurrenceDetail(o))
        .addTo(occLayerGroup);
    });
  }

  function tipoColor(tipo){
    return (ICON_THEME[tipo] && ICON_THEME[tipo].base) || '#ff4d4d';
  }

  /* ---------------- DETAIL PANEL ----------------
     setDetail troca o conteúdo; se o painel já estiver aberto, o conteúdo novo
     entra com um fade curto em vez de trocar "seco" (item 5).                 */
  function setDetail(html, view){
    const panel = $('detailPanel'), content = $('detailContent');
    if(view) panel.dataset.view = view;
    content.innerHTML = html;
    if(panel.classList.contains('show')){
      content.classList.remove('swap'); void content.offsetWidth; content.classList.add('swap');
    }
  }
  function openDetail(){
    const panel = $('detailPanel');
    const jaAberto = panel.classList.contains('show');
    panel.classList.add('show');
    // no celular o painel é uma gaveta: o botão voltar fecha
    if(!jaAberto && UI.isMobile()) UI.layers.open('detail', closeDetail);
  }
  function closeDetail(){
    const panel = $('detailPanel');
    if(!panel.classList.contains('show')) return;
    panel.classList.remove('show');
    UI.layers.close('detail');
  }

  /* peças do painel de detalhes, montadas com os componentes de lista (.list-group / .cell.kv) */
  const kv = (rotulo, valor, mono) =>
    `<div class="cell kv"><span class="cell-title">${rotulo}</span><span class="kv-value${mono ? ' mono' : ''}">${valor}</span></div>`;
  const kvTipo = (t, c) =>
    `<div class="cell kv has-ico"><span class="cell-ico">${iconHtml(t,28)}</span><span class="cell-title">${t}</span><span class="kv-value mono">${c}</span></div>`;
  const grupo = itens => `<div class="list-group compact">${itens.join('')}</div>`;
  const cabecalho = (titulo, sub, icone) =>
    `<div class="detail-head">${icone || ''}<div><h3>${titulo}</h3>${sub ? `<p>${sub}</p>` : ''}</div></div>`;
  const nota = txt => `<p class="detail-note">${txt}</p>`;

  function showOccurrenceDetail(o){
    setDetail(
      cabecalho(o.tipo_ocorrencia, 'Ocorrência ' + o.id, iconHtml(o.tipo_ocorrencia, 44)) +
      grupo([kv('Data', fmtData(o.data_hora), true), kv('Bairro', esc(o.bairro)),
             kv('Fonte', esc(o.fonte)), kv('Atualizado em', fmtData(o.data_atualizacao), true)]) +
      nota(esc(o.descricao_resumida) || 'Sem descrição adicional.'), 'occ');
    openDetail();
    UI.haptic('light');
  }
  function showBairroSummary(b, items, opts){
    const mover = !(opts && opts.mover === false);
    if(!items.length){
      setDetail(cabecalho(b.nome, 'Resumo do bairro') +
        nota('Nenhum registro disponível para o período e filtros selecionados nesta região.'), 'bairro');
      openDetail(); return;
    }
    let lastDate = "0000-00-00";
    items.forEach(o=>{ if(o.data_hora > lastDate) lastDate = o.data_hora; });
    setDetail(
      cabecalho(b.nome, 'Resumo do bairro · ' + periodoTexto()) +
      `<div class="detail-kpi"><strong>${items.length}</strong><span>registros no período</span></div>` +
      grupo(tipoCounts(items).map(([t,c]) => kvTipo(t, c))) +
      grupo([kv('Registro mais recente', fmtData(lastDate), true)]) +
      nota('Resumo calculado sobre os dados filtrados. Não representa risco futuro para a região.'), 'bairro');
    openDetail();
    if(mover){ pararDeSeguir(); map.flyTo([b.lat,b.lng], Math.max(map.getZoom(),14), {duration:.6}); }
  }

  /* ---------------- SUMMARY (RF12) ----------------
     O resumo é recalculado sozinho a cada mudança de filtro:
     contagem por tipo (na lista de tipos) e ranking de bairros.          */
  function renderTypeCounts(base, selected){
    const counts = {};
    base.forEach(o=>{ counts[o.tipo_ocorrencia] = (counts[o.tipo_ocorrencia]||0)+1; });
    const max = Math.max(1, ...TIPOS.map(t=>counts[t]||0));
    TIPOS.forEach(t=>{
      const row = document.querySelector(`.type-row[data-tipo="${t}"]`);
      if(!row) return;
      const n = counts[t] || 0;
      UI.countTo(row.querySelector('.n'), n, 450);
      row.querySelector('.bar i').style.width = (n/max*100) + '%';
    });
    $('typeChecks').classList.toggle('filtering', selected.length > 0);
    $('btnClearTypes').classList.toggle('hidden', selected.length === 0);
    // "Limpar" da barra só fica ativo quando há algum filtro ligado
    const periodoAtivo = !document.querySelector('#presetRow .preset[data-days="0"]').classList.contains('active');
    $('btnResetFilters').disabled = !periodoAtivo && selected.length === 0;
    $('periodLabel').textContent = periodoTexto();
  }

  function periodoTexto(){
    const act = document.querySelector('#presetRow .preset.active');
    const d = act ? act.dataset.days : '0';
    if(d === 'custom'){
      const de = $('dateFrom').value, ate = $('dateTo').value;
      if(de && ate) return fmtData(de) + ' a ' + fmtData(ate);
      if(de) return 'Desde ' + fmtData(de);
      if(ate) return 'Até ' + fmtData(ate);
      return 'Período personalizado';
    }
    return {'30':'Últimos 30 dias','90':'Últimos 90 dias','365':'Últimos 12 meses'}[d] || 'Todo o período';
  }

  function generateSummary(animate){
    const list = $('rankList');
    const byBairro = {};
    filtered.forEach(o=>{ byBairro[o.bairro] = (byBairro[o.bairro]||0)+1; });
    const top = Object.entries(byBairro).sort((a,b)=>b[1]-a[1]).slice(0,5);
    if(!top.length){
      list.innerHTML = '<li class="list-empty">Nenhum registro para os filtros atuais.</li>';
      return;
    }
    const max = top[0][1];
    list.innerHTML = top.map(([nome,c], i)=>`
      <li><button type="button" class="cell" data-bairro="${esc(nome)}">
        <span class="rank-n">${i + 1}</span>
        <span class="cell-main"><span class="cell-title">${esc(nome)}</span><span class="bar"><i style="width:${c/max*100}%"></i></span></span>
        <span class="n">${c}</span>${CHEVRON}
      </button></li>`).join('');
    if(animate) UI.stagger(list, 45);
  }
  function abrirBairroDoRanking(nome){
    const b = BAIRROS.find(x=>x.nome === nome);
    if(!b) return;
    searchLayer.clearLayers(); searchPoint = null;
    pararDeSeguir();
    map.flyTo([b.lat,b.lng], 14, {duration:.6});
    showBairroSummary(b, filtered.filter(o=>o.bairro === b.nome), {mover:false});
    closeSheet();
  }

  /* limpar todos os filtros (barra da gaveta e estado vazio) */
  function limparFiltros(){
    document.querySelectorAll('#typeChecks input:checked').forEach(i=>{ i.checked = false; });
    $('dateFrom').value = ''; $('dateTo').value = '';
    $('dateRow').classList.add('hidden');
    if(periodSeg) periodSeg.select(document.querySelector('#presetRow .preset[data-days="0"]'), true);
    applyFilters();
    UI.haptic('light');
  }

  /* ---------------- SKELETON (item 2) ----------------
     Enquanto <body> tem .is-loading, os elementos marcados com .sk viram
     blocos cinza (ver css). O ranking ganha linhas falsas do mesmo tamanho. */
  function showListSkeletons(){
    $('rankList').innerHTML = UI.skeleton(5, i => `
      <li class="cell-skel" aria-hidden="true">
        ${UI.skel('26px','26px')}
        <span class="lines">${UI.skel((80 - i*9) + '%','12px','line')}${UI.skel('100%','4px','line')}</span>
        ${UI.skel('24px','12px')}
      </li>`);
  }
  function startLoading(){
    document.body.classList.remove('loaded');
    document.body.classList.add('is-loading');
    showListSkeletons();
  }
  function finishLoading(){
    applyFilters({animate:true});
    document.body.classList.remove('is-loading');
    document.body.classList.add('loaded');
    UI.stagger($('typeChecks'), 35);
  }

  /* ---------------- SEARCH ---------------- */
  /* Busca de endereço: Nominatim, a API de geocodificação do OpenStreetMap.
     Regras de uso: no máximo 1 busca por segundo e nada de autocompletar,
     por isso a consulta só roda quando a pessoa confirma a busca.          */
  const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
  const CUIABA_VIEWBOX = '-56.30,-15.40,-55.90,-15.80'; // oeste,norte,leste,sul (inclui Várzea Grande)
  let lastGeocode = 0, geocoding = false;

  async function geocode(text){
    const wait = 1100 - (Date.now() - lastGeocode);
    if(wait > 0) await new Promise(r=>setTimeout(r, wait));
    lastGeocode = Date.now();
    const params = new URLSearchParams({
      q: text, format: 'jsonv2', limit: '1', countrycodes: 'br',
      'accept-language': 'pt-BR', viewbox: CUIABA_VIEWBOX, bounded: '1', addressdetails: '0'
    });
    const res = await fetch(`${NOMINATIM}?${params}`, {headers:{'Accept':'application/json'}});
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return data[0] || null;
  }

  async function doSearch(){
    const input = $('searchInput');
    const raw = input.value.trim();
    const term = raw.toLowerCase();
    if(!term){ UI.shake(document.querySelector('.search')); toast('Digite um bairro ou endereço.', 'warning'); return; }

    const b = BAIRROS.find(x=>x.nome.toLowerCase() === term) ||
              BAIRROS.find(x=>x.nome.toLowerCase().includes(term));
    if(b){
      searchLayer.clearLayers(); searchPoint = null;
      pararDeSeguir();
      map.setView([b.lat,b.lng], 14);
      showBairroSummary(b, filtered.filter(o=>o.bairro === b.nome), {mover:false});
      input.blur();
      return;
    }

    if(geocoding) return;
    geocoding = true;
    const btn = $('btnSearch');
    btn.disabled = true; btn.textContent = '…';
    try{
      const r = await geocode(raw);
      if(!r){ toast('Endereço não encontrado em Cuiabá/Várzea Grande. Tente "rua, número, bairro".', 'warning'); return; }
      searchPoint = {lat:parseFloat(r.lat), lng:parseFloat(r.lon), label:r.display_name};
      searchLayer.clearLayers();
      const pin = L.divIcon({className:'', html:'<div class="search-pin"></div>', iconSize:[26,34], iconAnchor:[13,32]});
      L.marker([searchPoint.lat,searchPoint.lng], {icon:pin, zIndexOffset:900, title:searchPoint.label})
        .on('click', ()=>showPointSummary(searchPoint, 'search', true))
        .addTo(searchLayer);
      pararDeSeguir();
      map.flyTo([searchPoint.lat,searchPoint.lng], 16, {duration:.8});
      showPointSummary(searchPoint, 'search', true);
      input.blur();
    }catch(err){
      console.error(err);
      toast('A busca de endereços está indisponível agora. Tente de novo em instantes.', 'error');
    }finally{
      geocoding = false;
      btn.disabled = false; btn.textContent = 'Ir';
    }
  }

  /* ---------------- REFRESH (RF07) ---------------- */
  async function refreshData(){
    const btn = $('btnRefresh');
    btn.disabled = true; btn.classList.add('spin');
    startLoading();
    try{
      const [data] = await Promise.all([loadOccurrences(), UI.wait(SKELETON_MIN_MS)]);
      occurrences = data;
      finishLoading();
      setUpdated();
      toast('Dados atualizados.', 'success');
    }catch(e){
      document.body.classList.remove('is-loading');
      toast('Não foi possível carregar os dados. Tente novamente.', 'error');
    }finally{
      btn.disabled = false; btn.classList.remove('spin');
    }
  }

  function setUpdated(){
    $('updatedLabel').textContent = 'às ' + new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  }

  /* ---------------- GEOLOCALIZAÇÃO EM TEMPO REAL (sprint 26–30/10) ----------------
     Estados (GEO.estado):
       desligado → buscando → ativo ⇄ sinal_fraco
       ativo / sinal_fraco / buscando → pausado (app em segundo plano) → buscando
       qualquer estado ligado → desligado (botão Desativar, permissão negada, fora da área)
     Regras RN-G1 a RN-G8: ver o documento da sprint.
     A posição existe só em memória (objeto GEO): nunca é salva nem enviada (RN-G2). */
  const GEO_RAIO = NEAR_RADIUS;     // m: "registros perto de você"
  const GEO_LIMIAR_MOVIMENTO = 50;  // m: recalcula o contador só depois de andar isso (RN-G6)
  const GEO_PRECISAO_MAX = 100;     // m: acima disso é "sinal fraco" (RN-G4)
  const GEO_COBERTURA = 5000;       // m: além disso, fora da área do protótipo (RN-G5)
  const GEO_TOLERANCIA_ERRO = 30000; // ms: erro passageiro logo após uma leitura boa é ignorado
  const GEO_OPCOES = { watch:true, setView:false, enableHighAccuracy:true, maximumAge:5000, timeout:15000 };
  const GEO_AZUL = '#3d9bff', GEO_CINZA = '#6e6e78';   // mesma cor da variável --me do CSS

  const GEO = {
    estado: 'desligado',
    marcador: null, circulo: null, anel: null,
    ultimaPos: null, precisao: null,   // última leitura recebida
    ultimaLeituraEm: 0,                // quando chegou a última leitura (ms)
    ultimaCalc: null,                  // posição do último cálculo do contador
    bairroAtual: null, proximos: 0, precisaoCalc: null,
    seguindo: true, primeiraLeitura: true
  };

  /* ---- estado e interface ---- */
  function setGeoEstado(estado, mensagem, tom){
    const anterior = GEO.estado;
    GEO.estado = estado;
    if(mensagem !== undefined){
      const st = $('geoStatus');
      st.textContent = mensagem;
      st.className = 'geo-status' + (tom ? ' ' + tom : '');
      // avisos e erros também viram toast: o painel pode estar recolhido ou fechado (celular)
      if(tom && (estado !== anterior || estado === 'desligado')) toast(mensagem, tom === 'error' ? 'error' : 'warning');
    }
    atualizarControles();
  }

  function atualizarControles(){
    const ligado = GEO.estado !== 'desligado';
    const btn = $('btnGeo');
    const rotulo = ligado ? 'Desativar localização' : 'Ativar localização em tempo real';
    btn.title = rotulo;
    btn.setAttribute('aria-label', rotulo);
    btn.setAttribute('aria-pressed', String(ligado));
    btn.classList.toggle('active', ligado);
    btn.classList.toggle('loading', GEO.estado === 'buscando');
    $('geoSwitch').checked = ligado;                    // interruptor da gaveta acompanha o botão
    const bar = $('geoBar');
    bar.classList.toggle('show', ligado);           // RN-G3: indicador visível enquanto ligado
    bar.dataset.estado = GEO.estado;
    document.body.classList.toggle('geo-on', ligado);
    $('geoBarCenter').style.display =
      (ligado && !GEO.seguindo && GEO.ultimaPos) ? '' : 'none';
    const textos = {
      buscando: 'Buscando sua posição...',
      ativo: GEO.bairroAtual ? GEO.proximos + ' registro(s) em 1 km · ' + GEO.bairroAtual.nome : 'Localização ativa',
      sinal_fraco: 'Sinal fraco · contador pausado',
      pausado: 'Pausado (app em segundo plano)'
    };
    $('geoBarText').textContent = textos[GEO.estado] || '';
  }

  /* ---- ligar / desligar (T2) ---- */
  function alternarGeo(){
    UI.haptic('light');
    if(GEO.estado === 'desligado') ativarGeo();
    else desativarGeo();
  }

  function ativarGeo(){
    if(!('geolocation' in navigator)){
      setGeoEstado('desligado', 'Seu navegador não oferece geolocalização. Use a busca por bairro.', 'error');
      return;
    }
    if(!window.isSecureContext){
      setGeoEstado('desligado', 'A localização só funciona em HTTPS (no Render já funciona). Use a busca por bairro.', 'error');
      return;
    }
    GEO.seguindo = true; GEO.primeiraLeitura = true;
    GEO.ultimaCalc = null; GEO.bairroAtual = null;
    setGeoEstado('buscando', 'Buscando sua posição... Se o navegador perguntar, permita o acesso à localização.');
    map.locate(GEO_OPCOES);   // RN-G1: só começa a partir do toque no botão
  }

  function desativarGeo(mensagem, tom){
    map.stopLocate();
    removerMarcador();
    GEO.ultimaPos = null; GEO.precisao = null; GEO.ultimaCalc = null; GEO.ultimaLeituraEm = 0;
    GEO.bairroAtual = null; GEO.proximos = 0;
    const panel = $('detailPanel');
    if(panel.dataset.view === 'me') closeDetail();
    setGeoEstado('desligado', typeof mensagem === 'string' ? mensagem : 'Localização desativada.', tom);
  }

  /* ---- marcador que se move (T3) ---- */
  function moverMarcador(latlng, precisao){
    // o círculo de precisão nunca passa do alcance de 1 km: no computador o erro do GPS
    // pode ser de vários km, e o círculo cobria o mapa inteiro
    const raio = Math.min(precisao, GEO_RAIO);
    if(!GEO.marcador){
      // camada própria acima dos ícones das ocorrências: o ponto do usuário fica sempre visível
      if(!map.getPane('geoPane')){ map.createPane('geoPane').style.zIndex = 650; }
      GEO.anel = L.circle(latlng, {radius:GEO_RAIO, color:GEO_AZUL, weight:1.5, dashArray:'6 6',
        fill:true, fillColor:GEO_AZUL, fillOpacity:.05, interactive:false}).addTo(map);
      GEO.circulo = L.circle(latlng, {radius:raio, stroke:false, fillColor:GEO_AZUL, fillOpacity:.15, interactive:false}).addTo(map);
      GEO.marcador = L.circleMarker(latlng, {pane:'geoPane', radius:8, color:'#ffffff', weight:3, fillColor:GEO_AZUL, fillOpacity:1})
        .bindTooltip('Você está aqui')
        .on('click', ()=>showNearMe(true))
        .addTo(map);
    } else {
      GEO.marcador.setLatLng(latlng);                   // move sem recriar: não pisca
      GEO.circulo.setLatLng(latlng).setRadius(raio);
      GEO.anel.setLatLng(latlng);
    }
  }

  function removerMarcador(){
    ['marcador','circulo','anel'].forEach(k=>{ if(GEO[k]){ map.removeLayer(GEO[k]); GEO[k] = null; } });
  }

  function telaEstreita(){ return window.matchMedia('(max-width: 820px)').matches; }

  function abrirPainelBairroAtual(){
    if(!GEO.bairroAtual) return;
    const b = GEO.bairroAtual;
    showBairroSummary(b, filtered.filter(o => o.bairro === b.nome), {mover:false});
  }

  function bairroMaisProximo(latlng){
    return BAIRROS.reduce((melhor, b) =>
      map.distance(latlng, [b.lat,b.lng]) < map.distance(latlng, [melhor.lat,melhor.lng]) ? b : melhor
    );
  }

  /* ---- cada nova posição ---- */
  function onLocationFound(e){
    if(GEO.estado === 'desligado' || GEO.estado === 'pausado') return;  // leitura atrasada: ignorar

    const bairro = bairroMaisProximo(e.latlng);
    if(map.distance(e.latlng, [bairro.lat,bairro.lng]) > GEO_COBERTURA){   // RN-G5
      desativarGeo('Você está fora da área coberta pelo protótipo (Cuiabá). Use a busca por bairro.', 'warn');
      return;
    }

    GEO.ultimaPos = e.latlng;
    GEO.precisao = e.accuracy;
    GEO.ultimaLeituraEm = Date.now();
    moverMarcador(e.latlng, e.accuracy);

    if(GEO.seguindo){                                   // T7: modo seguir
      if(GEO.primeiraLeitura) map.setView(e.latlng, Math.max(map.getZoom(), 15));
      else map.panTo(e.latlng);
    }
    GEO.primeiraLeitura = false;

    if(e.accuracy > GEO_PRECISAO_MAX){                  // RN-G4
      setGeoEstado('sinal_fraco',
        'Sinal fraco (precisão de ~' + Math.round(e.accuracy) + ' m). O contador volta a atualizar quando o sinal melhorar.', 'warn');
      return;
    }
    const voltou = GEO.estado !== 'ativo';
    if(voltou) setGeoEstado('ativo');
    atualizarProximidade(false);
    if(voltou) escreverStatus();   // saiu de "buscando"/"sinal fraco": tira a mensagem antiga da tela
  }

  /* ---- contador e bairro atual (T4) ---- */
  function atualizarProximidade(forcar){
    const pos = GEO.ultimaPos;
    if(!pos) return;
    if(!forcar && GEO.ultimaCalc && map.distance(GEO.ultimaCalc, pos) < GEO_LIMIAR_MOVIMENTO) return;  // RN-G6
    GEO.ultimaCalc = pos;

    // RN-G7: "filtered" já respeita período, tipo e ignora registros inativos
    GEO.proximos = filtered.filter(o => map.distance(pos, [o.lat,o.lng]) <= GEO_RAIO).length;

    const bairro = bairroMaisProximo(pos);
    const mudouBairro = !GEO.bairroAtual || GEO.bairroAtual.nome !== bairro.nome;
    GEO.bairroAtual = bairro;
    // Em tela larga o painel do bairro abre sozinho; no celular ele cobriria o mapa,
    // então a barra inferior mostra o resumo e um toque nela abre o painel.
    if(mudouBairro && !telaEstreita()){
      showBairroSummary(bairro, filtered.filter(o => o.bairro === bairro.nome), {mover:false});
    }

    GEO.precisaoCalc = GEO.precisao;
    escreverStatus();
  }

  function escreverStatus(){
    if(!GEO.bairroAtual) return;
    const st = $('geoStatus');
    st.textContent = GEO.proximos + ' registro(s) num raio de 1 km · bairro mais próximo: ' + GEO.bairroAtual.nome +
      ' · precisão de ~' + Math.round(GEO.precisaoCalc) + ' m.';
    st.className = 'geo-status';
    atualizarControles();
  }

  /* ---- erros (T5) ---- */
  function onLocationError(e){
    if(GEO.estado === 'desligado' || GEO.estado === 'pausado') return;
    if(e.code === 1){
      desativarGeo('Permissão de localização negada. Para usar, libere a localização nas configurações do navegador. A busca por bairro continua funcionando.', 'error');
      return;
    }
    // 2 (indisponível) e 3 (tempo esgotado): o acompanhamento continua tentando sozinho.
    // Logo depois de uma leitura boa, é ruído (acontece com a pessoa parada): mantém o estado atual.
    if(GEO.ultimaPos && Date.now() - GEO.ultimaLeituraEm < GEO_TOLERANCIA_ERRO) return;
    if(GEO.ultimaPos){
      setGeoEstado('sinal_fraco', 'Sem sinal de localização no momento. Continuamos tentando...', 'warn');
    } else {
      setGeoEstado('buscando', 'Ainda sem sinal de localização. Continuamos tentando; ao ar livre costuma ser mais rápido.', 'warn');
    }
  }

  /* ---- seguir / recentralizar (T7) ---- */
  function pararDeSeguir(){
    if(GEO.estado === 'desligado' || !GEO.seguindo) return;
    GEO.seguindo = false;
    atualizarControles();
  }

  function recentralizar(){
    if(!GEO.ultimaPos) return;
    GEO.seguindo = true;
    map.setView(GEO.ultimaPos, Math.max(map.getZoom(), 15));
    atualizarControles();
  }

  /* ---- segundo plano (T8, RN-G8) ---- */
  function onVisibilidade(){
    if(document.hidden){
      if(GEO.estado === 'ativo' || GEO.estado === 'sinal_fraco' || GEO.estado === 'buscando'){
        map.stopLocate();
        if(GEO.marcador) GEO.marcador.setStyle({fillColor:GEO_CINZA});
        setGeoEstado('pausado', 'Pausado enquanto o app está em segundo plano, para economizar bateria.');
      }
    } else if(GEO.estado === 'pausado'){
      if(GEO.marcador) GEO.marcador.setStyle({fillColor:GEO_AZUL});
      GEO.primeiraLeitura = !GEO.ultimaPos;
      setGeoEstado('buscando', 'Retomando a localização...');
      map.locate(GEO_OPCOES);
    }
  }

  /* ---- painel "Perto de você" (toque no ponto azul) ---- */
  function showNearMe(openPanel){
    if(GEO.ultimaPos) showPointSummary({lat:GEO.ultimaPos.lat, lng:GEO.ultimaPos.lng, acc:GEO.precisao}, 'me', openPanel);
  }

  function showPointSummary(pt, kind, openPanel){
    const panel = $('detailPanel');
    const near = filtered
      .map(o=>({o, d:distM(pt.lat,pt.lng,o.lat,o.lng)}))
      .filter(x=>x.d <= NEAR_RADIUS)
      .sort((a,b)=>a.d-b.d);
    const nearestBairro = BAIRROS
      .map(b=>({b, d:distM(pt.lat,pt.lng,b.lat,b.lng)}))
      .sort((a,b)=>a.d-b.d)[0];
    const closest = near[0];
    const isMe = kind === 'me';
    const shortLabel = !isMe && pt.label ? esc(pt.label.split(',').slice(0,3).join(',')) : '';
    const tipos = tipoCounts(near.map(x=>x.o));
    const infos = [];
    if(closest) infos.push(kv('Mais próximo', closest.o.tipo_ocorrencia + ' · ' + fmtDist(closest.d)));
    infos.push(kv('Bairro de referência', nearestBairro.b.nome + ' · ' + fmtDist(nearestBairro.d)));
    if(isMe) infos.push(kv('Precisão do GPS', '± ' + fmtDist(pt.acc || 0), true));
    setDetail(
      cabecalho(isMe ? 'Perto de você' : 'Perto deste endereço', isMe ? 'Raio de ' + fmtDist(NEAR_RADIUS) : shortLabel) +
      `<div class="detail-kpi"><strong>${near.length}</strong><span>registros em até ${fmtDist(NEAR_RADIUS)}</span></div>` +
      (tipos.length ? grupo(tipos.map(([t,c]) => kvTipo(t, c)))
        : nota('Nenhum registro nesse raio para os filtros atuais. Isso não significa que a área é segura — só que não há dados aqui.')) +
      grupo(infos) +
      nota(isMe ? 'Sua localização fica só no seu navegador; ela não é enviada nem salva.'
                : 'Endereço localizado pelo OpenStreetMap (Nominatim).'), kind);
    if(openPanel || panel.classList.contains('show')) openDetail();
  }

  /* ---------------- GAVETA DE FILTROS (celular) ---------------- */
  function openSheet(){
    const sidebar = $('sidebar');
    if(sidebar.classList.contains('open')) return;
    sidebar.classList.add('open');
    $('sheetScrim').classList.add('show');
    $('btnPanel').setAttribute('aria-expanded', 'true');
    UI.layers.open('sheet', closeSheet);
    UI.haptic('light');
  }
  function closeSheet(){
    const sidebar = $('sidebar');
    if(!sidebar.classList.contains('open')) return;
    sidebar.classList.remove('open');
    $('sheetScrim').classList.remove('show');
    $('btnPanel').setAttribute('aria-expanded', 'false');
    UI.layers.close('sheet');
  }

  /* ---------------- UI WIRING ---------------- */
  function wireUI(){
    $('btnRefresh').addEventListener('click', refreshData);
    $('btnSearch').addEventListener('click', doSearch);
    // busca: botão "limpar" (×) aparece quando há texto, como no iPhone
    $('searchInput').addEventListener('input', ()=>{ $('btnClearSearch').hidden = !$('searchInput').value; });
    $('btnClearSearch').addEventListener('click', ()=>{
      $('searchInput').value = ''; $('btnClearSearch').hidden = true;
      searchLayer.clearLayers(); searchPoint = null;
      $('searchInput').focus();
    });
    // sugestões de bairro (componente UI.suggest) — registrado antes do Enter da busca
    const semAcento = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    UI.suggest($('searchInput'), {
      source: termo => BAIRROS
        .filter(b => semAcento(b.nome).includes(semAcento(termo)))
        .map(b => ({label:b.nome, sub: filtered.filter(o=>o.bairro === b.nome).length + ' registros no período'})),
      extra: termo => BAIRROS.some(b => semAcento(b.nome) === semAcento(termo))
        ? null : {label:'Buscar “' + termo + '” como endereço'},
      onPick: () => doSearch()
    });
    $('searchInput').addEventListener('keydown', e=>{ if(e.key==='Enter') doSearch(); });
    $('btnZoomIn').addEventListener('click', ()=>map.zoomIn());
    $('btnZoomOut').addEventListener('click', ()=>map.zoomOut());

    const collapseBtn = $('btnCollapse');
    collapseBtn.addEventListener('click', ()=>{
      const collapsed = $('sidebar').classList.toggle('collapsed');
      collapseBtn.setAttribute('aria-expanded', !collapsed);
      collapseBtn.title = collapsed ? 'Expandir painel' : 'Recolher painel';
    });

    $('btnClearTypes').addEventListener('click', ()=>{
      document.querySelectorAll('#typeChecks input:checked').forEach(i=>{ i.checked = false; });
      applyFilters();
    });
    $('btnResetFilters').addEventListener('click', limparFiltros);
    $('btnEmptyReset').addEventListener('click', limparFiltros);
    $('btnSheetDone').addEventListener('click', closeSheet);
    $('rankList').addEventListener('click', e=>{
      const cel = e.target.closest('.cell[data-bairro]');
      if(cel) abrirBairroDoRanking(cel.dataset.bairro);
    });
    $('btnGeo').addEventListener('click', alternarGeo);
    // interruptor "Localização em tempo real" da gaveta faz o mesmo que o botão do mapa
    $('geoSwitch').addEventListener('change', ()=>{
      const ligar = $('geoSwitch').checked;
      if(ligar !== (GEO.estado !== 'desligado')) alternarGeo();
    });
    $('geoBarOff').addEventListener('click', () => desativarGeo());
    $('geoBarCenter').addEventListener('click', recentralizar);
    $('geoBarText').addEventListener('click', abrirPainelBairroAtual);
    map.on('dragstart', pararDeSeguir);                  // arrastar o mapa desliga o modo seguir
    document.addEventListener('visibilitychange', onVisibilidade);

    // gaveta de filtros (celular): abre pelo botão, fecha tocando fora, arrastando ou com "voltar"
    $('btnPanel').addEventListener('click', ()=>{
      if($('sidebar').classList.contains('open')) closeSheet(); else openSheet();
    });
    $('sheetScrim').addEventListener('click', closeSheet);
    UI.draggableSheet($('sidebar'), [document.querySelector('.sheet-handle'), document.querySelector('.sheet-nav')], closeSheet);
    map.on('click', closeSheet);

    document.addEventListener('keydown', e=>{
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if(e.key === '/' && !typing){ e.preventDefault(); $('searchInput').focus(); return; }
      if(e.key !== 'Escape') return;
      if(window.Swal && Swal.isVisible()) return;       // o próprio alerta trata o Esc
      if($('sidebar').classList.contains('open')){ closeSheet(); return; }
      closeDetail();
    });

    $('detailClose').addEventListener('click', closeDetail);
    UI.draggableSheet($('detailPanel'), [document.querySelector('#detailPanel .sheet-grabber')], closeDetail, 'show');

    $('dateFrom').addEventListener('change', applyFilters);
    $('dateTo').addEventListener('change', applyFilters);

    // período: controle segmentado (componente UI.segmented)
    periodSeg = UI.segmented($('presetRow'), {onChange: p => {
      const dateRow = $('dateRow');
      if(p.dataset.days === 'custom'){
        dateRow.classList.remove('hidden');
        $('dateFrom').focus();
        return;
      }
      dateRow.classList.add('hidden');
      const days = parseInt(p.dataset.days,10);
      if(days === 0){
        $('dateFrom').value = '';
        $('dateTo').value = '';
      } else {
        const to = new Date();
        const from = new Date(to.getTime() - days*86400000);
        $('dateFrom').value = from.toISOString().slice(0,10);
        $('dateTo').value = to.toISOString().slice(0,10);
      }
      applyFilters();
    }});

    TIPOS.forEach(t=>{
      const wrap = document.createElement('label');
      wrap.className = 'cell type-row';
      wrap.dataset.tipo = t;
      // célula de lista: ícone, nome + barra, número e marca ✓; .sk = vira skeleton enquanto carrega
      wrap.innerHTML = `<input type="checkbox" value="${t}"><span class="cell-ico ico-wrap sk">${iconHtml(t,28)}</span>
        <span class="cell-main"><span class="cell-title sk">${t}</span><span class="bar"><i style="background:${tipoColor(t)}"></i></span></span>
        <span class="n sk">0</span>${CHECK}`;
      wrap.querySelector('input').addEventListener('change', ()=>{ UI.haptic('light'); applyFilters(); });
      $('typeChecks').appendChild(wrap);
    });

  }

  /* ---------------- BOOT ---------------- */
  async function boot(){
    initMap();
    wireUI();
    startLoading();
    const [data] = await Promise.all([loadOccurrences(), UI.wait(SKELETON_MIN_MS)]);
    occurrences = data;
    finishLoading();
    setUpdated();
  }
  boot();

})();
