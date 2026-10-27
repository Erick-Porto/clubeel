# CLAUDE.md

Front-end Next.js 15 (React 19, TypeScript) do Clube dos Funcionários da CSN. Oito produtos no mesmo app: **agendamento de quadras** (com pagamento eRede), **espaços sociais** (churrasqueiras/salões: pré-reserva, análise da secretaria, pagamento eRede), **torneios** (inscrição por categoria com pagamento eRede, times, chaveamento, lançamento de resultados pela equipe com código), **ingressos de eventos** (compra do sócio para o título e do não sócio sem login, pagamento eRede, QR/PDF), **replay** de vídeos, **luz da quadra**, **aprovação de compras** da diretoria e **assinatura remota de documentos** (`/assinar`, pelo link do e-mail). Toda regra de negócio e todo dado moram na API interna **Lara** (Laravel, não publicada na internet).

## Documentação — leia antes de mudar código

- **Sempre** leia [docs/resumo-modulos/README.md](docs/resumo-modulos/README.md) (visão geral, arquitetura, regras, glossário).
- Depois, abra só o(s) módulo(s) que a tarefa toca (`docs/resumo-modulos/01..11-*.md`, `13-espacos-sociais.md`, `15-assinatura-remota.md`, `16-torneios.md` e `17-ingressos.md`); em qualquer mudança de tela, também `14-identidade-visual.md`.
- Antes de "consertar" algo estranho, consulte [12-pontos-de-atencao.md](docs/resumo-modulos/12-pontos-de-atencao.md): vários comportamentos são intencionais.
- Se alterar comportamento descrito nesses docs, **atualize o doc no mesmo trabalho**. Se o doc divergir do código, o código vence — corrija o doc.
- Sempre que montar uma nova função, pergunte ao usuário se deve criar uma nova branch.

## Comandos

- `npm run dev` · `npm run build` · `npm run lint`
- Valide com `npx tsc --noEmit`, `npm run lint` e `npm run build`. Só a assinatura remota tem testes: `npm run test` (Vitest) e `npm run test:e2e` (Playwright contra uma Lara falsa).
- `master` vai para produção no próximo deploy (`deploy.sh`, serviço systemd atrás do nginx, instância única).

## Regras invioláveis

1. O navegador **nunca** fala direto com a Lara: cliente → `/api/backend/*` (proxy em `pages/api/backend/[...path].ts`) → Lara.
2. Endpoint novo da Lara chamado pelo cliente **precisa** entrar na allowlist do proxy (`PUBLIC_ENDPOINTS` ou `AUTHENTICATED_ENDPOINTS`), com regex o mais fechada possível.
3. `INTERNAL_*` e demais segredos nunca podem ir para o bundle do cliente nem para logs. Nunca logue `cardData`. Nunca imprima valores do `.env`.
4. Valor de cobrança é sempre recalculado no servidor (`utils/lara.ts`); aprovação de pagamento é verificada na eRede por `tid`, nunca pelo corpo da requisição.
5. Nos módulos Replay, Luz, Aprovação, Espaços sociais, Torneios, Ingressos e Assinatura remota, **o front não decide nada**: exiba o que a Lara responde (`reason`/`error`/mensagem) e não reimplemente regra de negócio.
6. Rota de sócio protegida → adicionar ao `matcher` de `middleware.ts`. `/replay` é pública por decisão de negócio; `/aprovacao` tem sessão própria (cookie httpOnly) e não usa NextAuth; `/assinar` também não, e o layout raiz nem monta os provedores de sócio lá (`app/components/casca-do-site.tsx`). Nada no site linka para `/assinar`. A raiz `/` também fica fora do matcher: sem sessão ela mostra a página de boas-vindas (Entrar, RePET, Torneios, Ingressos). Em `/torneios` só `inscricoes` e `times/*` exigem login; lista, detalhe, chaveamento e as telas da equipe (`/torneios/equipe` e `/torneios/<id>/equipe`, código de lançamento no header `Tournament-Code`) são abertos. Em `/ingressos` só o pedido do sócio (`meus/:path+`) exige login; vitrine, evento, compra (`/ingressos/<id>/comprar`), pedido do não sócio (`/ingressos/pedido/<id>`, token do link trocado por cookie httpOnly), "perdi o link" e `/ingressos/meus` (sem login: CPF + e-mail + código do não sócio) são abertos.
7. Rate limit e cache de pagamentos pendentes são em memória (um processo só).
8. O site também roda em `/homolog` (branch `homolog`, segunda instância, serviço `espacos-homolog`, `deploy-homolog.sh`). Caminho absoluto fora de `<Link>`/`router.push`/`redirect()` — `fetch`, `src`, `callbackUrl`, `path` de cookie, `new URL` — passa por `comBase` (`utils/base-path.ts`).

## Convenções

- Imports **relativos** (`../../services/...`); não use os aliases `@/`.
- Textos de UI, mensagens e comentários em **português**. Preserve os comentários explicativos (o "porquê") dos módulos recentes; na área `/aprovacao` os identificadores também são em português.
- Páginas de sócio são client components que buscam dados com `API_CONSUME` no `useEffect`; `/aprovacao` usa Server Components + Server Actions, sem fetch no cliente. Não misture os padrões.
- Estilo com CSS Modules em `styles/`, identidade v4 ([14-identidade-visual.md](docs/resumo-modulos/14-identidade-visual.md)): cor sempre por token (`var(--grena)`, `var(--surface)`…, nunca hex), tema claro e escuro, peças em `app/components/UI/`; ícones FontAwesome; avisos com `react-toastify` (só no cliente).
- Senha do sócio vai à Lara como SHA-256 calculado no cliente; senha da aprovação vai em texto puro do servidor. Não troque.
- Commits/PRs só quando o usuário pedir.
