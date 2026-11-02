/* =========================================================
   UI — componentes com cara de app nativo
   ---------------------------------------------------------
   Orientações do mentor aplicadas aqui:
     1/5. animações suaves  → countTo, stagger, shake, gestos
     2.   skeleton          → skeleton()
     3.   SweetAlert2 nativo→ alert(), confirm(), toast()
     3.   menus nativos       → actions() (action sheet / alerta empilhado)
     4.   nada com cara de web → back do Android fecha telas (layers),
          vibração (haptic), gaveta arrastável, controle segmentado,
          sugestões de busca próprias (suggest)
   Vale para TODAS as telas. Guia completo: docs/GUIA-INTERFACE-MOBILE.md
   Regra do grupo: a tela (app.js) nunca chama Swal, alert()
   ou confirm() direto; sempre passa por UI.*. Assim todo
   aviso do sistema sai com o mesmo visual.
   ========================================================= */
(function(){
  "use strict";

  const mq = q => window.matchMedia(q).matches;
  const isMobile = () => mq('(max-width: 820px)');
  const reduceMotion = () => mq('(prefers-reduced-motion: reduce)');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* ---------- Vibração curta (Android). O Safari do iPhone ignora, sem erro. ---------- */
  const HAPTIC = {light:8, medium:14, success:[10,40,12], warning:[14,60,14], error:[18,45,18,45,18]};
  function haptic(kind){
    try{ if(navigator.vibrate) navigator.vibrate(HAPTIC[kind] || HAPTIC.light); }catch(e){}
  }

  /* ---------- SweetAlert2 com visual de sistema ----------
     buttonsStyling:false tira o visual padrão do Swal; as classes na-* (css/style.css)
     desenham o alerta no estilo iOS. heightAuto:false evita que o Swal mexa na altura
     do <html>/<body>, o que quebraria o layout de tela cheia do mapa.               */
  const hasSwal = () => typeof window.Swal !== 'undefined';
  const SHOW = {popup:'na-in', backdrop:'swal2-backdrop-show', icon:'swal2-icon-show'};
  const HIDE = {popup:'na-out', backdrop:'swal2-backdrop-hide', icon:'swal2-icon-hide'};
  const SHEET_SHOW = {popup:'na-sheet-in', backdrop:'swal2-backdrop-show', icon:'swal2-icon-show'};
  const SHEET_HIDE = {popup:'na-sheet-out', backdrop:'swal2-backdrop-hide', icon:'swal2-icon-hide'};
  const BASE = {
    heightAuto:false, scrollbarPadding:false, buttonsStyling:false,
    focusConfirm:false, returnFocus:true, backdrop:'rgba(0,0,0,.45)'
  };
  function classes(extra){
    return Object.assign({
      container:'na-container', popup:'na-alert', title:'na-title', htmlContainer:'na-text',
      actions:'na-actions', confirmButton:'na-btn na-confirm', denyButton:'na-btn na-deny', cancelButton:'na-btn na-cancel'
    }, extra || {});
  }

  /* Alerta simples (um botão). Igual ao UIAlertController do iOS. */
  function alert(title, text, opts){
    opts = opts || {};
    haptic(opts.haptic || 'warning');
    if(!hasSwal()){ toast(title + (text ? ' ' + text : ''), 'warning'); return Promise.resolve(true); }
    return Swal.fire(Object.assign({}, BASE, {
      title, text, confirmButtonText: opts.ok || 'OK',
      showClass:SHOW, hideClass:HIDE, customClass:classes()
    })).then(r => r.isConfirmed);
  }

  /* Confirmação. No celular vira "action sheet" (sobe de baixo, Cancelar separado);
     no computador vira alerta central com dois botões. destructive:true pinta de vermelho. */
  function confirm(opts){
    opts = opts || {};
    const title = opts.title || 'Tem certeza?';
    const ok = opts.confirmText || 'Confirmar', cancel = opts.cancelText || 'Cancelar';
    haptic('medium');
    if(!hasSwal()) return Promise.resolve(window.confirm(title + (opts.text ? '\n\n' + opts.text : '')));
    const sheet = isMobile();
    const tone = opts.destructive ? ' na-destructive' : '';
    return Swal.fire(Object.assign({}, BASE, {
      title, text: opts.text || '',
      showCancelButton:true, confirmButtonText:ok, cancelButtonText:cancel,
      reverseButtons: !sheet,                 // iOS: Cancelar à esquerda no alerta; embaixo no sheet
      position: sheet ? 'bottom' : 'center',
      showClass: sheet ? SHEET_SHOW : SHOW,
      hideClass: sheet ? SHEET_HIDE : HIDE,
      customClass: sheet
        ? classes({container:'na-container na-sheet-container', popup:'na-sheet' + tone})
        : classes({popup:'na-alert' + tone})
    })).then(r => r.isConfirmed);
  }

  /* Menu de ações (até 2 ações + Cancelar). Celular: action sheet; computador: alerta
     com botões empilhados. Resolve com o "value" da ação escolhida, ou null.
     UI.actions({title, text, actions:[{text:'Editar', value:'edit'},
                                       {text:'Inativar', value:'off', destructive:true}]}) */
  function actions(opts){
    opts = opts || {};
    const acts = (opts.actions || []).slice(0, 2);
    haptic('light');
    if(!hasSwal()){
      // sem SweetAlert2: pergunta simples do navegador, uma ação por vez
      for(const a of acts){ if(window.confirm((opts.title ? opts.title + '\n\n' : '') + a.text + '?')) return Promise.resolve(a.value); }
      return Promise.resolve(null);
    }
    const sheet = isMobile();
    const red = a => a && a.destructive ? ' na-red' : '';
    const popup = (sheet ? 'na-sheet' : 'na-alert na-stack') + (acts.length > 1 ? ' na-two' : '');
    return Swal.fire(Object.assign({}, BASE, {
      title: opts.title || '', text: opts.text || '',
      confirmButtonText: acts[0] ? acts[0].text : 'OK',
      showDenyButton: acts.length > 1, denyButtonText: acts[1] ? acts[1].text : '',
      showCancelButton:true, cancelButtonText: opts.cancelText || 'Cancelar',
      position: sheet ? 'bottom' : 'center',
      showClass: sheet ? SHEET_SHOW : SHOW,
      hideClass: sheet ? SHEET_HIDE : HIDE,
      customClass: classes({
        container: sheet ? 'na-container na-sheet-container' : 'na-container',
        popup,
        confirmButton:'na-btn na-confirm na-plain' + red(acts[0]),
        denyButton:'na-btn na-deny na-plain' + red(acts[1])
      })
    })).then(r => r.isConfirmed ? acts[0].value : r.isDenied ? acts[1].value : null);
  }

  /* Toast no topo, estilo notificação do celular. Arrastar para cima dispensa. */
  const TOAST_ICON = {
    info:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    success:'<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    warning:'<svg viewBox="0 0 24 24"><path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4M12 17h.01"/></svg>',
    error:'<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"/></svg>'
  };
  let fallbackTimer;
  function toast(msg, type){
    type = TOAST_ICON[type] ? type : 'info';
    if(type === 'error') haptic('error');
    else if(type === 'success') haptic('success');
    // a região #toast sempre recebe o texto: leitores de tela e testes automatizados leem dela
    const live = document.getElementById('toast');
    if(live){ live.textContent = msg; live.dataset.type = type; }

    // sem SweetAlert2 (ex.: offline) ou com um alerta aberto: usa o aviso simples da página
    // (um alerta que já está fechando não conta: a animação de saída dele não impede o toast)
    const blocking = hasSwal() && document.querySelector('.swal2-popup:not(.swal2-toast):not(.na-out):not(.na-sheet-out)');
    if(!hasSwal() || blocking){
      if(!live) return;
      live.classList.add('fallback', 'show');
      clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(() => live.classList.remove('show'), 4200);
      return;
    }
    Swal.fire({
      toast:true, position:'top', heightAuto:false, scrollbarPadding:false,
      showConfirmButton:false, timer: type === 'error' ? 5200 : 3600,
      html:`<span class="na-toast-ico t-${type}" aria-hidden="true">${TOAST_ICON[type]}</span><span class="na-toast-msg">${esc(msg)}</span>`,
      showClass:{popup:'na-toast-in'}, hideClass:{popup:'na-toast-out'},
      customClass:{container:'na-toast-container', popup:'na-toast', htmlContainer:'na-toast-body'},
      didOpen: el => swipeToDismiss(el)
    });
  }
  function swipeToDismiss(el){
    el.addEventListener('mouseenter', Swal.stopTimer);
    el.addEventListener('mouseleave', Swal.resumeTimer);
    let y0 = null, dy = 0;
    el.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; dy = 0; Swal.stopTimer(); el.style.transition = 'none'; }, {passive:true});
    el.addEventListener('touchmove', e => {
      if(y0 === null) return;
      dy = Math.min(0, e.touches[0].clientY - y0);
      el.style.transform = `translateY(${dy}px)`;
      el.style.opacity = String(Math.max(0, 1 + dy/90));
    }, {passive:true});
    const end = () => {
      if(y0 === null) return;
      el.style.transition = '';
      if(dy < -28){ Swal.close(); }
      else { el.style.transform = ''; el.style.opacity = ''; Swal.resumeTimer(); }
      y0 = null;
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }

  /* ---------- Skeleton ----------
     Gera blocos cinza com brilho no mesmo tamanho do conteúdo real,
     para a tela não "pular" quando os dados chegam.                 */
  function skel(w, h, extra){
    return `<span class="skel${extra ? ' ' + extra : ''}" style="width:${w};height:${h}"></span>`;
  }
  function skeleton(n, template){
    return Array.from({length:n}, (_, i) => template(i)).join('');
  }

  /* ---------- Animações ---------- */
  // número que "corre" até o valor final (KPIs)
  function countTo(el, to, dur){
    if(!el) return;
    const from = parseInt(el.dataset.v ?? el.textContent, 10) || 0;
    el.dataset.v = to;
    cancelAnimationFrame(el._raf);
    if(reduceMotion() || from === to){ el.textContent = to; return; }
    dur = dur || 650;
    const t0 = performance.now();
    const step = t => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);                 // ease-out cúbico
      el.textContent = Math.round(from + (to - from) * e);
      if(p < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  }
  // itens de uma lista entram um após o outro
  function stagger(container, step){
    if(!container || reduceMotion()) return;
    step = step || 40;
    const kids = [...container.children];
    kids.forEach((c, i) => c.style.setProperty('--i', i));
    container.style.setProperty('--stagger', step + 'ms');
    container.classList.remove('stagger-in');
    void container.offsetWidth;                         // reinicia a animação
    container.classList.add('stagger-in');
    clearTimeout(container._st);
    container._st = setTimeout(() => container.classList.remove('stagger-in'), 600 + Math.min(kids.length, 14) * step);
  }
  // "não" do sistema: balança o elemento (senha errada)
  function shake(el){
    if(!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    el.addEventListener('animationend', () => el.classList.remove('shake'), {once:true});
  }

  /* ---------- Botão "voltar" do celular fecha a tela aberta ----------
     Em app nativo, o voltar do Android fecha a gaveta/tela aberta em vez de sair do app.
     Cada tela aberta empilha uma entrada no histórico.                          */
  const stack = [];
  let ignorePop = 0;
  function openLayer(id, onClose){
    if(stack.some(l => l.id === id)) return;
    stack.push({id, onClose});
    try{ history.pushState({naLayer:id}, ''); }catch(e){}
  }
  function closeLayer(id){
    const top = stack[stack.length - 1];
    if(!top || top.id !== id) return;
    stack.pop();
    ignorePop++;
    try{ history.back(); }catch(e){ ignorePop--; }
  }
  function swapLayer(oldId, newId, onClose){
    const top = stack[stack.length - 1];
    if(top && top.id === oldId){
      top.id = newId; top.onClose = onClose;
      try{ history.replaceState({naLayer:newId}, ''); }catch(e){}
    } else openLayer(newId, onClose);
  }
  window.addEventListener('popstate', () => {
    if(ignorePop > 0){ ignorePop--; return; }
    const top = stack.pop();
    if(top) top.onClose();
  });

  /* ---------- Gaveta arrastável (bottom sheet) ----------
     Puxar a alça para baixo fecha, como nos apps. Fecha se arrastar
     mais de 90 px ou se o gesto for rápido.                          */
  function draggableSheet(sheet, handles, onClose, openClass){
    openClass = openClass || 'open';
    let y0 = null, dy = 0, t0 = 0;
    const start = e => {
      if(!isMobile() || !sheet.classList.contains(openClass)) return;
      y0 = e.touches[0].clientY; dy = 0; t0 = Date.now();
      sheet.style.transition = 'none';
    };
    const move = e => {
      if(y0 === null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      sheet.style.transform = `translateY(${dy}px)`;
    };
    const end = () => {
      if(y0 === null) return;
      const v = dy / Math.max(1, Date.now() - t0);      // px por ms
      sheet.style.transition = '';
      sheet.style.transform = '';
      if(dy > 90 || (dy > 24 && v > 0.55)) onClose();
      y0 = null;
    };
    handles.forEach(h => {
      if(!h) return;
      h.addEventListener('touchstart', start, {passive:true});
      h.addEventListener('touchmove', move, {passive:true});
      h.addEventListener('touchend', end);
      h.addEventListener('touchcancel', end);
    });
  }


  /* ---------- Controle segmentado (estilo iOS) ----------
     Marcação: <div class="segmented"><span class="seg-thumb"></span><button>…</button>…</div>
     A "pílula" desliza até o botão ativo. onChange(botao) é chamado ao trocar.   */
  function segmented(el, opts){
    opts = opts || {};
    const thumb = el.querySelector('.seg-thumb');
    const buttons = () => [...el.querySelectorAll(':scope > button')];
    function place(instant){
      const act = el.querySelector(':scope > button.active');
      if(!thumb || !act || !act.offsetWidth) return;
      thumb.classList.toggle('instant', !!instant);
      thumb.style.width = act.offsetWidth + 'px';
      thumb.style.transform = `translateX(${act.offsetLeft}px)`;
    }
    function select(btn, silent){
      buttons().forEach(b => { b.classList.toggle('active', b === btn); b.setAttribute('aria-selected', String(b === btn)); });
      place(false);
      if(!silent){ haptic('light'); if(opts.onChange) opts.onChange(btn); }
    }
    buttons().forEach(b => b.addEventListener('click', () => select(b)));
    // reposiciona quando o controle muda de tamanho (girar o celular, abrir um modal)
    if(window.ResizeObserver) new ResizeObserver(() => place(true)).observe(el);
    else window.addEventListener('resize', () => place(true));
    place(true);
    return {select, refresh: () => place(true)};
  }

  /* ---------- Sugestões de busca (substitui o <datalist> do navegador) ----------
     source(termo) devolve [{label, sub, value}]. onPick(item) ao escolher.
     Teclado: ↑ ↓ Enter Esc. Toque: escolhe. O último item pode ser uma ação extra
     (ex.: "Buscar como endereço"), devolvida por opts.extra(termo).              */
  function suggest(input, opts){
    const host = input.closest('[data-suggest-host]') || input.parentElement;
    const box = document.createElement('ul');
    box.className = 'suggest';
    box.id = input.id + 'Suggest';
    box.setAttribute('role', 'listbox');
    host.appendChild(box);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', box.id);
    input.setAttribute('aria-expanded', 'false');
    let items = [], idx = -1, closeTimer;

    const mark = (txt, term) => {
      const i = txt.toLowerCase().indexOf(term.toLowerCase());
      if(!term || i < 0) return esc(txt);
      return esc(txt.slice(0, i)) + '<b>' + esc(txt.slice(i, i + term.length)) + '</b>' + esc(txt.slice(i + term.length));
    };
    function render(){
      const term = input.value.trim();
      items = term ? opts.source(term).slice(0, 6) : [];
      const extra = term && opts.extra ? opts.extra(term) : null;
      if(extra) items.push(Object.assign({extra:true}, extra));
      idx = -1;
      if(!items.length || document.activeElement !== input){ hide(); return; }
      box.innerHTML = items.map((it, i) => `
        <li role="option" id="${box.id}-${i}" class="suggest-item${it.extra ? ' extra' : ''}" data-i="${i}">
          <span class="suggest-ico" aria-hidden="true">${it.extra
            ? '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
            : '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'}</span>
          <span class="suggest-text"><span class="suggest-label">${it.extra ? esc(it.label) : mark(it.label, term)}</span>
          ${it.sub ? `<span class="suggest-sub">${esc(it.sub)}</span>` : ''}</span>
        </li>`).join('');
      box.classList.add('show');
      input.setAttribute('aria-expanded', 'true');
    }
    function hide(){
      box.classList.remove('show');
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      idx = -1;
    }
    function highlight(i){
      idx = (i + items.length) % items.length;
      box.querySelectorAll('.suggest-item').forEach((li, k) => li.classList.toggle('active', k === idx));
      input.setAttribute('aria-activedescendant', box.id + '-' + idx);
    }
    function pick(i){
      const it = items[i];
      if(!it) return;
      haptic('light');
      if(!it.extra) input.value = it.label;
      hide();
      opts.onPick(it);
    }
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('blur', () => { closeTimer = setTimeout(hide, 120); });
    input.addEventListener('keydown', e => {
      if(!box.classList.contains('show')) return;
      if(e.key === 'ArrowDown'){ e.preventDefault(); highlight(idx + 1); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); highlight(idx - 1); }
      else if(e.key === 'Escape'){ e.stopPropagation(); hide(); }
      else if(e.key === 'Enter' && idx >= 0){ e.preventDefault(); e.stopImmediatePropagation(); pick(idx); }
      else if(e.key === 'Enter'){ hide(); }
    });
    // pointerdown (e não click): escolhe antes de o campo perder o foco
    box.addEventListener('pointerdown', e => {
      const li = e.target.closest('.suggest-item');
      if(!li) return;
      e.preventDefault(); clearTimeout(closeTimer);
      pick(+li.dataset.i);
    });
    return {hide, refresh: render};
  }

  window.UI = {
    isMobile, reduceMotion, wait, esc, haptic,
    alert, confirm, actions, toast,
    segmented, suggest,
    skel, skeleton,
    countTo, stagger, shake,
    layers:{open:openLayer, close:closeLayer, swap:swapLayer},
    draggableSheet
  };
})();
