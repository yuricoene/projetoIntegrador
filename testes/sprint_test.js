// T9 — testes automatizados da sprint de geolocalização em tempo real
// Atualizado em 02/11/2026: a lista de bairros agora é o componente de sugestões (UI.suggest).
// Atualizado em 10/11/2026: busca por bairro como filtro, desempenho do zoom e tema claro/escuro.
// Atualizado em 10/11/2026 (2): chave do tema estilo interruptor e gaveta da busca presa no topo (celular).
const {chromium, devices} = require('playwright');
const path = require('path'), fs = require('fs');
// roda a partir de projeto-integrador/testes/: o app está na pasta de cima
const APP = path.resolve(__dirname, '..'), LD = path.dirname(require.resolve('leaflet/dist/leaflet.js'));
const BASE = 'http://localhost:8765/';
const Q = {lat:-15.5821, lng:-56.0925};
const mover = (p, dn, de) => ({latitude: p.lat + dn/111320, longitude: p.lng + de/(111320*Math.cos(p.lat*Math.PI/180))});
const results = [];
const ok = (nome, cond, info='') => { results.push({nome, ok: !!cond, info}); console.log((cond?'PASS':'FAIL')+' | '+nome+(info?' | '+info:'')); };

async function abrir(browser, opts={}){
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const reqs = [];
  await page.route('**/*', r => {
    const u = r.request().url(); reqs.push(u + ' ' + (r.request().postData()||''));
    if(u.includes('leaflet.min.js')) return r.fulfill({body:fs.readFileSync(LD+'/leaflet.js'),contentType:'application/javascript'});
    if(u.includes('leaflet.min.css')) return r.fulfill({body:fs.readFileSync(LD+'/leaflet.css'),contentType:'text/css'});
    if(u.startsWith(BASE)){ const f = APP + '/' + u.slice(BASE.length).split('?')[0];
      return r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'}); }
    return r.abort();
  });
  await page.addInitScript(() => {
    window.__geoCalls = 0;
    const g = navigator.geolocation;
    for(const k of ['watchPosition','getCurrentPosition']){ const f = g[k].bind(g); g[k] = (...a) => { window.__geoCalls++; return f(...a); }; }
  });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if(m.type()==='error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(BASE + 'index.html'); await page.waitForTimeout(700);
  return {ctx, page, reqs, errs};
}
const status = p => p.textContent('#geoStatus');
const estado = p => p.getAttribute('#geoBar','data-estado');
const userDot = p => p.evaluate(() => { const el=[...document.querySelectorAll('.leaflet-geo-pane path.leaflet-interactive')]; return {n:el.length, d: el[0] && el[0].getAttribute('d'), fill: el[0] && el[0].getAttribute('fill')}; });
const circulos = p => p.evaluate(() => { const w = el => el ? el.getBoundingClientRect().width : 0;
  return {anel: w(document.querySelector('.leaflet-overlay-pane path[stroke-dasharray]')), precisao: w(document.querySelector('.leaflet-overlay-pane path[stroke="none"]'))}; });
const rotulos = p => p.$$eval('.bairro-label', ds => ds.map(d=>d.textContent.trim()));
const pixelsCalor = p => p.evaluate(() => { const c=document.querySelector('canvas.heat-canvas'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]) n++; return n; });
// cor média (r,g,b) dos pixels pintados do mapa de calor
const corCalor = p => p.evaluate(() => { const c=document.querySelector('canvas.heat-canvas'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let r=0,g=0,b=0,n=0; for(let i=0;i<d.length;i+=4) if(d[i+3]){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++; } return n ? [r/n,g/n,b/n].map(Math.round) : null; });
// arrasta com o dedo (eventos de toque reais pelo protocolo do Chrome): dy > 0 puxa para baixo
async function puxar(p, sel, dy){
  const h = await p.locator(sel).boundingBox(); const x = h.x + h.width/2, y = h.y + h.height/2;
  const c = await p.context().newCDPSession(p);
  await c.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x, y}]});
  for(let i=1;i<=10;i++){ await c.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x, y: y + dy*i/10}]}); await p.waitForTimeout(25); }
  await c.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]}); await p.waitForTimeout(700);
}
const gaveta = p => p.evaluate(() => document.body.dataset.sheet);
const knobX = p => p.$eval('#btnTheme .ts-knob', e => new DOMMatrix(getComputedStyle(e).transform).m41);
const opac = (p, sel) => p.$eval(sel, e => +getComputedStyle(e).opacity);
const sobrepoe = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

(async () => {
  const browser = await chromium.launch();
  {
    const p0 = mover(Q, 0, 0);
    const {ctx, page, reqs, errs} = await abrir(browser, {viewport:{width:1280,height:760}, geolocation:{...p0, accuracy:20}, permissions:['geolocation']});
    ok('RN-G1: nada de localização ao abrir a página', await page.evaluate(()=>window.__geoCalls)===0);
    await page.fill('#searchInput','quil'); await page.waitForTimeout(300);
    ok('Quilombo aparece nas sugestões de bairro', (await page.$$eval('.suggest-item .suggest-label', os=>os.map(o=>o.textContent))).includes('Quilombo'));
    await page.fill('#searchInput',''); await page.locator('#searchInput').blur(); await page.waitForTimeout(200);
    ok('Indicador escondido enquanto desligado', !(await page.isVisible('#geoBar')));
    await page.click('#btnGeo'); await page.waitForTimeout(1200);
    const s1 = await status(page);
    ok('Ativar: estado ativo e indicador visível', await estado(page)==='ativo' && await page.isVisible('#geoBar'), s1);
    ok('Ativar: botão marcado como ligado', await page.getAttribute('#btnGeo','aria-pressed')==='true');
    ok('Ativar: contador e bairro calculados', /registro\(s\) num raio de 1 km · bairro mais próximo: Quilombo · precisão de ~20 m/.test(s1));
    ok('Ativar: barra mostra contador e bairro', /registro\(s\) em 1 km · Quilombo/.test(await page.textContent('#geoBarText')));
    ok('Ativar: painel do bairro aberto', (await page.textContent('#detailContent')).includes('Quilombo'));
    const dot1 = await userDot(page);
    ok('Ponto azul desenhado', dot1.n===1 && dot1.fill==='#1f7bff');
    await ctx.setGeolocation({...mover(Q, 30, 0), accuracy:25}); await page.waitForTimeout(900);
    const dot2 = await userDot(page);
    ok('T3: ponto se move sem recriar camada', dot2.n===1 && dot2.d!==dot1.d);
    ok('RN-G6: 30 m não recalcula o contador', (await status(page))===s1);
    await ctx.setGeolocation({...mover(Q, 430, 0), accuracy:15}); await page.waitForTimeout(900);
    const s3 = await status(page);
    ok('RN-G6: depois de 430 m o contador é recalculado', s3!==s1 && /~15 m/.test(s3), s3);
    const antes = await status(page);
    await page.click('#presetRow .preset[data-days="30"]'); await page.waitForTimeout(400);
    const depois = await status(page);
    const nA = +antes.match(/^(\d+)/)[1], nD = +depois.match(/^(\d+)/)[1];
    ok('RN-G7: filtro de período atualiza o contador na hora', nD < nA, `${nA} → ${nD}`);
    await page.click('#presetRow .preset[data-days="0"]'); await page.waitForTimeout(300);
    await page.evaluate(() => { const el = document.querySelector('.leaflet-geo-pane path.leaflet-interactive'); el.dispatchEvent(new MouseEvent('click', {bubbles:true})); });
    await page.waitForTimeout(300);
    ok('Tocar no ponto azul abre "Perto de você"', (await page.textContent('#detailContent')).includes('Perto de você'));
    ok('T7: Recentralizar escondido enquanto segue', !(await page.isVisible('#geoBarCenter')));
    const box = await page.locator('#map').boundingBox();
    await page.mouse.move(box.x+box.width/2, box.y+box.height/2); await page.mouse.down();
    await page.mouse.move(box.x+box.width/2-200, box.y+box.height/2-120, {steps:8}); await page.mouse.up();
    await page.waitForTimeout(300);
    ok('T7: arrastar o mapa desliga o seguir (aparece Recentralizar)', await page.isVisible('#geoBarCenter'));
    await ctx.setGeolocation({...mover(Q, 480, 0), accuracy:15}); await page.waitForTimeout(800);
    ok('T7: sem seguir, nova posição não arrasta o mapa de volta', await page.isVisible('#geoBarCenter'));
    await page.click('#geoBarCenter'); await page.waitForTimeout(500);
    ok('T7: Recentralizar volta a seguir', !(await page.isVisible('#geoBarCenter')));
    await page.fill('#searchInput','Coxipó'); await page.click('#btnSearch'); await page.waitForTimeout(300);
    ok('T7: buscar um bairro também desliga o seguir', await page.isVisible('#geoBarCenter'));
    await page.click('#geoBarCenter'); await page.waitForTimeout(300);
    await page.evaluate(()=>{ Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(300);
    ok('RN-G8: segundo plano pausa', await estado(page)==='pausado', await page.textContent('#geoBarText'));
    await page.evaluate(()=>{ Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(1200);
    ok('RN-G8: ao voltar, retoma sozinho', await estado(page)==='ativo');
    const userLat = mover(Q, 480, 0).latitude.toFixed(4);
    const ls = await page.evaluate(()=>JSON.stringify(localStorage));
    ok('RN-G2: posição não está no armazenamento do navegador', !ls.includes(userLat) && !/geo|posi/i.test(Object.keys(JSON.parse(ls)).join()), 'chaves: '+Object.keys(JSON.parse(ls)).join(', '));
    ok('RN-G2: posição não aparece em nenhuma requisição', !reqs.some(r=>r.includes(userLat)));
    await page.click('#geoBarOff'); await page.waitForTimeout(400);
    ok('RN-G3: Desativar remove o ponto e esconde o indicador', (await userDot(page)).n===0 && !(await page.isVisible('#geoBar')));
    ok('RN-G3: botão volta a desligado', await page.getAttribute('#btnGeo','aria-pressed')==='false');
    await ctx.setGeolocation({...mover(Q, 600, 0), accuracy:15}); await page.waitForTimeout(700);
    ok('Desligado: novas posições são ignoradas', (await userDot(page)).n===0);
    ok('Sem erros no console', errs.length===0, errs.join(' / '));
    await ctx.close();
  }
  {
    const {ctx, page} = await abrir(browser, {permissions:[]});
    await page.click('#btnGeo'); await page.waitForTimeout(1200);
    ok('Negado: mensagem e volta a desligado', /negada/.test(await status(page)) && !(await page.isVisible('#geoBar')), await status(page));
    ok('Negado: aviso também aparece na tela (toast)', /negada/.test(await page.textContent('#toast')));
    await page.fill('#searchInput','Coxipó'); await page.click('#btnSearch'); await page.waitForTimeout(300);
    ok('Negado: busca por bairro continua funcionando', (await page.textContent('#detailContent')).includes('Coxipó'));
    await ctx.close();
  }
  {
    const {ctx, page} = await abrir(browser, {geolocation:{latitude:-23.55, longitude:-46.63, accuracy:20}, permissions:['geolocation']});
    await page.click('#btnGeo'); await page.waitForTimeout(1200);
    ok('Fora da área: nada marcado e sugestão de busca', /fora da área/.test(await status(page)) && (await userDot(page)).n===0);
    await ctx.close();
  }
  {
    const {ctx, page} = await abrir(browser, {geolocation:{...mover(Q,0,0), accuracy:150}, permissions:['geolocation']});
    await page.click('#btnGeo'); await page.waitForTimeout(1200);
    ok('Sinal fraco: aviso e contador congelado', await estado(page)==='sinal_fraco' && /Sinal fraco/.test(await status(page)), await status(page));
    await ctx.setGeolocation({...mover(Q,0,0), accuracy:20}); await page.waitForTimeout(900);
    ok('Sinal fraco → ativo quando a precisão melhora', await estado(page)==='ativo');
    await ctx.close();
  }
  {
    const {ctx, page} = await abrir(browser, {viewport:{width:1280,height:760}, geolocation:{...mover(Q,0,0), accuracy:3000}, permissions:['geolocation']});
    await page.click('#btnGeo'); await page.waitForTimeout(1200);
    const c = await circulos(page);
    ok('Precisão de 3 km: círculo azul não passa do anel de 1 km', c.anel > 0 && c.precisao > 0 && c.precisao <= c.anel + 1, `anel ${Math.round(c.anel)}px · precisão ${Math.round(c.precisao)}px`);
    ok('Precisão de 3 km: o texto continua mostrando a precisão real', /~3000 m/.test(await status(page)), await status(page));
    await ctx.setGeolocation({...mover(Q,0,0), accuracy:300}); await page.waitForTimeout(900);
    const c2 = await circulos(page);
    ok('Precisão de 300 m: círculo menor que o anel', c2.precisao > 0 && c2.precisao < c.anel * 0.5, `anel ${Math.round(c2.anel)}px · precisão ${Math.round(c2.precisao)}px`);
    await ctx.close();
  }
  // ---------- Busca por bairro filtra o mapa (10/11) ----------
  {
    const {ctx, page, errs} = await abrir(browser, {viewport:{width:1280,height:760}, geolocation:{...mover(Q,0,0), accuracy:20}, permissions:['geolocation']});
    await page.waitForTimeout(400);
    ok('Busca: sem busca, os 11 bairros aparecem no mapa', (await rotulos(page)).length===11);
    ok('Busca: aviso de filtro escondido no início', !(await page.isVisible('#bairroChip')));
    await page.fill('#searchInput','Coxipó'); await page.click('#btnSearch'); await page.waitForTimeout(600);
    const rs = await rotulos(page);
    ok('Busca: só o rótulo do bairro buscado fica no mapa', rs.length===1 && rs[0].startsWith('Coxipó'), rs.join(', '));
    ok('Busca: aviso "Só Coxipó · Mostrar todos" aparece', await page.isVisible('#bairroChip') && (await page.textContent('#bairroChipNome'))==='Coxipó');
    const nCox = +rs[0].match(/(\d+)$/)[1];
    await page.waitForTimeout(500);
    ok('Busca: total no mapa = registros do bairro', +(await page.textContent('#statTotal'))===nCox, `${await page.textContent('#statTotal')} de ${nCox}`);
    ok('Busca: ranking só com o bairro buscado', (await page.$$eval('#rankList .cell[data-bairro]', els=>els.map(e=>e.dataset.bairro))).join()==='Coxipó');
    ok('Busca: alfinetes no mapa = registros do bairro', (await page.$$eval('.occ-marker', els=>els.length))===nCox, `${await page.$$eval('.occ-marker', els=>els.length)} de ${nCox}`);
    ok('Busca: total do painel mostra o bairro', /Coxipó/.test(await page.textContent('#periodLabel')));
    ok('Busca: "Limpar" fica ativo com o filtro de bairro', !(await page.isDisabled('#btnResetFilters')));
    await page.fill('#searchInput','cpa'); await page.waitForTimeout(300);
    const sub = await page.$$eval('.suggest-item .suggest-sub', s=>s.map(x=>x.textContent));
    ok('Busca: sugestões contam os outros bairros mesmo com filtro', sub.length>0 && !/^0 /.test(sub[0]), sub.join(' | '));
    await page.fill('#searchInput','Coxipó'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    ok('Busca: digitar não tira o filtro', (await rotulos(page)).length===1);
    await page.click('#presetRow .preset[data-days="30"]'); await page.waitForTimeout(400);
    const rs30 = await rotulos(page);
    ok('Busca + período de 30 dias: continua só no bairro buscado', rs30.length===1 && rs30[0].startsWith('Coxipó'), rs30.join(', '));
    await page.click('#presetRow .preset[data-days="0"]'); await page.waitForTimeout(300);
    await page.click('#btnBairroChipClear'); await page.waitForTimeout(400);
    ok('Busca: "Mostrar todos" volta os 11 bairros', (await rotulos(page)).length===11 && !(await page.isVisible('#bairroChip')));
    ok('Busca: "Mostrar todos" limpa o campo de busca', (await page.inputValue('#searchInput'))==='');
    await page.fill('#searchInput','CPA'); await page.click('#btnSearch'); await page.waitForTimeout(400);
    await page.click('#btnClearSearch'); await page.waitForTimeout(400);
    ok('Busca: o × do campo volta a mostrar tudo', (await rotulos(page)).length===11);
    await page.fill('#searchInput','CPA'); await page.click('#btnSearch'); await page.waitForTimeout(400);
    await page.click('#btnResetFilters'); await page.waitForTimeout(400);
    ok('Busca: "Limpar" do painel também tira o filtro de bairro', (await rotulos(page)).length===11 && !(await page.isVisible('#bairroChip')));
    await page.fill('#searchInput','Coxipó'); await page.click('#btnSearch'); await page.waitForTimeout(400);
    await page.click('#btnGeo'); await page.waitForTimeout(1200);
    ok('Busca: ativar a localização tira o filtro de bairro', (await rotulos(page)).length===11 && !(await page.isVisible('#bairroChip')) && await estado(page)==='ativo');
    ok('Busca: sem erros', errs.length===0, errs.join(' / '));
    await ctx.close();
  }

  // ---------- Desempenho do zoom (10/11) ----------
  {
    const {ctx, page, errs} = await abrir(browser, {viewport:{width:1280,height:760}});
    await page.waitForTimeout(400);
    ok('Zoom: mapa de calor anima junto com o zoom', await page.$eval('canvas.heat-canvas', c=>c.classList.contains('leaflet-zoom-animated')));
    ok('Zoom: mapa de calor desenhado', await pixelsCalor(page) > 0);
    ok('Zoom 12: sem alfinetes', (await page.$$eval('.occ-marker', els=>els.length))===0);
    await page.fill('#searchInput','Quilombo'); await page.click('#btnSearch'); await page.waitForTimeout(500);
    await page.click('#btnBairroChipClear'); await page.waitForTimeout(600);
    const n = await page.$$eval('.occ-marker', els => { els.forEach(e=>e.dataset.marca='1'); return els.length; });
    ok('Zoom 14: alfinetes aparecem', n>0, n+' alfinetes');
    ok('Zoom: alfinetes sem filtro CSS (drop-shadow)', await page.$$eval('.occ-marker .pin', els => els.every(e=>getComputedStyle(e).filter==='none')));
    await page.evaluate(()=>{ window.__longas=[]; new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__longas.push(Math.round(e.duration)))).observe({type:'longtask'}); });
    for(let i=0;i<3;i++){ await page.click('#btnZoomIn'); await page.waitForTimeout(400); await page.click('#btnZoomOut'); await page.waitForTimeout(400); }
    const mantidos = await page.$$eval('.occ-marker[data-marca]', els=>els.length);
    ok('Zoom: alfinetes não são recriados a cada zoom', mantidos===n, `${mantidos}/${n} mantidos`);
    ok('Zoom: mapa de calor redesenhado depois dos zooms', await pixelsCalor(page) > 0);
    const longas = await page.evaluate(()=>window.__longas);
    ok('Zoom: nenhuma tarefa longa (> 100 ms) em 6 zooms', !longas.some(d=>d>100), longas.length ? longas.join(', ')+' ms' : 'nenhuma acima de 50 ms');
    ok('Zoom: vidro volta a desfocar quando o mapa para', !(await page.evaluate(()=>document.body.classList.contains('map-moving'))));
    await page.click('#btnZoomOut'); await page.waitForTimeout(500);
    ok('Zoom 13: alfinetes saem do mapa', (await page.$$eval('.occ-marker', els=>els.length))===0);
    ok('Zoom: sem erros', errs.length===0, errs.join(' / '));
    await ctx.close();
  }

  // ---------- Tema claro (sol) / escuro (lua) — computador (10/11) ----------
  {
    const {ctx, page, errs} = await abrir(browser, {viewport:{width:1280,height:760}, geolocation:{...mover(Q,0,0), accuracy:20}, permissions:['geolocation']});
    await page.waitForTimeout(400);
    const tema = () => page.evaluate(()=>document.documentElement.dataset.theme);
    const fundo = () => page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
    ok('Tema: abre no claro (padrão do grupo)', await tema()==='light' && await fundo()==='rgb(236, 239, 243)', await fundo());
    ok('Tema claro: chave laranja com SOL, bolinha à esquerda', await opac(page,'#btnTheme .ts-bg-claro')===1 && await opac(page,'#btnTheme .ts-sol')===1 && await opac(page,'#btnTheme .ts-lua')===0 && await knobX(page)===0);
    ok('Tema claro: chave é um interruptor "Tema escuro" desligado', await page.getAttribute('#btnTheme','role')==='switch' && await page.getAttribute('#btnTheme','aria-label')==='Tema escuro' && await page.getAttribute('#btnTheme','aria-checked')==='false');
    ok('Tema: chave fica na linha da busca', await page.$eval('#btnTheme', b=>!!b.closest('.search-row')));
    const total0 = await page.textContent('#statTotal'), cor0 = await corCalor(page);
    await page.click('#btnTheme'); await page.waitForTimeout(700);
    ok('Tema: botão troca para o escuro', await tema()==='dark' && await fundo()==='rgb(11, 16, 24)', await fundo());
    ok('Tema escuro: chave preta com LUA, bolinha deslizou para a direita', await opac(page,'#btnTheme .ts-bg-escuro')===1 && await opac(page,'#btnTheme .ts-lua')===1 && await opac(page,'#btnTheme .ts-sol')===0 && await knobX(page)===28, 'bolinha x='+await knobX(page));
    ok('Tema escuro: interruptor ligado', await page.getAttribute('#btnTheme','aria-checked')==='true' && await page.getAttribute('#btnTheme','title')==='Mudar para o tema claro');
    ok('Tema escuro: barra do navegador e color-scheme escuros', await page.getAttribute('meta[name="theme-color"]','content')==='#0b1018' && await page.getAttribute('meta[name="color-scheme"]','content')==='dark');
    ok('Tema escuro: legenda com a escala de calor escura', /74, 13, 18/.test(await page.$eval('.legend-bar', e=>getComputedStyle(e).backgroundImage)));
    const cor1 = await corCalor(page);
    ok('Tema escuro: mapa de calor redesenhado com as cores escuras', cor0 && cor1 && cor1[1] < cor0[1] - 20, `claro rgb(${cor0}) → escuro rgb(${cor1})`);
    ok('Tema escuro: filtros e total não mudam', await page.textContent('#statTotal')===total0);
    ok('Tema: escolha salva neste aparelho', await page.evaluate(()=>localStorage.getItem('tema'))==='dark');
    await page.click('#btnGeo'); await page.waitForTimeout(1200);
    ok('Tema escuro: ponto azul usa o azul do tema escuro', (await userDot(page)).fill==='#3d9bff');
    await page.click('#btnTheme'); await page.waitForTimeout(700);
    ok('Tema: outro toque na chave volta ao claro', await tema()==='light' && await page.evaluate(()=>localStorage.getItem('tema'))==='light' && await page.getAttribute('#btnTheme','aria-checked')==='false');
    await page.focus('#btnTheme'); await page.keyboard.press('Space'); await page.waitForTimeout(500);
    ok('Tema: a chave funciona pelo teclado (espaço)', await tema()==='dark');
    await page.keyboard.press('Space'); await page.waitForTimeout(500);
    ok('Tema claro: ponto azul volta ao azul do claro', (await userDot(page)).fill==='#1f7bff');
    await page.click('#btnGeo'); await page.waitForTimeout(300);
    await page.click('#btnTheme'); await page.waitForTimeout(300);
    // recarrega: o tema já vem aplicado antes de a página aparecer (sem piscar)
    await page.goto(BASE + 'index.html', {waitUntil:'commit'});
    const noInicio = await page.evaluate(()=>new Promise(r=>{ const f=()=>r(document.documentElement.dataset.theme); document.readyState==='loading' ? document.addEventListener('DOMContentLoaded', f) : f(); }));
    await page.waitForTimeout(700);
    ok('Tema: ao reabrir, já começa escuro (sem piscar no claro)', noInicio==='dark' && await tema()==='dark', 'no carregamento: '+noInicio);
    ok('Tema: sem erros', errs.length===0, errs.join(' / '));
    await ctx.close();
  }

  // ---------- Celular (mobile first): gaveta da busca no topo + chave do tema ----------
  for(const [nome, dev] of [['iPhone 14', devices['iPhone 14']], ['Android pequeno (Galaxy S8)', devices['Galaxy S8']]]){
    const {ctx, page, errs} = await abrir(browser, {...dev, geolocation:{...mover(Q,0,0), accuracy:12}, permissions:['geolocation']});
    await page.waitForTimeout(500);
    const vw = page.viewportSize().width, vh = page.viewportSize().height;
    // gaveta presa no topo, baixinha
    let sb = await page.locator('#sidebar').boundingBox();
    const busca = await page.locator('#searchInput').boundingBox();
    ok(`${nome}: busca fica no TOPO da tela`, sb.y===0 && busca.y < 60, `busca em y=${Math.round(busca.y)}`);
    ok(`${nome}: gaveta baixinha mostra busca e atalhos, sem cobrir o mapa`, sb.height < vh*0.3 && await gaveta(page)==='peek', `altura ${Math.round(sb.height)}px de ${vh}px`);
    const kpi = await page.locator('.kpi-card').boundingBox();
    ok(`${nome}: resumo e filtros ficam escondidos até puxar`, kpi.y >= sb.y + sb.height - 1);
    const alca = await page.locator('.sheet-handle').boundingBox();
    ok(`${nome}: alça embaixo da gaveta, larga para o dedo`, Math.abs(alca.y + alca.height - (sb.y + sb.height)) <= 2 && alca.width >= vw*0.9 && alca.height >= 24);
    ok(`${nome}: alça à vista (nada por cima dela)`, await page.evaluate(()=>{ const h=document.querySelector('.sheet-handle'), r=h.getBoundingClientRect(); return document.elementFromPoint(r.left+r.width/2, r.top+12)===h; }));
    // puxar para baixo abre; para cima fecha
    await puxar(page, '.sheet-handle', 300);
    sb = await page.locator('#sidebar').boundingBox();
    ok(`${nome}: puxar a alça para BAIXO abre a gaveta`, ['half','full'].includes(await gaveta(page)) && sb.height > vh*0.45, `${await gaveta(page)} · ${Math.round(sb.height)}px`);
    ok(`${nome}: aberta, mostra o resumo`, (await page.locator('.kpi-card').boundingBox()).y < sb.y + sb.height - 40);
    ok(`${nome}: aberta, a busca continua no topo`, (await page.locator('#searchInput').boundingBox()).y < 60);
    await puxar(page, '.sheet-handle', -400);
    ok(`${nome}: puxar para CIMA fecha a gaveta`, await gaveta(page)==='peek');
    await puxar(page, '#sheetTop', 260);
    ok(`${nome}: dá para puxar também pela área da busca`, await gaveta(page)!=='peek');
    await puxar(page, '.sheet-handle', -400);
    await page.tap('#btnPanel'); await page.waitForTimeout(700);
    ok(`${nome}: atalho "Filtros" abre a gaveta`, await gaveta(page)==='half');
    await puxar(page, '.sheet-handle', -400);
    // chave do tema (interruptor) ao lado da busca
    const bt = await page.locator('#btnTheme').boundingBox(), tr = await page.locator('#btnTheme .ts-track').boundingBox();
    ok(`${nome}: chave do tema na linha da busca, alvo de toque ≥ 44px`, bt.height>=44 && bt.width>=44 && Math.abs((bt.y+bt.height/2)-(busca.y+busca.height/2))<4 && bt.x+bt.width<=vw, `${Math.round(bt.width)}×${Math.round(bt.height)}px`);
    ok(`${nome}: chave tem formato de interruptor (≈ 2:1)`, tr.width/tr.height > 1.6 && tr.width/tr.height < 2.1, `${Math.round(tr.width)}×${Math.round(tr.height)}px`);
    ok(`${nome}: chave não cobre a busca`, !sobrepoe(bt, busca));
    await page.tap('#btnTheme'); await page.waitForTimeout(700);
    ok(`${nome}: um toque na chave liga o escuro`, await page.evaluate(()=>document.documentElement.dataset.theme)==='dark' && await page.getAttribute('#btnTheme','aria-checked')==='true');
    await page.tap('#btnPanel'); await page.waitForTimeout(700);
    ok(`${nome}: com a gaveta aberta a chave continua à vista`, await page.isVisible('#btnTheme') && (await page.locator('#btnTheme').boundingBox()).y < 60);
    await puxar(page, '.sheet-handle', -400);
    // botões do mapa embaixo, perto do polegar
    const at = await page.locator('#btnRefresh').boundingBox(), loc = await page.locator('#btnGeo').boundingBox();
    ok(`${nome}: "Atualizar" e localização no canto de baixo, sem se cobrirem`, at.y > vh*0.6 && loc.y > at.y && !sobrepoe(at, loc), `atualizar y=${Math.round(at.y)} · localização y=${Math.round(loc.y)}`);
    // localização ligada: barra logo abaixo da gaveta da busca
    await page.tap('#btnGeo'); await page.waitForTimeout(1200);
    const gb = await page.locator('#geoBar').boundingBox(); sb = await page.locator('#sidebar').boundingBox();
    ok(`${nome}: barra da localização logo abaixo da gaveta da busca`, gb.y >= sb.y + sb.height && gb.y < sb.y + sb.height + 20 && gb.x >= 0 && gb.x + gb.width <= vw, `barra y=${Math.round(gb.y)} · gaveta até ${Math.round(sb.y+sb.height)}`);
    await page.tap('#geoBarOff'); await page.waitForTimeout(400);
    // busca por bairro: o aviso fica na gaveta do topo, à vista
    await page.tap('#searchInput'); await page.waitForTimeout(500);
    ok(`${nome}: tocar na busca abre a gaveta (espaço para sugestões e teclado)`, await gaveta(page)==='full');
    await page.fill('#searchInput','Coxipó'); await page.press('#searchInput','Enter'); await page.waitForTimeout(900);
    ok(`${nome}: busca filtra para o bairro`, (await rotulos(page)).length===1);
    await page.tap('#detailClose'); await page.waitForTimeout(700);
    const chip = await page.locator('#bairroChip').boundingBox(), xb = await page.locator('#btnBairroChipClear').boundingBox();
    sb = await page.locator('#sidebar').boundingBox();
    ok(`${nome}: aviso "Só Coxipó" à vista na gaveta do topo`, chip && chip.y>0 && chip.y+chip.height <= sb.y+sb.height && await gaveta(page)==='peek', chip && `y=${Math.round(chip.y)}`);
    ok(`${nome}: "Mostrar todos" com alvo de toque ≥ 40px`, xb && xb.height>=40, xb && Math.round(xb.height)+'px');
    await page.tap('#btnBairroChipClear'); await page.waitForTimeout(600);
    ok(`${nome}: "Mostrar todos" volta os 11 bairros`, (await rotulos(page)).length===11);
    await page.screenshot({path: path.resolve(__dirname, `tela_topo_${nome.split(' ')[0].toLowerCase()}.png`)});
    ok(`${nome}: sem erros`, errs.length===0, errs.join(' / '));
    await ctx.close();
  }
  for(const [nome, dev] of [['Android (Pixel 7)', devices['Pixel 7']], ['iPhone 14', devices['iPhone 14']]]){
    const {ctx, page, errs} = await abrir(browser, {...dev, geolocation:{...mover(Q,0,0), accuracy:12}, permissions:['geolocation']});
    await page.tap('#btnGeo'); await page.waitForTimeout(1200);
    await ctx.setGeolocation({...mover(Q,300,0), accuracy:12}); await page.waitForTimeout(900);
    const bar = await page.locator('#geoBar').boundingBox(); const vw = page.viewportSize().width;
    const fab = await page.locator('#btnGeo').boundingBox(), filtros = await page.locator('#btnPanel').boundingBox();
    ok(`${nome}: ativo, barra cabe na tela`, await estado(page)==='ativo' && bar.x>=0 && bar.x+bar.width<=vw, `barra ${Math.round(bar.width)}px de ${vw}px`);
    ok(`${nome}: barra não cobre os botões de baixo`, !sobrepoe(bar, fab) && !sobrepoe(bar, filtros));
    ok(`${nome}: painel não cobre o mapa sozinho`, !(await page.isVisible('#detailPanel')));
    await page.tap('#geoBarText'); await page.waitForTimeout(300);
    ok(`${nome}: tocar na barra abre o resumo do bairro`, (await page.textContent('#detailContent')).includes('Quilombo'));
    const painel = await page.locator('#detailPanel').boundingBox();
    ok(`${nome}: painel aberto não cobre a barra`, !sobrepoe(painel, await page.locator('#geoBar').boundingBox()));
    ok(`${nome}: sem erros`, errs.length===0, errs.join(' / '));
    await ctx.close();
  }
  for(const [nome, w] of [['computador', 1280], ['notebook', 1024]]){
    const {ctx, page} = await abrir(browser, {viewport:{width:w,height:760}, geolocation:{...mover(Q,0,0), accuracy:25}, permissions:['geolocation']});
    await page.click('#btnGeo'); await page.waitForTimeout(1200);
    const bar = await page.locator('#geoBar').boundingBox();
    const tools = await page.locator('.map-tools').boundingBox(), leg = await page.locator('.legend-card').boundingBox();
    ok(`${nome} (${w}px): barra não cobre legenda nem zoom`, !sobrepoe(bar, tools) && !sobrepoe(bar, leg));
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.resolve(__dirname,'resultados_testes.json'), JSON.stringify(results,null,1));
  console.log(`\n${results.filter(r=>r.ok).length}/${results.length} testes passaram`);
})();
