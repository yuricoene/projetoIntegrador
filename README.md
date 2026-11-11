# Projeto Integrador — Mapa de Calor de Violência Urbana

Protótipo funcional do sistema descrito na documentação de requisitos
(RF, RNF, RN, casos de uso, dados etc.), com dados **fictícios** gerados
apenas para fins de demonstração.

> **Vai criar ou alterar uma tela?** Leia antes o [`docs/GUIA-INTERFACE-MOBILE.md`](docs/GUIA-INTERFACE-MOBILE.md):
> é o padrão obrigatório do grupo (app mobile sem Bootstrap, componentes, SweetAlert2 nativo,
> skeleton, animações suaves, paleta azul) com a receita passo a passo.

## Estrutura de pastas

```
projeto-integrador/
├── index.html              → estrutura da página (HTML)
├── docs/GUIA-INTERFACE-MOBILE.md → padrão de interface (leia antes de criar telas)
├── manifest.webmanifest    → PWA: nome, ícone, abre sem a barra do navegador
├── css/style.css           → layout, tema visual, animações, skeleton, alertas
├── js/ui.js                → COMPONENTES de interface (alertas, toasts, skeleton,
│                             animações, gestos, botão voltar) — ver seção abaixo
├── js/app.js               → lógica: dados, mapa de calor, filtros, busca,
│                             geolocalização, painel de resumo e detalhes
├── assets/icons/           → ícones do app (tela inicial do celular)
├── render.yaml             → configuração de deploy no Render
├── testes/                 → testes automatizados da geolocalização (Playwright)
└── README.md
```

## Padrão de interface do grupo (orientações do mentor)

Toda tela ou componente novo segue estas 5 regras. Elas estão aplicadas em **todas** as telas do app
(mapa, busca, painel de resumo e filtros, detalhes, barra de localização, estado vazio e avisos).

| # | Orientação | Como fazemos |
|---|---|---|
| 1 | **Animações** | Tudo que aparece ou some anima (painéis, gaveta, modais, alfinetes, números). Nada usa `display:none → block` seco: use `opacity` + `transform` + `visibility` com transição. Botões "afundam" ao toque (`scale(.94)`). |
| 2 | **Skeleton** | Enquanto carrega, `<body class="is-loading">` transforma em bloco cinza com brilho todo elemento com a classe `.sk`. Para listas, gere linhas falsas com `UI.skel()` / `UI.skeleton()`. O skeleton tem o **mesmo tamanho** do conteúdo final para nada "pular". |
| 3 | **SweetAlert2 nativo** | Nunca chame `Swal.fire`, `alert()` ou `confirm()` direto. Use `UI.alert()`, `UI.confirm()` e `UI.toast()` (em `js/ui.js`). Eles já saem com cara de sistema: alerta estilo iOS no computador, *action sheet* no celular, toast que desce do topo e some ao arrastar. |
| 4 | **Cara de app, não de site** | Sem Bootstrap; telas montadas com componentes de app (barra de navegação Limpar · Filtros · OK, cartão de resumo, seções agrupadas com células, interruptor iOS, gaveta arrastável), fonte do sistema, sem destaque azul ao tocar, sem seleção de texto na interface, campos com 16px (o iPhone não dá zoom), áreas seguras do notch, hover só com mouse, sem barras de rolagem no celular, botão **voltar** do Android fecha a tela aberta, vibração curta nas ações, `manifest.webmanifest` para instalar. |
| 5 | **Animações suaves** | Só animamos `transform` e `opacity` (rodam lisas no celular) e sempre com os tokens do CSS: `--ease-out`, `--ease-spring` (curva das gavetas do iOS), `--dur-fast/base/slow/sheet`. Quem ativa "reduzir movimento" no aparelho recebe a versão sem animação. |

### Paleta de cores

**Tema claro** com destaque **azul** (competência, calma, confiança): mapa claro, superfícies
brancas, texto quase preto (`--text` #0f1729), destaque `--accent` (#1f6feb) e botão de
localização escuro (`--ink` #111827). Tudo sai dos tokens no topo de `css/style.css`; nunca
escreva cor solta no CSS. Duas exceções de propósito: o **mapa de calor** continua quente
(rosa → amarelo, porque representa intensidade de ocorrências) e ações destrutivas/erros
continuam em vermelho (`--danger`). Tabela completa: seção 3.1 do guia.

**Tema escuro (opcional, 10/11):** os mesmos tokens redefinidos em `html[data-theme="dark"]`,
no fim de `css/style.css`. Ver "Tema claro e escuro" abaixo e a seção 12.8 do guia.

### Componentes disponíveis (`js/ui.js`)

```js
UI.toast('Dados atualizados.', 'success');        // 'info' | 'success' | 'warning' | 'error'
UI.alert('Sem internet', 'Tente de novo em instantes.');
const acao = await UI.actions({ title:'CPA', actions:[             // menu de ações nativo
  {text:'Ver no mapa', value:'ver'}, {text:'Compartilhar', value:'share'}] });
UI.segmented(el, { onChange: botao => … });          // abas/filtros com pílula deslizante
UI.suggest(input, { source, extra, onPick });        // sugestões de busca (sem <datalist>)
const ok = await UI.confirm({                       // action sheet no celular, alerta no PC
  title: 'Desativar a localização?',
  text: 'O contador perto de você para de atualizar.',
  confirmText: 'Desativar', destructive: true
});
UI.skel('80%', '12px', 'line');                     // um bloco de skeleton
UI.skeleton(5, i => `<li>${UI.skel('70%','11px')}</li>`); // várias linhas
UI.countTo(elemento, 52);                            // número que "corre" até o valor
UI.stagger(lista);                                   // itens entram um após o outro
UI.shake(elemento); UI.haptic('error');              // erro: balança + vibra
UI.layers.open('minhaTela', fecharMinhaTela);        // botão voltar do celular fecha a tela
UI.draggableSheet(gaveta, [alca], fechar);           // arrastar para baixo fecha
```

### Telas no padrão de app

- **Gaveta principal (inspirada no Waze):** no celular fica sempre na tela, baixinha, com a busca
  "Para onde?" e os atalhos **Filtros · Perto de mim · período**; arrastando a alça sobe até a
  metade ou quase inteira (botão voltar abaixa). Botões do mapa redondos, logo acima dela.
  No computador vira o painel fixo à esquerda, com a busca no topo, como no Waze Live Map.
- **Painel de resumo e filtros:** barra **Limpar · Resumo e filtros**. Cartão de resumo no estilo "saldo" dos apps de banco e seções agrupadas:
  localização (interruptor), período (controle segmentado + datas), tipos (células com ✓) e ranking.
- **Detalhes:** cabeçalho com ícone, número grande e listas chave → valor; gaveta com alça no celular.
- **Busca:** campo com limpar (×) e sugestões próprias; no celular, tocar na busca abre a gaveta inteira
  e a confirmação é pela tecla do teclado.
- **Barra de localização:** no celular fica no topo da tela; no computador, embaixo no centro.
- **Estado vazio:** cartão com ícone, explicação e "Limpar filtros".

A área restrita (login + gestão de ocorrências) foi retirada em 02/11/2026.

## Funcionalidades

- Mapa de calor em tela cheia sobre o **mapa vetorial claro do OpenStreetMap**
  (estilo claro `positron` do OpenFreeMap, gratuito e sem chave). Ele é desenhado com o MapLibre GL
  dentro do Leaflet, pelo plugin `@maplibre/maplibre-gl-leaflet`. Se o navegador não
  tiver WebGL, o site usa automaticamente os tiles raster claros do CARTO.
- **Busca de endereço** pela API Nominatim do OpenStreetMap (ex.: "Av. Getúlio Vargas 500").
  Se o texto for um bairro da lista, a busca usa o bairro; senão, consulta o Nominatim,
  limitado a Cuiabá e Várzea Grande. Atalho: tecla `/` foca a busca.
- Ícones por tipo, todos no mesmo estilo (selo com degradê, contorno branco e brilho):
  Furto, Roubo, Agressão, Vandalismo, Ameaça. No mapa viram alfinetes com ponta, como no
  Waze. Os desenhos ficam em `ICON_GLYPH` e as cores em `ICON_THEME`, em `js/app.js`.
- **Tema claro (sol) ou escuro (lua)**, à escolha da pessoa (ver seção abaixo).
- **Busca por bairro como filtro**: buscar um bairro faz o mapa mostrar só as ocorrências dele
  (ver seção abaixo). Filtros por período (controle segmentado com pílula deslizante) e por tipo
- **Geolocalização em tempo real**: o botão de localização no canto inferior direito liga e
  desliga o acompanhamento (ponto azul, anel de 1 km, contador, bairro mais próximo,
  Recentralizar, pausa em segundo plano, avisos de sinal fraco/permissão/fora da área).
  A posição fica só em memória: nunca é salva nem enviada (regras RN-G1 a RN-G8, ver `js/app.js`).
- Layout: mapa em tela cheia; no computador, painel à esquerda com a busca no topo
  (recolhe com animação), legenda no canto inferior esquerdo e zoom + localização no canto
  inferior direito. **No celular (10/11), a gaveta principal fica presa no TOPO**: busca, chave
  do tema e atalhos sempre à vista; **puxando para baixo** ela abre até a metade ou quase
  inteira, com resumo e filtros (ver "Gaveta da busca no topo" abaixo).
- Resumo ao vivo (RF12): contagem por tipo e os 5 bairros com mais registros.

### Tema claro e escuro (10/11)

O **claro** continua sendo o padrão aprovado pelo grupo; o **escuro** é opcional (cansa menos
a vista à noite, que é quando a persona mais usa o mapa). Pensado primeiro para o celular:

- **Chave (interruptor) ao lado da busca**, sempre à vista no celular e no computador, no
  estilo da referência do grupo: **claro = trilho laranja com sol branco**; **escuro = trilho
  preto com lua branca**; a **bolinha branca desliza** para o lado ao trocar. Um toque troca.
  Área de toque de 66×50 px. Para leitores de tela é um interruptor (`role="switch"`) chamado
  "Tema escuro": ligado (bolinha à direita) = escuro. Funciona também pelo teclado (espaço).
- Muda tudo junto: interface (tokens do CSS), **mapa base** (OpenFreeMap `positron` ↔ `dark`;
  na reserva, CARTO `light_all` ↔ `dark_all`), **cores do mapa de calor** e da legenda, **ponto
  azul** da localização e a cor da barra do navegador no celular.
- A escolha fica **salva no aparelho** (`localStorage`, chave `tema`). Um script no `<head>` do
  `index.html` aplica o tema antes de a página aparecer, então quem escolheu escuro não vê a
  tela piscar em branco ao abrir.
- No código: `TEMAS`, `aplicarTema()`, `atualizarControlesTema()` e `trocarMapaBase()` em
  `js/app.js`; a chave é `.theme-switch` no `css/style.css` (só anima transform e opacity); tokens escuros em
  `html[data-theme="dark"]` no fim de `css/style.css`. Para o app seguir o tema do celular
  quando a pessoa ainda não escolheu, troque a primeira linha do script do `<head>` por
  `var t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';`.

### Gaveta da busca no topo (celular, 10/11)

No celular a gaveta principal saiu de baixo e ficou **presa no topo da tela**, como uma
barra de pesquisa de app:

- **Fechada (baixinha):** busca, chave do tema, aviso do filtro de bairro (quando houver) e os
  atalhos **Filtros · Perto de mim · Período**. Embaixo dela fica a **alça**, em toda a largura.
- **Para ver mais opções, puxe para baixo** (pela alça, pela área da busca ou pela barra
  "Resumo e filtros"): ela para na **metade** ou **quase inteira**, com o resumo, a localização,
  o período, os tipos e o ranking. Soltar com velocidade vai para a próxima altura na direção do
  gesto. **Puxar para cima** fecha. O atalho "Filtros", o "Período" e o botão voltar do celular
  continuam funcionando.
- Tocar na busca abre a gaveta inteira, com espaço para as sugestões e o teclado.
- O que ficava no topo do mapa desceu para perto do polegar: **Atualizar** fica no canto de
  baixo, logo acima da **localização**. A **barra da localização** e os **avisos** (toasts)
  aparecem logo abaixo da gaveta.
- No código: `UI.detentSheet(..., {edge:'top'})` em `js/ui.js` (no modo topo a gaveta muda de
  altura em vez de deslizar, então a busca fica sempre no topo e o conteúdo rola certo em
  qualquer altura) e o bloco `@media (max-width: 820px)` do `css/style.css`.
- No computador nada mudou: painel à esquerda, com a busca e a chave do tema no topo.

### Busca por bairro como filtro (10/11)

Ao buscar um bairro, o mapa passa a mostrar **só as ocorrências desse bairro**: mapa de calor,
alfinetes, rótulo, total, contagem por tipo e ranking. Período e tipo continuam valendo junto.

- Abaixo da busca (na gaveta do topo, no celular) aparece **Só [bairro] · Mostrar todos**. O total do painel
  também mostra o bairro (ex.: "Todo o período · Coxipó").
- Voltam todos os bairros com: **Mostrar todos**, o **×** da busca, apagar o texto, o
  **Limpar** do painel ou o **Limpar filtros** do estado vazio.
- Buscar um **endereço** ou ligar a **localização em tempo real** tira o filtro, porque
  nesses casos importa o que há em volta, de qualquer bairro. Com a localização ligada,
  buscar um bairro filtra normalmente e o contador de 1 km respeita o filtro (RN-G7).
- As sugestões da busca continuam mostrando quantos registros tem cada bairro.
- No código: `bairroFiltro`, `doSearch()`, `limparFiltroBairro()` e `applyFilters()`.

### Desempenho do mapa: zoom e arraste (10/11)

| Causa do travamento | Correção |
|---|---|
| A cada zoom, todos os alfinetes (cerca de 200 SVGs) eram apagados e recriados | Montados só quando dados ou filtros mudam; no zoom a camada só entra ou sai ao cruzar o zoom 14 (`ZOOM_PONTOS`, `atualizarVisibilidadePontos()`) |
| `filter: drop-shadow` em cada alfinete, refeito a cada quadro | A sombra é desenhada no próprio SVG (`pinHtml()`), com o mesmo visual |
| Mapa de calor redesenhado 2 vezes por zoom | Uma vez por quadro, só quando o movimento termina (`requestAnimationFrame`) |
| A mancha de calor ficava parada no zoom e "pulava" no fim | O canvas acompanha a animação esticando a imagem pronta (`zoomanim`) |
| Cada redesenho criava um canvas novo e lia a tela inteira | Reaproveita o canvas e lê só o retângulo com pontos |
| Painéis de vidro desfocavam o mapa a cada quadro | O desfoque pausa enquanto o mapa se move (`body.map-moving`) |
| Mapa reserva baixava quadros a cada passo do zoom | `updateWhenZooming: false` e `keepBuffer: 4` |

Na versão anterior do projeto, com o processador 4 vezes mais lento (simulando um celular
intermediário), 8 zooms seguidos davam 29 travadas acima de 50 ms (pior quadro de 440 ms);
com estas correções, nenhuma (pior quadro de 39 ms).

## APIs e bibliotecas externas

| Serviço | Para quê | Chave? |
|---|---|---|
| OpenFreeMap (`tiles.openfreemap.org/styles/positron` e `/dark`) | mapa base claro e escuro, dados OSM | não |
| Nominatim (`nominatim.openstreetmap.org/search`) | busca de endereço | não |
| CARTO `light_all` | mapa reserva (sem WebGL) | não |
| SweetAlert2 11 (jsDelivr) | alertas, confirmações e toasts | não |

Se o SweetAlert2 não carregar (sem internet), os avisos continuam aparecendo num aviso
simples da própria página e as confirmações usam a do navegador.

O Nominatim permite no máximo 1 busca por segundo e não permite autocompletar.
Por isso a busca só roda quando a pessoa confirma (Enter, tecla "buscar" do teclado ou botão "Buscar").

## Onde ficam os dados

Os registros são **fictícios**, gerados na primeira abertura e guardados no `localStorage`
do navegador. Para dados reais, troque `loadOccurrences()` (seção `STORAGE LAYER` em
`js/app.js`) por uma chamada à API.
O skeleton já está ligado ao carregamento: com a API, ele aparece durante o `fetch`
de verdade (hoje há um tempo mínimo de 600 ms, `SKELETON_MIN_MS`, só para demonstração).

## Publicar no Render

1. Crie um repositório no GitHub e envie estes arquivos (com `index.html` na raiz).
2. Em https://dashboard.render.com clique em **New → Static Site** e conecte o repositório.
3. **Build Command:** vazio · **Publish Directory:** `.`
4. Clique em **Create Static Site**.

A geolocalização exige HTTPS (o Render já entrega). No celular, use "Adicionar à tela
inicial" para abrir como app, sem a barra do navegador.

## Testes da geolocalização

```
cd testes
npm install
npx playwright install chromium
npm test
```

São 145 testes, todos passando: os 50 da geolocalização, 18 da busca por bairro como filtro,
11 do desempenho do zoom, 18 da chave do tema no computador e 48 do celular (24 em cada:
iPhone 14 e um Android pequeno simulados). Os do celular conferem a gaveta no topo **com gesto
de toque de verdade** (puxar para baixo abre, para cima fecha), a alça à vista, a chave do tema
na linha da busca com 44 px ou mais, os botões de baixo, a barra da localização logo abaixo da
gaveta e o aviso do filtro de bairro.

## Aviso importante

Todos os registros exibidos são **fictícios**. Este é um protótipo acadêmico
(Projeto Integrador) e não deve ser usado como fonte real de informação sobre
segurança pública.
