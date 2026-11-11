# Guia de Interface Mobile — Projeto Integrador (Mapa de Violência Urbana)

> **Leia antes de criar ou alterar qualquer tela.** Este guia é o padrão obrigatório do
> grupo, definido pelo mentor. Toda nova implantação segue estes passos e **cria
> componentes** em vez de escrever HTML/CSS/JS solto em cada tela.
>
> **Vale para TODAS as telas e partes do sistema**, sem exceção.
>
> Versão 1.6 · 10/11/2026 — **gaveta da busca presa no topo** no celular (puxar para baixo abre) e
> **chave do tema** no estilo interruptor (laranja com sol / preto com lua) ao lado da busca.
> 1.5 · 10/11/2026 — tema escuro opcional, busca por bairro como filtro e mapa sem travar no zoom.
> 1.4 · 04/11/2026 — **tema claro** (mapa claro, superfícies brancas, destaque azul).
> 1.3 · 02/11/2026 — layout de app inspirado no Waze (gaveta sempre na tela com a busca
> "Para onde?", atalhos, botões redondos). Referência: doc "Waze Live Map: UI/UX, bibliotecas e
> instruções para o PWA". A área restrita (login + gestão) foi retirada na 1.2.

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
| Gaveta principal (celular) | **sempre na tela**, como no Waze/Apple Maps: baixinha mostra a busca e os atalhos; arrastando sobe até a metade ou quase inteira (`UI.detentSheet`); voltar abaixa | ✅ |
| Busca "Para onde?" | dentro da gaveta (celular) ou no topo do painel (computador), como no Waze; lupa, limpar (×), botão redondo com seta no PC; sugestões próprias (`UI.suggest`); no celular, tocar na busca abre a gaveta inteira | ✅ |
| Atalhos (celular) | chips **Filtros** (com contagem), **Perto de mim** (liga a localização) e **período** (abre a gaveta no período), como os atalhos "Casa/Trabalho" do Waze | ✅ |
| Botões do mapa | redondos; no celular ficam logo acima da gaveta baixinha e somem quando ela sobe | ✅ |
| Painel de resumo e filtros | dentro da gaveta (celular) ou painel fixo à esquerda de 340 px que recolhe (computador, como o painel do Waze Live Map). Barra **Limpar · Resumo e filtros**; cartão de resumo estilo "saldo" de banco; seções agrupadas (`.section` + `.list-group` + `.cell`) | ✅ |
| — Localização | célula com ícone e **interruptor iOS** sincronizado com o botão do mapa | ✅ |
| — Período | controle segmentado (`UI.segmented`); datas personalizadas em campos `.field` | ✅ |
| — Tipo de ocorrência | células com ícone, barra, número e marca ✓ ao filtrar | ✅ |
| — Bairros com mais registros | células com posição, barra, número e seta › | ✅ |
| Detalhes (bairro, ocorrência, perto de você, endereço) | cabeçalho com ícone, número grande e listas chave → valor; no celular é uma gaveta própria que sobe por cima da principal (arrastar e "voltar" fecham) | ✅ |
| Barra de localização | no celular fica no topo (como o aviso de viagem do Waze), longe das gavetas; no PC embaixo, no centro; ações em botões-pílula (`.chip-btn`) | ✅ |
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

### 3.1 Cores — tema claro com destaque azul

Desde a versão 1.4 o app usa **tema claro** (aprovado pelo grupo a partir de um print de referência):
mapa claro, superfícies brancas, texto quase preto e azul como destaque. É o visual dos apps de
mapa no celular (Waze, Apple Maps, Google Maps no modo dia).

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#eceff3` | fundo do mapa enquanto carrega |
| `--surface` / `--surface-2` | `#ffffff` | gaveta, busca, chips, listas, cartões |
| `--surface-3` / `--hover` | `#f1f3f6` / `#eef1f5` | fundos secundários (botão fechar, toque) |
| `--skel` | `#e6e9ee` | blocos de skeleton |
| `--border`, `--hairline` | `#dde1e7`, `rgba(15,23,42,.10)` | bordas dos campos/chips e divisórias finas |
| `--text`, `--text-dim`, `--text-faint` | `#0f1729`, `#5b6575`, `#8b94a3` | hierarquia de texto |
| `--ink` | `#111827` | botão escuro de destaque (localização) |
| `--accent` / `--accent-strong` | `#1f6feb` / `#1a62d6` | destaque: contagens, foco, botão de busca, pílulas |
| `--accent-soft` | `rgba(31,111,235,.12)` | fundo de item ativo (chip ligado, seleção) |
| `--accent-rgb` | `31,111,235` | para `rgba(var(--accent-rgb), x)` |
| `--ios-blue` | `#007aff` | botões de texto (Cancelar, Limpar), ação padrão de alerta |
| `--ios-green` | `#34c759` | interruptor ligado, sucesso |
| `--danger` | `#e5372e` | **só** ação destrutiva e erro |
| `--warn` | `#c77800` | aviso (escuro o bastante para ler no branco) |
| `--heat` | rosa → vermelho → laranja → amarelo | **só** dados do mapa de calor (`#ffb3ba → #ef4444 → #f97316 → #facc15`, mesmas cores do `HeatLayer`) |
| `--shadow` | sombra suave azul-acinzentada | superfícies flutuantes (nunca sombra preta forte no tema claro) |

Mapa base: OpenFreeMap **positron** (claro); reserva sem WebGL: CARTO **light_all**.
Barra do celular: `theme-color` `#ffffff` e status bar `default` (ícones escuros).

Exceções intencionais: o mapa de calor continua quente (azul passaria a ideia de "área
tranquila") e ações destrutivas continuam vermelhas. O cartão de resumo é o único bloco azul
cheio, com texto branco (como o cartão de saldo dos apps de banco).

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
| `UI.layers.open(id, fechar)` / `.close(id)` / `.swap(a, b, fechar)` | botão **voltar** do celular fecha a camada de cima (uma só entrada no histórico; abrir e fechar no mesmo instante não bagunça o "voltar") | gaveta, detalhes |
| `UI.detentSheet(el, {handles, peekUntil, onChange})` | **gaveta sempre na tela com 3 alturas** (`peek` → `half` → `full`): arrasta, solta com velocidade, encaixa na altura mais próxima; publica `--sheet-peek` no CSS; devolve `{set(altura), get(), refresh()}` | gaveta principal |
| `UI.draggableSheet(el, alcas, fechar, classeAberta)` | gaveta que fecha arrastando para baixo | detalhes (`'show'`) |
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
| `.fab` / `.zoom-group` | botão redondo flutuante de vidro / zoom em pílula | Waze / Apple Maps |
| `.sidebar` + `.sheet-handle` + `.sheet-top` + `.scrim` | gaveta principal (com `UI.detentSheet`) no celular; painel fixo no PC | Waze / Apple Maps |
| `.search` + `.search-ico` + `.search-clear` + `.search-go` | campo de busca de app ("Para onde?") | Waze |
| `.quick-chips` + `.quick-chip` (`aria-pressed` / `aria-expanded` = ativo) | fila de atalhos roláveis | atalhos do Waze |
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

### 12.6 Cara de app inspirada no Waze (revisão 1.3)

Base: o doc "Waze Live Map: UI/UX, bibliotecas e instruções para o PWA" (painel fixo de ~300 px
no computador; no celular, busca compacta e cartões perto do polegar; botões redondos à direita).

**Antes:** barra de busca flutuando no topo como em site, botão "Filtros" solto embaixo, gaveta que
só aparecia ao tocar no botão, botões quadrados.

**Depois (celular):**
```
┌────────────────────────────┐
│ [● 20 registros · Quilombo] (⟳) │  ← barra de localização no topo
│                            │
│          mapa              │
│                       (◎)  │  ← botões redondos, logo acima da gaveta
│ ╭──────── ▬ ─────────────╮ │
│ │ 🔍 Para onde? Bairro…   │ │  ← gaveta SEMPRE na tela (peek)
│ │ [Filtros 201][Perto de mim][Todo o período] │
╰─┴──────────────────────────┘
   arrasta ↑ meia altura → resumo e filtros · arrasta ↑ inteira · voltar ↓
```
```js
sheet = UI.detentSheet($('sidebar'), {
  handles: [alca, $('sheetTop'), barra], peekUntil: $('sheetTop'), onChange: onSheetChange
});
$('searchInput').addEventListener('focus', () => openSheet('full'));   // busca abre inteira
```
**Depois (computador):** busca no topo do painel fixo à esquerda (340 px), como o painel do Waze
Live Map, com botão redondo de seta; a busca flutuante do centro saiu.

**Próximos passos sugeridos pelo doc do Waze (ainda não feitos):** origem/destino empilhados com
até 3 rotas e selo "MAIS SEGURA" (OpenRouteService + Turf.js), botão "Reportar", convite de
instalação do PWA e service worker. Todos devem seguir este guia.

### 12.7 Tema claro (revisão 1.4)

**Antes:** tema escuro (fundos `#070b12`, mapa `dark`). **Depois:** o print de referência do grupo:
mapa claro (positron), gaveta e busca brancas com borda fina, chips brancos com ícone escuro,
contagem em pílula azul, botão de atualizar branco e redondo, botão de localização escuro
(`--ink`), etiquetas de bairro cinza-claro com número azul, alertas do SweetAlert2 no estilo
claro do iOS. Só os tokens mudaram (mais o estilo do mapa e o degradê do mapa de calor);
componentes e layout continuam os mesmos.

```css
/* antes */  --bg:#070b12; --surface:#0f1520; --text:#eef3fb; --accent:#4d8dff;
/* depois */ --bg:#eceff3; --surface:#ffffff; --text:#0f1729; --accent:#1f6feb; --ink:#111827;
```

### 12.8 Tema escuro opcional, filtro de bairro e desempenho (revisão 1.5)

**Tema.** O claro continua sendo o padrão. O escuro é opcional e sai **só de tokens**:
o bloco `html[data-theme="dark"]` no fim de `css/style.css` redefine as mesmas variáveis
(`--bg`, `--surface`, `--text`, `--accent`, `--ink`, `--heat`...). Regra para telas novas:
**use sempre os tokens**; se precisar de uma cor fixa de tema claro, acrescente a versão
escura no mesmo bloco. O que o CSS não alcança (mapa base, cores do mapa de calor e do
ponto azul) fica em `TEMAS` no `js/app.js`.

- **Onde trocar (revisão 1.6):** a **chave** `.theme-switch` ao lado da busca, sempre à vista.
  Claro = trilho laranja (`#ff5a0a`) com sol branco; escuro = trilho preto com lua branca;
  bolinha branca que desliza. `role="switch"`, nome "Tema escuro", ligado = escuro. Os dois
  fundos ficam empilhados e trocam por opacidade (só transform/opacity, item 5).
- **Sem piscar:** a escolha fica salva no aparelho (`localStorage` "tema") e um script no
  `<head>` aplica o tema antes de a página aparecer.
- **Mobile first:** os estilos novos são escritos para o celular (alvos de toque de 44 px) e
  só ajustados para o computador com `@media (min-width: 821px)`.

**Filtro de bairro.** Buscar um bairro mostra só as ocorrências dele; o aviso
"Só [bairro] · Mostrar todos" (`.bairro-chip`) fica na gaveta, logo abaixo da busca.

**Desempenho.** Nada de `filter: drop-shadow` em elementos que se repetem no mapa (a sombra vai
no SVG); camadas com muitos itens são montadas uma vez e só ligadas/desligadas no zoom; o
vidro (`backdrop-filter`) pausa enquanto o mapa se move (`body.map-moving`).

### 12.10 Gaveta da busca no topo (revisão 1.6)

**Antes:** gaveta principal embaixo, subindo. **Depois:** no celular ela fica **presa no topo**
(`UI.detentSheet` com `edge:'top'`): baixinha mostra busca + chave do tema + atalhos; **puxar
para baixo** abre até a metade ou quase inteira; a **alça** fica embaixo dela, em toda a largura
(área de toque grande, acima da barra sticky "Resumo e filtros"). No modo topo a gaveta muda de
**altura** (com `contain: layout paint`) em vez de deslizar, para a busca ficar sempre no topo e
o conteúdo rolar certo. "Atualizar" desceu para o canto de baixo, acima da localização; a barra
da localização e os toasts aparecem logo abaixo da gaveta (`--sheet-peek`). Os detalhes
continuam numa gaveta própria que sobe de baixo. Telas novas no celular: **nada fixo no topo
do mapa**, que agora é da gaveta da busca.

### 12.9 Revisões anteriores

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
| 1.6 | 10/11/2026 | **Gaveta da busca presa no topo** no celular (`UI.detentSheet` `edge:'top'`, puxar para baixo abre, alça embaixo); **chave do tema** estilo interruptor ao lado da busca (laranja/sol, preto/lua, `role="switch"`); "Atualizar" no canto de baixo; barra da localização e toasts abaixo da gaveta; seção "Aparência do mapa" e botão redondo do tema retirados |
| 1.5 | 10/11/2026 | **Tema escuro opcional** (tokens em `html[data-theme="dark"]`, botão sol/lua no mapa, "Claro \| Escuro" na gaveta, salvo no aparelho, sem piscar); aviso de filtro de bairro (`.bairro-chip`); regras de desempenho do mapa |
| 1.4 | 04/11/2026 | **Tema claro** a partir do print do grupo: tokens claros, `--ink` e `--skel` novos, mapa positron / CARTO light_all, mapa de calor rosa→amarelo mais suave, alertas claros do iOS, cartão de resumo azul cheio, botão de localização escuro |
| 1.3 | 02/11/2026 | Layout de app inspirado no Waze: gaveta principal sempre na tela com 3 alturas (`UI.detentSheet`), busca "Para onde?" dentro da gaveta/painel, atalhos (`.quick-chip`), botões redondos, barra de localização no topo no celular, detalhes como gaveta própria, painel de 340 px no PC; `UI.layers` sem corrida no histórico |
| 1.2 | 02/11/2026 | **Área restrita (login + gestão) retirada.** Painel de resumo/filtros, detalhes, busca, barra de localização e estado vazio refeitos no padrão: `.nav-bar` com Limpar/OK, `.kpi-card`, `.section`, `.cell.kv`, `.switch-cell`, `.type-row` com ✓, `.chip-btn`, `.empty-state`, `.field.compact`, page sheet genérico para telas futuras |
