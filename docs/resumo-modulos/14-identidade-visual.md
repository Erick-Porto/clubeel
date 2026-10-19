# 14 — Identidade visual (rebrand v4 "Módulos", grená)

Vale para **toda tela** do app. É a mesma identidade do Lara ("Identidade visual", rebrand v4), adaptada a este projeto: aqui não há Tailwind nem Blade — os tokens são **variáveis CSS** em [globals.css](../../styles/globals.css) e as peças são componentes React em [app/components/UI/](../../app/components/UI/) com estilos em CSS Modules.

## Princípios

1. **Cor é token, nunca valor.** Use `var(--surface)`, `var(--ink-2)`, `var(--line)`, `var(--grena)`… Nunca `#fff`, `#333`, `white` nem hex de marca. Os tokens trocam sozinhos no tema escuro; uma cor fixa fica errada em um dos dois temas.
2. **Tema escuro entra junto.** Toda tela nova funciona nos dois temas desde o primeiro dia.
3. **Grená é ação; carmim é só o logo.** Botão principal, link, foco e seleção são grená. Amarelo e vermelho em superfície ficam reservados a `warn` e `danger`.
4. **Cada módulo tem a sua cor** (capa, ícone, substituto de imagem). Ela diz *onde* a pessoa está; não é cor de ação.
5. **Toda tela que lista vários registros tem busca** (`SearchBar` + `matchesSearch`, filtrando na própria tela).
6. **Cartões grandes com imagem** nas listas; tabela só onde comparar linhas importa (itens da ordem de compra, convidados). No celular, a tabela da ordem vira cartões.
7. **Estado em texto, não só em cor.** Selos (`Pill`) levam rótulo e ícone.
8. **Sem serviço externo de imagem.** Quem não tem foto recebe o substituto na cor do módulo (`Media`, ícone ou iniciais). `placehold.co` foi removido.
9. **Celular primeiro.** Barra inferior de módulos, barras de ação fixas (agendamento, pré-reserva), alvos de toque ≥ 44px, campos com 16px (sem zoom no iPhone), áreas seguras (`env(safe-area-inset-*)`).

## Tipografia

| Uso | Fonte | Como |
|---|---|---|
| Títulos (tela, seção, cartão, capa) | Unbounded 500–700 | `font-family: var(--font-display)` + `letter-spacing: -.02em` |
| Texto e interface | Figtree 400–800 | padrão do `body` (`var(--font-sans)`) |
| Dados: CPF, matrícula, valores, datas, horários, códigos | JetBrains Mono | `var(--font-mono)` + `font-variant-numeric: tabular-nums` (ou `ui.mono`) |

Rótulo de seção pequeno: `ui.label` (11px, 700, maiúsculas, `letter-spacing .08em`, `--ink-3`).

## Paleta

Cada token existe como **canais** (`--grena-rgb: 138 21 56`, para opacidade: `rgb(var(--grena-rgb) / .2)`) e como **cor pronta** (`--grena`). O tema escuro troca só os canais.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `canvas` | `#F5F3F3` | `#120C0E` | Fundo da página |
| `surface` | `#FFFFFF` | `#1C1417` | Cartões, painéis, campos |
| `subtle` | `#EEEAEA` | `#271D20` | Fundo secundário, hover, trilho de abas |
| `line` / `line-strong` | `#E3DDDE` / `#D0C7C9` | `#33272B` / `#47373C` | Divisórias / borda de campo e botão secundário |
| `ink` / `ink-2` / `ink-3` | `#1E1215` / `#5A4A4E` / `#8C7C80` | `#F3ECEE` / `#BFAEB3` / `#87767B` | Texto principal / apoio / rótulos |
| `grena` / `grena-hover` | `#8A1538` / `#6F0F2C` | `#B0284F` / `#C43A62` | Botão principal, seleção |
| `grena-ink` | `#8A1538` | `#F28CA8` | Link e texto de ação sobre superfície |
| `grena-tint` | `#F6E3E9` | `#3B1522` | Destaque leve, anel de foco |
| `ok` / `ok-soft` | `#147A45` / `#DDF3E6` | `#56CF8D` / `#10301F` | Disponível, pago, confirmado, aceso |
| `warn` / `warn-soft` | `#935700` / `#FBEFD8` | `#E6AE52` / `#33260F` | Pendente, aguardando, carrinho, prazo |
| `danger` / `danger-soft` | `#C22B2B` / `#FCE4E4` | `#FF7B7B` / `#3A1616` | Recusado, cancelado, bloqueado, erro |
| `on-solid` | branco | `#120C0E` | Texto sobre fundo sólido `ok`/`warn`/`danger` |

Texto sobre botão grená é sempre branco (`#fff`). Os nomes antigos (`--grena-light`, `--grena-dark`, `--background`, `--foreground`…) continuam como apelidos dos tokens novos, para estilos inline legados.

### Módulos

| Chave (`Area`) | Onde | Fundo claro / tinta | Origem no Lara |
|---|---|---|---|
| `inicio` | Início | `#F6E3E9` / `#8A1538` | inicio |
| `quadras` | Esportes, quadras, horários, checkout | `#D9F3E2` / `#17693F` | reservas |
| `social` | Espaços sociais | `#FFE4D3` / `#9A4312` | freela |
| `replay` | Replay, Meus vídeos | `#E8E0FF` / `#5A2DB0` | externos |
| `luz` | Luz da quadra | `#E3F0C0` / `#4A6508` | placar |
| `perfil` | Perfil, avatar | `#DDE3F0` / `#34426A` | cartao |
| `compras` | Aprovação de compras | `#ECE5DB` / `#6A4F2F` | compras |

As cores do **tema escuro** dos módulos foram propostas no rebrand (o arquivo do Lara não as trazia); se o Lara publicar as dele, troque nos dois blocos escuros de `globals.css`. Para aplicar: `style={areaStyle("social")}` define `--c`/`--ci` (canais) e o CSS usa `rgb(var(--c))` / `rgb(var(--ci))`. Módulo novo: tokens `--a-<chave>-rgb`/`--a-<chave>-ink-rgb` nos **três** blocos de `globals.css` e a chave no tipo `Area` de `ui.tsx`.

### Forma

| Item | Valor |
|---|---|
| Cartão / painel | raio `var(--radius-card)` (18px), `var(--shadow-card)` |
| Painel flutuante (menu, modal) | `var(--shadow-pop)` |
| Botões, busca, selos, abas | pílula (`border-radius: 999px`) |
| Campos | raio `var(--radius-field)` (12px) — a base já vem de `globals.css` |

## Tema escuro

- Padrão: segue o sistema (`prefers-color-scheme`).
- O sócio pode fixar Claro/Escuro em **menu do usuário → Tema**; a escolha fica em `localStorage["cfcsn-theme"]` e vira `data-theme` no `<html>` (script no `<head>` do layout raiz, antes da pintura).
- Em CSS, o tema escuro se escreve **só** nos blocos de tokens de `globals.css`. Quando algo precisa trocar de verdade (ex.: logo branco), use o par de seletores `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) … }` + `:root[data-theme='dark'] …` (ver `header.module.css`).
- Os gradientes por banco do cartão de pagamento (`payment-selector.module.css`) são cores das marcas dos bancos e ficam fixos nos dois temas.

## Modelo de tela (sócio)

```tsx
<div className={globalStyle.page}>          {/* page.module.css: casca em coluna, rodapé no fim */}
  <Header />                                {/* topo + barra inferior no celular */}
  <SocialCover />                           {/* só em módulo com abas */}
  <main className={`${globalStyle.main} ${ui.page}`}>   {/* miolo 1200px, gutter 16px */}
    <PageHeader backHref="/…" kicker="…" title="…" lead="…" actions={…} />
    <SearchBar id="busca-x" value={q} onChange={setQ} placeholder="Buscar …" />
    <div className={ui.grid}>…cartões…</div>
  </main>
  <Footer />
</div>
```

- A área `/aprovacao` tem casca própria (`aprovacao.module.css`, Server Components) e não usa `Header`/barra inferior; a busca da fila é um componente de cliente que só filtra o HTML já renderizado.
- Login e "esqueci a senha" são páginas próprias (sem cabeçalho). No celular o login mostra o formulário num cartão translúcido sobre as fotos do carrossel (fixas ao fundo). O botão **RePET** do login usa as duas cores do módulo `replay` invertidas (tinta no fundo, tom claro no texto) para contrastar nos dois temas.

## Pegadinhas

- **Fontes** vêm por `@import` do Google Fonts em `globals.css` (o navegador do sócio busca). Não troque por `next/font` sem confirmar que o servidor de build tem internet.
- **`--grena` é cor; `--grena-rgb` são canais.** `rgba(var(--grena-rgb), .3)` (com vírgula) não funciona: use `rgb(var(--grena-rgb) / .3)`.
- **Texto grená sobre superfície** usa `--grena-ink`, não `--grena` (no escuro o grená fica escuro demais para texto).
- **Classe montada com variável** num CSS Module não existe; para a cor do módulo use `areaStyle()`.
- **Barra inferior**: elementos fixos no rodapé devem ficar acima dela (`bottom: var(--bottom-nav-height)`), como a barra de ação dos horários e o envio da pré-reserva.
- **Tutorial**: os `id`s alvo (ver [11](11-ui-compartilhada.md)) não podem mudar ao redesenhar uma tela.
- **`text-transform: capitalize`** em datas vira "De Outubro De"; para só a primeira letra use `ui.capFirst`.
