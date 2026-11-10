// T9 — testes automatizados da sprint de geolocalização em tempo real
// Atualizado em 02/11/2026: a lista de bairros agora é o componente de sugestões (UI.suggest).
// Atualizado em 09/11/2026: busca por bairro como filtro e desempenho do zoom.
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
    ok('Ponto azul desenhado', dot1.n===1 && dot1.fill==='#3d9bff');
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

  // ---------- Busca por bairro filtra o mapa (09/11) ----------
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
    ok('Busca: período mostra o bairro', /Coxipó/.test(await page.textContent('#periodLabel')));
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
    ok('Busca: "Limpar" da gaveta também tira o filtro de bairro', (await rotulos(page)).length===11 && !(await page.isVisible('#bairroChip')));
    await page.fill('#searchInput','Coxipó'); await page.click('#btnSearch'); await page.waitForTimeout(400);
    await page.click('#btnGeo'); await page.waitForTimeout(1200);
    ok('Busca: ativar a localização tira o filtro de bairro', (await rotulos(page)).length===11 && !(await page.isVisible('#bairroChip')) && await estado(page)==='ativo');
    ok('Busca: sem erros', errs.length===0, errs.join(' / '));
    await ctx.close();
  }

  // ---------- Desempenho do zoom (09/11) ----------
  {
    const {ctx, page, errs} = await abrir(browser, {viewport:{width:1280,height:760}});
    await page.waitForTimeout(400);
    ok('Zoom: mapa de calor anima junto com o zoom', await page.$eval('canvas.heat-canvas', c=>c.classList.contains('leaflet-zoom-animated')));
    ok('Zoom: mapa de calor desenhado', await pixelsCalor(page) > 0);
    ok('Zoom 12: sem alfinetes', (await page.$$eval('.occ-marker', els=>els.length))===0);
    // chega no zoom 14 pela busca e volta a mostrar todos os bairros
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
