# 15 — Assinatura remota de documentos (`/assinar`)

Área para a pessoa assinar um documento do clube (termo, contrato, ficha) **a distância**, pelo celular ou computador, a partir de um **link especial enviado por e-mail** pelo atendimento. Complementa o tablet do balcão, que continua existindo.

É um produto **isolado** dentro do mesmo app: não tem relação com login, sócio, reserva ou qualquer outra parte do site. Só divide o servidor e a identidade visual. Quem chega aqui chegou pelo link do e-mail.

## Princípios (leia antes de editar)

1. **O front não decide nada.** Quais etapas existem, prazos, tentativas de CPF, anexos obrigatórios, mínimo de pontos, validação das respostas: tudo vem da Lara (`requirements`, `rules`, `form`, `attachments`, `attempts_left`). Recusas mostram o `error` que ela mandou, sem reescrever.
2. **O navegador nunca fala com a Lara.** Navegador → rotas do Next em `/assinar/api/*` (Route Handlers) → Lara. Uma rota fixa por endpoint, sem proxy genérico e **fora** da allowlist de `pages/api/backend` (que é do sócio).
3. **Credencial própria**: `LARA_SIGNATURE_API_TOKEN`. Não é o `INTERNAL_LARA_API_TOKEN` das reservas nem o JWT da aprovação.
4. **Token do link e segredo da sessão só em cookie httpOnly** (`path=/assinar`). Nunca em `localStorage`, `sessionStorage`, IndexedDB, estado de React ou URL depois da primeira carga.
5. **Nada fica no aparelho** (pode ser um computador compartilhado): respostas com `Cache-Control: no-store`; PDF, anexos, foto e assinatura só na memória da aba; cookies apagados no fim.
6. **Fora dos buscadores e não descobrível**: nenhum link no site, `noindex` no HTML e no header, `Disallow` no `robots.txt`, sem analytics nem script de terceiro.
7. **Sem sessão de sócio**: o layout raiz não monta `NextAuthProvider`, `CartProvider` nem `TokenValidator` em `/assinar` ([casca-do-site.tsx](../../app/components/casca-do-site.tsx)). O navegador ainda manda o cookie do NextAuth (path `/`), mas nada da área o lê.

## Arquivos

| Arquivo | Tipo | Papel |
|---|---|---|
| [services/assinatura-api.ts](../../services/assinatura-api.ts) | server-only | `chamarLara`: URL `INTERNAL_LARA_API_URL/api/assinatura/remota/*`, `Bearer LARA_SIGNATURE_API_TOKEN`, `X-Signer-Ip`, `X-Signer-User-Agent`, `X-Signature-Session`; multipart em stream (`duplex: 'half'`). Falha de rede → `FalhaDeRede`; variável ausente → `ConfiguracaoAusenteError`. Log só método/caminho |
| [app/(assinatura)/assinar/servidor.ts](../../app/(assinatura)/assinar/servidor.ts) | servidor | Cookies (`assinatura_link`, 3 dias; `assinatura_sessao`, sem validade), `ipDeQuemAssina`, `HEADERS_DA_AREA`, `normalizarRecusa`, `repassar` (repasse JSON + limpeza de cookies), `escolher` (só os campos do contrato seguem) |
| `app/(assinatura)/assinar/[token]/route.ts` | Route Handler GET | Link do e-mail: grava o cookie, apaga a sessão local do link anterior, `303` para `/assinar` (Location relativo) |
| `app/(assinatura)/assinar/api/*/route.ts` | Route Handlers | `link`, `abrir`, `sessao`, `identidade`, `respostas`, `anexos` (GET/POST), `anexos/[id]` (DELETE), `pdf`, `visualizado`, `assinar`, `recusar`, `encerrar` |
| `app/(assinatura)/assinar/layout.tsx` | server | Casca própria (logo claro/escuro + "Assinatura de documentos"), metadata `noindex` e `referrer: no-referrer` |
| `app/(assinatura)/assinar/page.tsx` | server | Sem cookie do link: "abra o link que você recebeu por e-mail". Com cookie: `<FluxoAssinatura temSessao>` |
| `app/(assinatura)/assinar/cliente.ts` | cliente | `api()` e `baixarPdf()` para `/assinar/api/*` (`no-store`); `errosPorCampo` |
| `app/(assinatura)/assinar/tipos.ts` | compartilhado | Contratos (`LinkInfo`, `Sessao`, `ListaAnexos`, `Recusa`, `Traco`…) |
| `app/(assinatura)/assinar/formato.ts` | puro | Datas em `America/Sao_Paulo`, máscaras (CPF, CNPJ, CEP, telefone), tamanhos |
| `app/(assinatura)/assinar/pdf.ts` | cliente | Carga sob demanda do PDF.js (build `legacy`, worker empacotado pelo Next) |
| `componentes/fluxo-assinatura.tsx` | cliente | Máquina de etapas, `tratar` (recusas que mudam de tela), consulta à sessão, envio e conferência de resposta perdida |
| `componentes/etapa-*.tsx`, `quadro-assinatura.tsx` | cliente | Entrada, CPF, perguntas, anexos, leitura, aceite, assinatura/visto (canvas), foto |
| `componentes/telas-finais.tsx`, `recusar-documento.tsx` | cliente | Sucesso, recusado, recusas finais (moldura por `reason`); modal de recusa |
| [styles/assinatura.module.css](../../styles/assinatura.module.css) | CSS | Letra 17px, botões ≥ 52px, coluna de 680px |

Fora da pasta: [app/robots.ts](../../app/robots.ts) (`Disallow: /assinar` e `/homolog/assinar`), `headers()` em [next.config.ts](../../next.config.ts) (X-Robots-Tag, no-store, no-referrer, `frame-ancestors 'none'`), tokens `--pad`/`--pad-ink` em `globals.css`.

## Endereço e cookies

1. O e-mail leva `https://<site>/assinar/<token>` (64 caracteres `[A-Za-z0-9]`).
2. `[token]/route.ts` grava `assinatura_link` (httpOnly, `secure` em produção, `sameSite=lax`, `path=comBase('/assinar')`, 3 dias) e redireciona para `/assinar`. Token fora do formato não grava nada.
3. Abrir outro link troca o cookie.
4. `abrir` devolve o `session_token` **só uma vez**; a rota o grava em `assinatura_sessao` e o tira do corpo. Toda resposta JSON da área passa por um `delete session_token`.
5. Os cookies são apagados **na própria resposta**: sucesso do `assinar` e do `recusar` (os dois), recusas que encerram o link (`invalid_link`, `link_expired`, `link_superseded`, `link_revoked`, `link_used`, `link_locked`, `document_unavailable` — os dois), `session_ended` e `encerrar` (só a sessão).

As rotas de servidor ficam **sob `/assinar/api`** porque o navegador só manda cookie com `path=/assinar` para URLs sob `/assinar`.

## IP de quem assina — **PENDENTE (TI)**

O Next escuta em `127.0.0.1` atrás do nginx; o IP da conexão é sempre o do nginx. `ipDeQuemAssina` usa:

1. `X-Real-IP`, se existir (o nginx precisa de `proxy_set_header X-Real-IP $remote_addr;`);
2. senão, o **último** item do `X-Forwarded-For` (com `$proxy_add_x_forwarded_for`, o nginx acrescenta o IP real no fim; o **primeiro** item é o que o navegador escreveu e pode ser forjado).

Falta a TI confirmar a configuração do nginx da produção e da homologação e se existe outro proxy na frente dele (nesse caso o último item seria o IP desse proxy, e a regra muda). Sem nenhum dos dois headers, a chamada vai sem `X-Signer-Ip` e o servidor registra um aviso no log.

## Infraestrutura (TI)

- **`.env` do site** (produção e homologação): `LARA_SIGNATURE_API_TOKEN` = mesmo valor de `SIGNATURE_REMOTE_API_TOKEN` no Lara. A URL é a `INTERNAL_LARA_API_URL` já existente.
- **No Lara**: `SIGNATURE_REMOTE_SITE_URL` = endereço público deste site (na homologação, com `/homolog`); `SIGNATURE_REMOTE_ALLOWED_IPS` = IP deste servidor.
- **nginx — limite de corpo dos anexos**: o padrão é `client_max_body_size 1m`. Libere só a rota de anexos, nas duas instâncias (folga sobre o `max_kb` de 10 MB):
  ```nginx
  location ~ ^/(homolog/)?assinar/api/anexos$ {
      client_max_body_size 11m;
      proxy_pass http://127.0.0.1:<porta da instância>;
      # mesmos proxy_set_header do location principal (Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto)
  }
  ```
  Na homologação a porta é a do serviço `espacos-homolog`; se preferir, separe em dois `location` (um por instância). O `assinar` (foto 600×600 + traços) fica bem abaixo de 1 MB.
- **nginx — IP**: `proxy_set_header X-Real-IP $remote_addr;` (ver seção acima).
- `robots.txt` só vale na raiz do domínio (instância de produção): entra no ar quando a branch chegar em `master`.

## Etapas (ordem da Lara)

| # | Etapa | Quando | API |
|---|---|---|---|
| 1 | Entrada | sempre | `link`; confere a câmera (`getUserMedia` + `enumerateDevices`); sem câmera e `requirements.photo` ≠ `false`, **Começar** fica desabilitado |
| 2 | CPF | `rules.identity_confirmed` falso | `identidade`; mostra `attempts_left`; `link_locked` → tela final |
| 3 | Perguntas | `form` não nulo e com campos | `respostas`; erros em `errors[key]`; resposta = sessão nova (`pdf_version` muda) |
| 4 | Anexos | `attachments.items` não vazia | `anexos` GET/POST/DELETE; Continuar só com `missing_required` vazia |
| 5 | Leitura | sempre | `pdf` (PDF.js, zoom 1×/1,5×/2×); todas as páginas desenhadas, com teto de ~2 milhões de pixels por página (memória no celular; no mesmo tamanho na tela, nunca abaixo de 1 pixel por ponto); mede segundos com a aba visível e se chegou ao fim (depois da última página); ao sair, `visualizado` |
| 6 | Aceite | sempre | termos (`accepted`), foto com `photo_consent_text` **exato**, via por e-mail se `signer.has_email` |
| 7 | Assinatura | sempre | canvas com pointer events, `touch-action: none`; Continuar a partir de 30 pontos |
| 8 | Visto | `rules.requires_initials` | mesmo quadro, 8 pontos |
| 9 | Foto | `rules.requires_photo` | câmera frontal, 3 s, recorte 600×600, JPEG 0,82; câmera desligada logo depois |
| 10 | Envio | — | `assinar` (tudo numa requisição). Sucesso: data, `validation_code`, aviso da via |

**Modelo vinculado** (Lara, 29/10/2026): um modelo pode exigir outro junto. A API não muda: o PDF continua um só (mais páginas, os dois textos seguidos), e `form.fields` e `attachments.items` podem trazer itens dos dois modelos. O front não sabe nem precisa saber que há vínculo: não há limite de páginas, de perguntas ou de anexos, nem altura fixa (tudo rola com a página). Campos "só o atendente responde" nunca chegam ao formulário, e a conferência das respostas pelo atendente (`answer_check`) só existe no tablet do balcão.

"Recusar documento" (com motivo opcional e confirmação) aparece da leitura em diante; "Sair sem assinar" (`encerrar`) em todas as etapas com sessão. "Voltar" anda entre etapas do documento, nunca de volta ao CPF.

**Sessão**: `sessao` a cada 15 s, só com a aba visível (e ao voltar para a aba). Aviso quando `remaining_seconds` < `warning_seconds`, com contagem pelo relógio monotônico da aba a partir da última resposta. `session_ended` → volta à entrada com a mensagem da Lara. Recarregar a página com sessão aberta retoma (sem novo `abrir`).

**Resposta perdida no `assinar`** (`network`/`unavailable`): chama `link`. `link_used` → sucesso (sem código, que só viria na resposta perdida); link válido → "não chegou", botão **Enviar de novo** (mesmo corpo); sem conexão → **Conferir de novo**.

## Mapeamento de recusas (`servidor.ts` → `normalizarRecusa`)

- `unauthorized`, 401, ou 403 **sem** `reason` → 502 `{ reason: 'unauthorized' }` com mensagem genérica; log `[assinatura] <método> <caminho> -> <status>`. 403 com `reason` (ex.: `attachment_refused`) passa como veio.
- 429 sem `reason` → `rate_limited` (limite da Lara: 20/min em `link`/`abrir`, 120/min no resto).
- 422 do Laravel (`{ message, errors }`) → `error` = primeira mensagem de campo; `errors` segue junto.
- Corpo não-JSON → `server_error`. Lara fora do ar → 503 `unavailable`.
- Sem cookie do link → 400 `no_link`; sem cookie da sessão → 419 `session_ended` (sem chamar a Lara).

## Testes

- `npm run test` (Vitest, `tests/unit/`): rotas de servidor com `fetch` mockado — credencial, IP/UA, cookies, segredo fora do corpo, cada `reason` da tabela, limpeza de cookies, stream do multipart, headers.
- `npm run test:e2e` (Playwright, `tests/e2e/`): sobe uma **Lara falsa** (`lara-falsa.mjs`, porta 4010) e o `next dev` na porta 3100 apontado para ela, e roda o fluxo inteiro num Chromium com câmera falsa, em 360×740. O cenário `vinculado` da Lara falsa simula o modelo vinculado (PDF de 12 páginas com dois textos, 12 perguntas, anexo do segundo modelo). Na primeira vez: `npx playwright install chromium`.

## Fica de fora / limitações conhecidas

- O PDF é desenhado em canvas: sem camada de texto (leitor de tela não lê o conteúdo; cada página tem só o rótulo "Página X de N").
- Tipo de pergunta desconhecido vira campo de texto.
- A confirmação via `link_used` (resposta perdida) não traz a data nem o código de validação.
