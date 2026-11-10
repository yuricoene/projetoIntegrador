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

Identidade em **azul** (competência, calma, confiança; cor de tecnologia, ciência e governo).
Tudo sai dos tokens no topo de `css/style.css`: `--accent` (#4d8dff), `--accent-strong` (#1f6feb),
`--accent-soft` e os neutros levemente azulados (`--bg`, `--surface*`, `--border`, `--text*`).
Nunca escreva cor solta no CSS; use os tokens. Duas exceções de propósito:
o **mapa de calor** continua em vermelho/amarelo (ele representa intensidade de ocorrências,
e azul passaria a ideia de "tranquilo"), e ações destrutivas/erros continuam em vermelho (`--danger`).

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

- **Painel de resumo e filtros:** no celular é uma gaveta que sobe de baixo (arrasta para fechar,
  botão voltar fecha) com barra **Limpar · Filtros · OK**; no computador é o painel à esquerda,
  que recolhe. Cartão de resumo no estilo "saldo" dos apps de banco e seções agrupadas:
  localização (interruptor), período (controle segmentado + datas), tipos (células com ✓) e ranking.
- **Detalhes:** cabeçalho com ícone, número grande e listas chave → valor; gaveta com alça no celular.
- **Busca:** campo com limpar (×) e sugestões próprias; no celular confirma pela tecla do teclado.
- **Estado vazio:** cartão com ícone, explicação e "Limpar filtros".

A área restrita (login + gestão de ocorrências) foi retirada em 02/11/2026.

## Funcionalidades

- Mapa de calor em tela cheia sobre o **mapa vetorial escuro do OpenStreetMap**
  (estilo `dark` do OpenFreeMap, gratuito e sem chave). Ele é desenhado com o MapLibre GL
  dentro do Leaflet, pelo plugin `@maplibre/maplibre-gl-leaflet`. Se o navegador não
  tiver WebGL, o site usa automaticamente os tiles raster escuros do CARTO.
- **Busca de endereço** pela API Nominatim do OpenStreetMap (ex.: "Av. Getúlio Vargas 500").
  Se o texto for um bairro da lista, a busca usa o bairro; senão, consulta o Nominatim,
  limitado a Cuiabá e Várzea Grande. Atalho: tecla `/` foca a busca.
- Ícones por tipo, todos no mesmo estilo (selo com degradê, contorno branco e brilho):
  Furto, Roubo, Agressão, Vandalismo, Ameaça. No mapa viram alfinetes com ponta, como no
  Waze. Os desenhos ficam em `ICON_GLYPH` e as cores em `ICON_THEME`, em `js/app.js`.
- **Busca por bairro como filtro**: buscar um bairro faz o mapa mostrar só as ocorrências dele
  (ver seção abaixo). Filtros por período (controle segmentado com pílula deslizante) e por tipo
- **Geolocalização em tempo real**: o botão de localização no canto inferior direito liga e
  desliga o acompanhamento (ponto azul, anel de 1 km, contador, bairro mais próximo,
  Recentralizar, pausa em segundo plano, avisos de sinal fraco/permissão/fora da área).
  A posição fica só em memória: nunca é salva nem enviada (regras RN-G1 a RN-G8, ver `js/app.js`).
- Layout: mapa em tela cheia, busca centralizada no topo, painel de resumo e filtros à esquerda
  (recolhe com animação), legenda no canto inferior esquerdo e zoom + localização no canto
  inferior direito. No celular, os filtros viram uma gaveta inferior arrastável.
- Resumo ao vivo (RF12): contagem por tipo e os 5 bairros com mais registros.

### Busca por bairro como filtro (09/11)

Ao buscar um bairro (pela sugestão, Enter ou botão "Buscar"), o mapa passa a mostrar
**só as ocorrências desse bairro**: mapa de calor, alfinetes, rótulo, total, contagem por
tipo e ranking. Os filtros de período e tipo continuam valendo junto com o bairro.

- Embaixo da busca aparece o aviso **Só [bairro] · Mostrar todos**. O total do painel
  também mostra o bairro (ex.: "Todo o período · Coxipó").
- Voltam a aparecer todos os bairros com: **Mostrar todos**, o **×** do campo de busca,
  apagar o texto, o **Limpar** da gaveta de filtros ou o **Limpar filtros** do estado vazio.
- Buscar um **endereço** (Nominatim) tira o filtro de bairro, porque o resumo "Perto deste
  endereço" conta o que há em volta, de qualquer bairro.
- Ligar a **localização em tempo real** também tira o filtro, para mostrar tudo ao redor
  da pessoa. Com a localização ligada, buscar um bairro filtra normalmente e o contador
  de 1 km respeita esse filtro (RN-G7).
- As sugestões da busca continuam mostrando quantos registros tem cada bairro, mesmo com
  um bairro filtrado.
- No código: variável `bairroFiltro`, funções `doSearch()`, `limparFiltroBairro()` e
  `applyFilters()` em `js/app.js`.

### Desempenho do mapa: zoom e arraste (09/11)

O site travava ao dar zoom. Causas e correções:

| Causa | Correção |
|---|---|
| A cada zoom, todos os alfinetes (cerca de 200 SVGs) eram apagados e recriados | Os alfinetes são montados só quando os dados ou os filtros mudam. No zoom, a camada só entra ou sai do mapa ao cruzar o zoom 14 (`ZOOM_PONTOS`, `atualizarVisibilidadePontos()`) |
| `filter: drop-shadow` em cada alfinete, refeito a cada quadro do zoom | A sombra agora é desenhada dentro do próprio SVG (`pinHtml()`), com o mesmo visual |
| O mapa de calor era redesenhado 2 vezes por zoom (`zoomend` e `moveend`) | Redesenha uma vez por quadro, só quando o movimento termina (`requestAnimationFrame`) |
| Durante a animação do zoom a mancha de calor ficava parada e "pulava" no fim | O canvas acompanha a animação esticando a imagem pronta (`zoomanim`), sem redesenhar |
| Cada redesenho do calor criava um canvas novo e lia a tela inteira | Reaproveita o canvas e lê só o retângulo onde há pontos |
| Os painéis de vidro (`backdrop-filter: blur`) desfocavam o mapa a cada quadro | Enquanto o mapa se move, o desfoque é pausado (classe `map-moving` no `<body>`); volta quando o mapa para |
| No mapa reserva (CARTO), quadros baixados a cada passo do zoom | `updateWhenZooming: false` e `keepBuffer: 4` |

Medição com o processador 4 vezes mais lento (simulando um celular intermediário), 8 zooms
seguidos no zoom 14: **antes**, 29 travadas acima de 50 ms (3,6 s no total, pior quadro de
440 ms); **depois**, nenhuma (pior quadro de 39 ms).

## APIs e bibliotecas externas

| Serviço | Para quê | Chave? |
|---|---|---|
| OpenFreeMap (`tiles.openfreemap.org/styles/dark`) | mapa base, dados OSM | não |
| Nominatim (`nominatim.openstreetmap.org/search`) | busca de endereço | não |
| CARTO `dark_all` | mapa reserva (sem WebGL) | não |
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

São 79 testes: os 50 da geolocalização (todos continuam passando), 18 da busca por bairro
como filtro e 11 do desempenho do zoom (alfinetes não recriados, nenhuma travada acima de
100 ms em zooms seguidos, alfinetes sem `drop-shadow`).

## Aviso importante

Todos os registros exibidos são **fictícios**. Este é um protótipo acadêmico
(Projeto Integrador) e não deve ser usado como fonte real de informação sobre
segurança pública.
