# Guia de Interface Mobile — Projeto Integrador (Mapa de Violência Urbana)

> **Leia antes de criar ou alterar qualquer tela.** Este guia é o padrão obrigatório do
> grupo, definido pelo mentor. Toda nova implantação segue estes passos e **cria
> componentes** em vez de escrever HTML/CSS/JS solto em cada tela.
>
> **Vale para TODAS as telas e partes do sistema**, sem exceção.
>
> Versão 1.2 · 02/11/2026 — a área restrita (login + gestão de ocorrências) foi **retirada**
> do sistema; os componentes criados para ela que servem para outras telas continuam no catálogo.

---

## 1. A orientação do mentor (texto-base)

1. **Animações.**
2. **Skeleton Design.**
3. **SweetAlert2** — deixar 100% nativo mobile.
4. **Telas como aplicativo mobile (nada de Bootstrap)**, baseadas nos aplicativos modernos
   (Apple, Banco Inter, Banco Bradesco). Criar sempre os componentes e o layout com
   **100% de responsividade**, e os componentes **não podem transparecer web**.
5. **Suavizar as animações.**

Complemento: o **foco principal é mobile**. A identidade visual é **azul**
(competência, calma, confiança — cor de tecnologia, ciência e governo).

### 1.1 Inventário de telas (status do padrão)

Toda tela nova entra nesta tabela. Uma tela só está "pronta" quando cumpre as 5 regras.

| Tela / parte | Como ficou no padrão de app | Status |
|---|---|---|
| Abertura do app | interface entra escalonada; skeleton do mapa, do cartão de resumo, dos tipos e do ranking | ✅ |
| Mapa (tela principal) | botões de vidro, alfinetes que "caem", mapa de calor com fade | ✅ |
| Busca | campo de busca de app com lupa e limpar (×); sugestões próprias (`UI.suggest`); no celular confirma pela tecla "buscar" do teclado, sem botão de site | ✅ |
| Painel de resumo e filtros | celular: gaveta arrastável com barra **Limpar · Filtros · OK**; computador: painel que recolhe. Cartão de resumo estilo "saldo" de banco; seções agrupadas (`.section` + `.list-group` + `.cell`) | ✅ |
| — Localização | célula com ícone e **interruptor iOS** sincronizado com o botão do mapa | ✅ |
| — Período | controle segmentado (`UI.segmented`); datas personalizadas em campos `.field` | ✅ |
| — Tipo de ocorrência | células com ícone, barra, número e marca ✓ ao filtrar | ✅ |
| — Bairros com mais registros | células com posição, barra, número e seta › | ✅ |
| Detalhes (bairro, ocorrência, perto de você, endereço) | cabeçalho com ícone, número grande e listas chave → valor; no celular é gaveta com alça (arrastar e "voltar" fecham) | ✅ |
| Barra de localização | entra deslizando; ações em botões-pílula (`.chip-btn`) | ✅ |
| Estado vazio | ícone, título, explicação e ação "Limpar filtros" | ✅ |
| Avisos e confirmações | SweetAlert2 nativo via `UI.toast` / `UI.confirm` / `UI.actions` / `UI.alert` | ✅ |
| ~~Login / Gestão de ocorrências~~ | retirados na versão 1.2 | — |

---

## 2. Arquitetura: onde cada coisa mora

```
index.html          → estrutura das telas (só marcação, sem estilo inline de layout)
css/style.css       → TOKENS (cores, movimento, tamanhos) + componentes visuais
js/ui.js            → COMPONENTES de comportamento (UI.*): alertas, toasts, skeleton,
                      animações, gestos, botão voltar, vibração
js/app.js           → regras do sistema e telas; usa UI.* e as classes do CSS
manifest.webmanifest→ instala como app (sem barra do navegador)
```

**Regra de ouro:** a tela (`app.js`) **descreve o que acontece**; o componente (`ui.js` +
classes do CSS) **decide como aparece**. Se você está escrevendo a mesma animação, o mesmo
alerta ou o mesmo bloco de skeleton pela segunda vez, isso deveria virar componente.

Proibido:
- Tabela (`<table>`) como lista em tela de celular: use `.list-group`/`.cell`.
- `<datalist>`, `<select>` sem `.field`, ou qualquer controle com a aparência padrão do navegador.
- Bootstrap, Tailwind de componentes prontos, jQuery UI ou qualquer kit "de site".
- `alert()`, `confirm()`, `prompt()` do navegador e `Swal.fire` direto na tela.
- Texto corrido ou blocos soltos onde cabe lista: informação vai em `.section` + `.list-group` + `.cell`.
- Cor, duração ou curva de animação escritas "na mão" (sempre tokens).
- Mostrar/esconder com `display:none → block` sem transição.

---

## 3. Tokens (topo de `css/style.css`)

### 3.1 Cores — paleta azul

| Token | Valor | Uso |
|---|---|---|
| `--accent` | `#4d8dff` | texto/ícone de destaque, foco, números |
| `--accent-strong` | `#1f6feb` | botão principal, pílulas, alfinete de busca |
| `--accent-soft` | `rgba(31,111,235,.18)` | fundo de item selecionado, anel de foco |
| `--accent-rgb` | `77,141,255` | para `rgba(var(--accent-rgb), x)` |
| `--bg` / `--surface` / `--surface-2` / `--surface-3` | `#070b12` → `#1b2433` | fundos (neutros levemente azulados) |
| `--border`, `--hairline` | | bordas e divisórias finas (0.5px estilo iOS) |
| `--text`, `--text-dim`, `--text-faint` | | hierarquia de texto |
| `--ios-blue` | `#0a84ff` | botões de texto (Fechar, Cancelar), ação padrão de alerta |
| `--ios-green` | `#30d158` | interruptor ligado, sucesso |
| `--danger` | `#ff5a52` | **só** ação destrutiva e erro |
| `--warn` | `#ffb020` | aviso |
| `--heat` | vermelho→amarelo | **só** dados do mapa de calor (intensidade) |

Exceções intencionais: o mapa de calor continua quente (azul passaria a ideia de "área
tranquila") e ações destrutivas continuam vermelhas.

### 3.2 Movimento

| Token | Valor | Quando usar |
|---|---|---|
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | algo **entrando** (fade, itens de lista) |
| `--ease-spring` | `cubic-bezier(.32,.72,0,1)` | gavetas, telas que sobem, pílulas que deslizam (curva do iOS) |
| `--ease-std` | `cubic-bezier(.4,0,.2,1)` | troca de cor/opacidade |
| `--ease-in` | `cubic-bezier(.55,0,1,.45)` | algo **saindo** |
| `--dur-press` | `.12s` | toque em botão |
| `--dur-fast` | `.18s` | cor, hover |
| `--dur-base` | `.28s` | fades, trocas de conteúdo |
| `--dur-slow` | `.42s` | itens que entram, recolher painel |
| `--dur-sheet` | `.52s` | gavetas, telas cheias, modais |

### 3.3 Medidas e áreas seguras

`--radius` 16px · `--radius-sm` 10px · `--gap` 14px (10px no celular) · `--top-h` 52px (48px no celular)
`--safe-t` / `--safe-b` = `env(safe-area-inset-*)` → notch e barra de gestos do iPhone.

---

## 4. Catálogo de componentes

### 4.1 Componentes JS (`js/ui.js`)

| Componente | Para quê | Exemplo |
|---|---|---|
| `UI.toast(msg, tipo)` | aviso rápido no topo, estilo notificação; arrastar para cima dispensa | `UI.toast('Dados atualizados.', 'success')` — tipos: `info`, `success`, `warning`, `error` |
| `UI.confirm({...})` | confirmação: **action sheet** no celular, alerta iOS no computador | ver 4.3 |
| `UI.actions({title, text, actions})` | menu de ações (até 2 + Cancelar); resolve com o `value` escolhido ou `null` | `await UI.actions({title:'CPA', actions:[{text:'Ver no mapa', value:'ver'},{text:'Compartilhar', value:'share'}]})` |
| `UI.alert(titulo, texto)` | alerta de um botão (OK) | `UI.alert('Sem conexão', 'Tente de novo.')` |
| `UI.segmented(el, {onChange})` | controle segmentado com pílula que desliza; devolve `{select(botao, silencioso), refresh()}` | período do painel |
| `UI.suggest(input, {source, extra, onPick})` | sugestões de busca (substitui o `<datalist>`), teclado ↑ ↓ Enter Esc | busca de bairros |
| `UI.skel(w, h, extra)` / `UI.skeleton(n, tpl)` | bloco(s) de skeleton | ranking enquanto carrega |
| `UI.countTo(el, n)` | número que "corre" até o valor | cartão de resumo, contagens |
| `UI.stagger(lista)` | itens de uma lista entram em sequência | tipos e ranking após carregar |
| `UI.shake(el)` / `UI.haptic(tipo)` | balança (erro) / vibração curta | busca vazia |
| `UI.layers.open(id, fechar)` / `.close(id)` / `.swap(a, b, fechar)` | botão **voltar** do celular fecha a tela aberta | gaveta de filtros, detalhes |
| `UI.draggableSheet(el, alcas, fechar, classeAberta)` | gaveta que fecha arrastando para baixo | gaveta (`'open'`), detalhes (`'show'`) |
| `UI.isMobile()`, `UI.reduceMotion()`, `UI.wait(ms)`, `UI.esc(txt)` | utilidades | `esc` sempre que inserir texto do usuário em HTML |

### 4.2 Componentes visuais (classes do CSS)

| Classe | O que é | Referência |
|---|---|---|
| `.nav-bar` + `.nav-title` + `.nav-btn` (`.strong`, `.icon`) | barra de navegação: ação à esquerda, título central, ação à direita (ex.: **Limpar · Filtros · OK**) | iOS |
| `.kpi-card` (`.kpi-label`, `.kpi-value`, `.kpi-sub`) | cartão de número principal | "saldo" do Inter/Bradesco |
| `.section` + `.section-title` / `.section-head` + `.section-footer` | seção agrupada com título e nota de rodapé | Ajustes do iPhone |
| `.list-group` (`.compact`) + `.cell` | lista agrupada de células com divisórias finas | Ajustes do iPhone |
| `.cell-ico`, `.cell-main`, `.cell-title`, `.cell-sub`, `.cell-chev`, `.bar`, `.n` | partes de uma célula | |
| `.cell.kv` (`.has-ico`) + `.kv-value` | linha "chave → valor" | detalhes de conta |
| `.switch-cell` + `.switch` | célula com interruptor iOS | Ajustes do iPhone |
| `.type-row` + `.check` | célula selecionável com marca ✓ | listas de seleção do iOS |
| `.rank-n` | posição numerada | |
| `.icon-tile.blue` | quadradinho colorido com ícone | Ajustes do iPhone |
| `.segmented` + `.seg-thumb` | controle segmentado (com `UI.segmented`) | iOS |
| `.field` (`.static`, `.compact`, `.textarea`, `.has-action`, `.invalid`) | campo com **rótulo flutuante**, em todo formulário | Inter |
| `.btn-cta` (`.loading`, `.success`) | botão principal grande (56px) | Inter/Bradesco |
| `.chip-btn` (`.blue`, `.red`) | botão-pílula para ações curtas | Apple Maps |
| `.fab` | botão redondo flutuante de vidro | Apple Maps |
| `.sidebar` + `.sheet-handle` + `.scrim` | gaveta inferior (bottom sheet) no celular | Apple Maps |
| `.detail-panel` + `.sheet-grabber` + `.detail-head` + `.detail-kpi` + `.detail-note` | cartão/gaveta de detalhes | Apple Maps |
| `.modal-backdrop` + `.modal` + `.modal-grabber` + `.modal-body` | **page sheet** para telas futuras: cartão no PC, sobe de baixo no celular | iOS |
| `.empty-state` | estado vazio com ícone, título e ação | |
| `.suggest` | lista de sugestões (desenhada por `UI.suggest`) | busca do Apple Maps |
| `.only-mobile` / `.only-desktop` | mostra só no celular / só no computador | |
| `.skel` / `.sk` + `.is-loading` | skeleton (seção 7) | |
| `.stagger-in`, `.shake`, `.swap` | animações utilitárias | |
| `.na-*` | visual nativo do SweetAlert2 (quem usa é o `ui.js`) | |

### 4.3 Exemplo de confirmação (padrão para qualquer ação destrutiva)

```js
const ok = await UI.confirm({
  title: 'Desativar a localização?',
  text: 'O contador de registros perto de você para de atualizar.',
  confirmText: 'Desativar',
  destructive: true            // pinta o botão de vermelho
});
if (!ok) return;
UI.toast('Localização desativada.', 'success');
```

---

## 5. Receita: como criar uma tela nova (passo a passo)

Exemplo: tela "Sobre o projeto", aberta por um botão.

**Passo 1 — Marcação no `index.html`** com componentes existentes: page sheet + barra de
navegação + seções agrupadas.

```html
<div class="modal-backdrop" id="sobreSheet">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sobreTitulo">
    <div class="modal-grabber" aria-hidden="true"></div>
    <header class="nav-bar">
      <span></span>
      <h2 class="nav-title" id="sobreTitulo">Sobre</h2>
      <button type="button" class="nav-btn strong" id="sobreOk">OK</button>
    </header>
    <div class="modal-body is-loading" id="sobreBody">
      <section class="section">
        <h3 class="section-title">Projeto</h3>
        <div class="list-group compact">
          <div class="cell kv"><span class="cell-title">Grupo</span><span class="kv-value sk" id="sobreGrupo">—</span></div>
          <div class="cell kv"><span class="cell-title">Registros</span><span class="kv-value mono sk" id="sobreTotal">0</span></div>
        </div>
        <p class="section-footer">Protótipo acadêmico com dados fictícios.</p>
      </section>
    </div>
  </div>
</div>
```

**Passo 2 — Abrir/fechar com animação e botão voltar** (`app.js`):

```js
function abrirSobre(){
  $('sobreSheet').classList.add('show');
  UI.layers.open('sobre', fecharSobre);     // voltar do Android fecha
  UI.haptic('light');
  carregarSobre();
}
function fecharSobre(){
  if(!$('sobreSheet').classList.contains('show')) return;
  $('sobreSheet').classList.remove('show');
  UI.layers.close('sobre');
}
$('sobreOk').addEventListener('click', fecharSobre);
```

**Passo 3 — Skeleton enquanto carrega, depois dados com animação:**

```js
async function carregarSobre(){
  const corpo = $('sobreBody');
  corpo.classList.add('is-loading');                                    // .sk viram blocos cinza
  const [dados] = await Promise.all([api.getResumo(), UI.wait(400)]);   // tempo mínimo evita "piscar"
  $('sobreGrupo').textContent = dados.grupo;
  UI.countTo($('sobreTotal'), dados.total);
  corpo.classList.remove('is-loading');
  UI.stagger(corpo);
}
```

**Passo 4 — Avisos e erros "nativos":** `UI.toast(...)` para retorno, `UI.confirm(...)` para
ação destrutiva, `UI.shake(el)` + `UI.haptic('error')` para erro de preenchimento.
Formulários usam `.field` (rótulo flutuante) e `.btn-cta` com `.loading` enquanto envia.

**Passo 5 — CSS só se faltar componente.** Se precisar de algo novo, crie como componente
reutilizável em `style.css` (com tokens), **mobile-first** (seção 6), e registre na seção 4.2.

**Passo 6 — Inventário e checklist:** inclua a tela na seção 1.1, rode o checklist das
seções 10 e 11 e os testes (`testes/`).

---

## 6. Responsividade (foco mobile)

- **Componentes novos são escritos mobile-first:** o estilo base é o do celular, e o
  computador vem em `@media (min-width: 821px)`.
  (O CSS legado do mapa ainda usa `@media (max-width: 820px)` para o celular; ao mexer
  nele, mantenha o padrão do bloco em que estiver.)
- Pontos de quebra: **≤ 820px** celular · **821–1180px** notebook/tablet · **> 1180px** computador ·
  **max-height: 620px** celular deitado/teclado aberto (a tela rola em vez de espremer).
- Alturas de tela cheia com `100dvh` (não `100vh`, que erra no Safari com a barra de endereço).
- Tudo que fica colado no topo/rodapé soma `var(--safe-t)` / `var(--safe-b)`.
- Alvo de toque mínimo **44×44px**; botão principal **56px** de altura.
- Campos com **16px** de fonte no celular (abaixo disso o iPhone dá zoom na página).
- Larguras com `min()`, `max()`, `%` e `grid`/`flex`; nada de largura fixa em px que estoure 360px.
- Testar em: **iPhone 14 (390px)**, **Pixel 7 (412px)**, **1024px** e **1366px**.

---

## 7. Skeleton Design

- Toda informação que vem de dados (API, `localStorage`) tem skeleton.
- Duas formas:
  - **`.sk`** no elemento real: enquanto ele ou um pai (o `<body>` ou um contêiner) tiver
    `.is-loading`, vira bloco cinza. Bom para KPIs, campos e listas fixas.
  - **`UI.skel()` / `UI.skeleton()`**: gera linhas falsas para listas e tabelas que ainda não existem.
- O skeleton tem **o mesmo tamanho e a mesma estrutura** do conteúdo final (nada pode "pular").
- Tempo mínimo de ~400–600ms (`Promise.all([fetch, UI.wait(ms)])`) para não piscar.
- Ao trocar skeleton → dados: `UI.stagger()` ou o fade de `body.loaded`.
- Também vale para o mapa: `#mapSkeleton` some com fade quando o mapa base carrega.

---

## 8. SweetAlert2 "nativo"

- Biblioteca JS carregada pelo CDN jsDelivr no `index.html` (não é API, não tem chave).
- Visual padrão desligado (`buttonsStyling:false`) e redesenhado com as classes `.na-*`:
  - **Alerta** = estilo iOS (270px, cantos 14px, vidro, botões separados por linha fina).
  - **Confirmação no celular** = *action sheet* (sobe de baixo; "Cancelar" em cartão separado).
  - **Toast** = notificação que desce do topo; arrastar para cima dispensa; pausa ao tocar.
- `heightAuto:false` sempre (senão o Swal quebra a tela cheia do mapa).
- Ícones grandes animados do Swal (✓ gigante etc.) **não são usados**: apps nativos não têm isso.
- Se o Swal não carregar (offline), `ui.js` cai num aviso simples da página — nada quebra.
- **Nunca** chamar `Swal.fire` na tela; se faltar um tipo de alerta, crie em `ui.js`.

---

## 9. Animações suaves

1. Animar **só `transform` e `opacity`** (e `grid-template-rows` para altura). Nunca `top`,
   `left`, `width`, `height`, `margin` — travam no celular.
2. **Entrar** com `--ease-out`/`--ease-spring`; **sair** mais rápido com `--ease-in`.
3. Esconder com `opacity:0; visibility:hidden; transform:...` + transição — **nunca**
   `display:none` direto. A `visibility` sai com atraso igual à duração (ver `.detail-panel`).
4. Toque: botões afundam (`scale(.94)` ou `.97` em itens de lista) em `--dur-press`.
5. Conteúdo que troca dentro de um painel aberto: classe `.swap` (fade curto), não troca seca.
6. Listas: `UI.stagger()` com no máximo 14 itens escalonados (o resto entra junto).
7. Nada de animação "só porque sim" em coisa que se repete muito (ex.: alfinetes não caem de novo a cada zoom).
8. Respeitar `prefers-reduced-motion` (já tratado globalmente no CSS).

---

## 10. "Não transparecer web" — checklist

- [ ] Fonte do sistema (`--font-ui`), não fonte baixada.
- [ ] Sem destaque azul ao tocar (`-webkit-tap-highlight-color: transparent`).
- [ ] Texto da interface não selecionável; campos sim.
- [ ] Sem menu de "copiar/abrir link" ao segurar o dedo (`-webkit-touch-callout:none`).
- [ ] Hover só em `@media (hover:hover)` (no celular o hover "gruda").
- [ ] Sem barra de rolagem visível no celular; `overscroll-behavior` contido.
- [ ] Campos 16px no celular (sem zoom).
- [ ] Áreas seguras respeitadas (notch / barra de gestos).
- [ ] Botão **voltar** do Android fecha a tela aberta (`UI.layers`).
- [ ] Vibração curta em ações (`UI.haptic`).
- [ ] Telas cheias sobem de baixo; detalhes e alertas não "piscam".
- [ ] Nenhum `alert()`/`confirm()` do navegador; nenhum componente de Bootstrap.
- [ ] `select` e `input` sem aparência padrão do navegador (`appearance:none` + ícone próprio).
- [ ] Instalável (manifest + ícones + `theme-color`).

## 11. Checklist de entrega de qualquer tela (Definition of Done)

- [ ] Entrou no inventário de telas (seção 1.1) com status ✅.
- [ ] Usa só componentes do catálogo; o que faltou virou componente novo e entrou na seção 4.
- [ ] Cores e animações só por tokens.
- [ ] Skeleton em tudo que depende de dados.
- [ ] Avisos/confirmações via `UI.*` (SweetAlert2 nativo).
- [ ] Testada em 390px, 412px, 1024px e 1366px, e com o celular deitado.
- [ ] Checklist da seção 10 completo.
- [ ] Testes automatizados passando (`cd testes && npm test`).
- [ ] README/guia atualizados se algo mudou no padrão.

---

## 12. Como foi aplicado (antes → depois)

### 12.1 Animações (itens 1 e 5)

**Antes:** painel de detalhes aparecia com `display:none → block`; números trocavam secos.

```css
/* depois */
.detail-panel{opacity:0;visibility:hidden;transform:translateY(-8px) scale(.97);
  transition:opacity var(--dur-fast) var(--ease-std),transform var(--dur-base) var(--ease-in),visibility 0s linear var(--dur-base);}
.detail-panel.show{opacity:1;visibility:visible;transform:none;
  transition:opacity var(--dur-base) var(--ease-out),transform var(--dur-sheet) var(--ease-spring),visibility 0s;}
```
```js
UI.countTo($('statTotal'), filtered.length);   // antes: textContent = filtered.length
```
Também: painel recolhe com altura animada, pílula do período desliza, marca ✓ aparece com
mola, barras crescem, alfinetes "caem", listas entram em sequência.

### 12.2 Skeleton (item 2)

`<body class="is-loading">` + `.sk` no cartão de resumo, no período e nos tipos; linhas falsas
(`.cell-skel`) no ranking; "ruas" falsas no mapa até o mapa base carregar.

### 12.3 SweetAlert2 nativo (item 3)

O aviso feito à mão virou `UI.toast()` (notificação do topo); confirmações e menus usam
`UI.confirm()` / `UI.actions()` (action sheet no celular, alerta iOS no computador).

### 12.4 Painel de resumo e filtros (revisão 1.2)

**Antes:** blocos com títulos soltos, texto corrido, linhas de filtro e ranking "de site".

```html
<!-- antes -->
<header class="panel-head"><span class="label">Ocorrências no mapa</span><strong class="big">201</strong>…</header>
<section class="sec"><h2>Tipo de ocorrência</h2><div class="type-list">…</div></section>

<!-- depois -->
<header class="nav-bar sheet-nav">Limpar · <h2 class="nav-title">Filtros</h2> · OK</header>
<div class="kpi-card"><span class="kpi-label">Ocorrências no mapa</span><strong class="kpi-value">201</strong>
  <span class="kpi-sub">Últimos 90 dias · às 14:04</span></div>
<section class="section"><h3 class="section-title">Tipo de ocorrência</h3>
  <div class="list-group"><label class="cell type-row">ícone · Furto + barra · 50 · ✓</label>…</div>
  <p class="section-footer">Toque para filtrar…</p></section>
```
- **Localização** virou célula com interruptor iOS, sincronizado com o botão do mapa.
- **Datas personalizadas** usam `.field.static.compact` (rótulo flutuante).
- **Ranking** virou células com posição, barra, número e seta ›.
- **"Limpar"** na barra zera período e tipos (fica cinza quando não há filtro); **"OK"** fecha a gaveta.

### 12.5 Detalhes, busca, barra de localização e estado vazio (revisão 1.2)

- **Detalhes:** de linhas de texto (`.detail-row`) e etiquetas para cabeçalho com ícone, número
  grande e listas chave → valor (`.list-group.compact` + `.cell.kv`), no mesmo padrão do painel.
- **Busca:** botão limpar (×) dentro do campo; no celular sem botão "Ir" (confirma pela tecla do teclado).
- **Barra de localização:** botões de site (`.btn small`) viraram botões-pílula (`.chip-btn`).
- **Estado vazio:** de uma frase solta para cartão com ícone, título, explicação e "Limpar filtros".

### 12.6 Revisões anteriores

- **1.1** — gestão de ocorrências em lista de células, menu de ações, formulário empurrado;
  busca com sugestões; detalhes arrastáveis. (A gestão foi retirada na 1.2, mas `UI.actions`,
  `UI.segmented`, `UI.suggest`, `.list-group`/`.cell` e `.field` seguem no catálogo.)
- **1.0** — orientações do mentor, login estilo banco (retirado na 1.2) e paleta azul
  (`--accent:#4d8dff`, `--accent-strong:#1f6feb`; mapa de calor e erros continuam quentes/vermelhos).

---

## 13. Histórico deste guia

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 02/11/2026 | Orientações do mentor (animações, skeleton, SweetAlert2 nativo, telas de app, animações suaves, foco mobile) + paleta azul |
| 1.1 | 02/11/2026 | Regra explicitamente para todas as telas; inventário de telas; gestão refeita; busca com sugestões; detalhes arrastáveis; `UI.actions`, `UI.segmented`, `UI.suggest`, `.list`/`.cell` |
| 1.2 | 02/11/2026 | **Área restrita (login + gestão) retirada.** Painel de resumo/filtros, detalhes, busca, barra de localização e estado vazio refeitos no padrão: `.nav-bar` com Limpar/OK, `.kpi-card`, `.section`, `.cell.kv`, `.switch-cell`, `.type-row` com ✓, `.chip-btn`, `.empty-state`, `.field.compact`, page sheet genérico para telas futuras |
