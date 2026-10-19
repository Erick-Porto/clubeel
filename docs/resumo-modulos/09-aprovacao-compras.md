# 09 — Aprovação de compras (`/aprovacao`)

Área da **diretoria** para aprovar/reprovar ordens de compra do ERP **Questor**, via Lara. É um produto **isolado** dentro do mesmo app: rotas, sessão e casca próprias; só compartilha a identidade visual.

## Princípios (leia antes de editar)

1. **Toda decisão de negócio é da Lara.** O front não calcula se é a vez do aprovador, se ele já decidiu, nem se a ordem ainda existe. Manda a decisão e exibe a resposta/mensagem como veio.
2. **Nada sai do navegador para a Lara.** Server Components buscam dados; Server Actions executam login/decisão/sair. Nenhum `fetch` de dados no cliente.
3. **Sessão própria em cookie httpOnly** — sem NextAuth, sem `useSession`, sem `CartProvider` lógico (o layout raiz ainda envolve, mas a área não usa). O `TokenValidator` do sócio é desligado aqui.
4. Mensagens de recusa da API já vêm em português para o usuário final — **não reescreva**. 401 de login preserva a ambiguidade "Matrícula ou senha inválida." (não revelar quais matrículas existem).
5. Status/decisões desconhecidos passam adiante como vieram — **nunca** mapear um valor novo para "aprovou".

## Arquivos

| Arquivo | Tipo | Papel |
|---|---|---|
| [services/aprovacao-api.ts](../../services/aprovacao-api.ts) | server-only (lança erro se importado no browser) | Cliente da Lara `/api/aprovacao/*`, contratos, `nomeFornecedor` |
| [app/aprovacao/sessao.ts](../../app/aprovacao/sessao.ts) | servidor | Cookies `aprovacao_token` e `aprovacao_usuario` (base64url JSON), path `/aprovacao`, httpOnly, `secure` em produção, `sameSite: lax`, expiração = `expira_em` da API (fallback 8 h) |
| [app/aprovacao/actions.ts](../../app/aprovacao/actions.ts) | `'use server'` | `entrar`, `sair`, `decidir` |
| [app/aprovacao/tipos.ts](../../app/aprovacao/tipos.ts) | compartilhado | `EstadoLogin`, `EstadoDecisao` (fora de `actions.ts` porque arquivo `'use server'` só exporta funções async) |
| [app/aprovacao/formato.ts](../../app/aprovacao/formato.ts) | puro | `moeda`, `moedaPrecisa` (até 4 decimais p/ valor unitário), `dataHora` (fuso SP), `dataHoraSimples` (hora de parede do ERP, sem `Date`), `tempoDecorrido`, `ouTraco`, `plural`, `numero`, `cnpj`, `rotuloDecisao`, `rotuloStatus` |
| [app/aprovacao/layout.tsx](../../app/aprovacao/layout.tsx) | server | Casca + metadata `robots: noindex` |
| [app/aprovacao/login/page.tsx](../../app/aprovacao/login/page.tsx) | server | Login; com token válido redireciona para a fila, exceto `?motivo=expirada` (freio de laço) |
| [app/aprovacao/page.tsx](../../app/aprovacao/page.tsx) | server | Fila do aprovador |
| [app/aprovacao/ordens/[cd_ordem_compra]/page.tsx](../../app/aprovacao/ordens/[cd_ordem_compra]/page.tsx) | server | Detalhe da ordem + ações |
| [app/aprovacao/sessao-expirada/route.ts](../../app/aprovacao/sessao-expirada/route.ts) | Route Handler GET | Apaga os cookies **na própria resposta** e redireciona para `/aprovacao/login?motivo=expirada` |
| `components/cabecalho.tsx` | server | Logo, nome/matrícula (do cookie), botão Sair (form POST → `sair`; **não** `<Link>`, para não deslogar por prefetch) |
| `components/formulario-login.tsx` | client | Form com `useActionState(entrar)` |
| `components/acoes-decisao.tsx` | client | Aprovar/Reprovar com confirmação, observação (≤1000), leitura do resultado |
| `components/andamento.tsx` | client | Passos de aprovação (nível, responsável, decisão, por quem, quando, observação) |
| `components/botao-recarregar.tsx` | client | `router.refresh()` em transição |

Estilos: [styles/aprovacao.module.css](../../styles/aprovacao.module.css) (identidade v4, ver [14](14-identidade-visual.md); cor do módulo `compras` na marca da área, logo claro/escuro).

- `components/filtro-ordens.tsx` (client): **busca na fila**. Recebe os cartões já renderizados no servidor e só filtra por número, fornecedor, departamento, solicitante e processo — nenhum fetch no cliente.
- No celular a tabela de itens da ordem vira cartões; os rótulos vêm de `data-rotulo` em cada `<td>`.

## API da Lara (`/api/aprovacao/...`, `Authorization: Bearer <JWT do diretor>`, sem token de aplicação)

| Função | Endpoint | Notas |
|---|---|---|
| `login(matricula, senha)` | `POST login {matricula, senha}` | Senha em **texto puro** (Lara faz bcrypt). Throttle 5/min **por matrícula**. Resposta `{token, expira_em, usuario{id,nome,matricula}}` |
| `listarOrdens(token)` | `GET ordens` | `{ordens: OrdemNaFila[]}` — só onde o aprovador tem decisão pendente |
| `obterOrdem(token, cd)` | `GET ordens/{cd}` | 404 = não está na fila **deste** aprovador; 503 = Lara sem ERP (temporário) |
| `decidirOrdem(token, cd, 'aprovar'|'reprovar', obs?)` | `POST ordens/{cd}/decidir` | 422 = recusa de negócio com `{error}` (não é a vez, já decidiu, ordem mudou no ERP) |

Transporte `pedir()`: falha de rede → `{ok:false,status:503}` (temporário, nunca "sessão inválida"); erro → loga só método/caminho/status (nunca token/senha/corpo); `extrairMensagem` lê `error`, `message` ou o primeiro item de `errors` (422 do Laravel). `INTERNAL_LARA_API_URL` ausente → `ConfiguracaoAusenteError` (estoura, vira tela "Configuração do servidor incompleta").

Contratos-chave: `OrdemNaFila` (`cd_ordem_compra, processo_id, vl_total, nr_itens, centros_custo, sem_centro_custo, aguardando_desde` = desde quando está **neste nível**, `escolhido_por`, `fornecedor` string|objeto|null, `departamento`, `solicitante`); `OrdemDetalhe` (+ `filial, referente, dt_cadastro, itens[], aprovacao`); `Aprovacao` (`status 'open'|'approved'|'rejected', nivel_atual, nivel_atual_rotulo, aguardando, passos[]`); `DecisaoResposta` (`resultado` = estado do **processo**, `gravado_no_questor`, `aprovacao`).

## Estados das telas

- Fila: `ok` (lista ou vazia — vazia é estado normal, tom neutro), `expirada` (401/403 → redirect `/aprovacao/sessao-expirada`), `temporario` (recarregar), `configuracao`.
- Detalhe: idem + `fora-da-fila` (404). `cd` não inteiro positivo → `notFound()` sem chamar a API.

## Interpretação do resultado da decisão (`mensagemResultado`)

| `resultado` | `gravado_no_questor` | Mensagem |
|---|---|---|
| `open` | — | "Sua aprovação foi registrada" — a compra **ainda não** está liberada (faltam outros diretores) |
| `approved` | `true` | "Ordem aprovada e autorizada no Questor" |
| `approved` | `false` | Anômalo: aprovada mas sem confirmação no ERP → procurar a TI |
| `rejected` | — | "Ordem reprovada" — reprovar encerra o processo inteiro |
| outro | — | Anômalo, exibe o valor cru |

**Não chame `revalidatePath` em `decidir`**: após decidir, a ordem sai da fila e o GET do detalhe vira 404; revalidar substituiria a tela de resultado pela de "fora da fila". As rotas são dinâmicas (leem cookie), então a fila é rebuscada naturalmente.
