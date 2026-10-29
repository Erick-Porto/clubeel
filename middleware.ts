import { withAuth } from "next-auth/middleware"
import { nomeCookieSessao } from "./utils/auth-cookies"

// Mesmo comportamento do `export { default } from "next-auth/middleware"`, só
// que dizendo o nome do cookie de sessão — na homologação ele é outro (ver
// utils/auth-cookies.ts). `pages.signIn` aqui vai SEM prefixo: o withAuth
// compara com o pathname (que o Next entrega sem basePath) e prefixa sozinho
// ao redirecionar.
const cookieSessao = nomeCookieSessao()

export default withAuth({
  pages: { signIn: "/login" },
  ...(cookieSessao ? { cookies: { sessionToken: { name: cookieSessao } } } : {}),
})

export const config = { 
  matcher: [
    // "/" fica FORA de propósito: sem sessão a raiz mostra a página de
    // boas-vindas (Entrar, RePET, Torneios — app/components/Common/public-home.tsx);
    // com sessão, a home do sócio. Tudo o que a home do sócio carrega exige
    // sessão no proxy, então nada vaza para o visitante.
    "/profile",
    "/checkout",
    "/cart",
    "/places/:path*",
    "/place/:path*",
    // "Meus vídeos" é do sócio: sem sessão, o middleware manda para o login
    // já com callbackUrl, que é o que faz o link do e-mail cair direto aqui
    // depois da autenticação.
    //
    // /replay (galeria das quadras) fica FORA do matcher de propósito: é
    // aberta a qualquer visitante, por decisão de negócio.
    "/meus-videos",
    // Luz da quadra: acender é ação de sócio.
    "/luz",
    // Espaços sociais: vitrine, calendário, pré-reserva e "minhas reservas"
    // são todos do sócio (a Lara responde pelo Session dele).
    "/espacos-sociais",
    "/espacos-sociais/:path*",
    // Torneios: só "minhas inscrições" e a tela do time são do sócio. Lista,
    // detalhe e chaveamento (/torneios, /torneios/<id>, .../chaveamento/...)
    // ficam FORA de propósito: são abertos a qualquer visitante. A tela da
    // equipe (/torneios/<id>/equipe) também fica fora: usa o código de
    // lançamento, não o login de sócio.
    "/torneios/inscricoes",
    "/torneios/times/:path*",
    // Ingressos: só o pedido do sócio (/ingressos/meus/<id>) exige login. A
    // vitrine, a página do evento e a compra (/ingressos/<id>/comprar) ficam
    // FORA: o não sócio compra sem login. /ingressos/meus também fica fora: sem
    // login é o "Meus ingressos" do não sócio (CPF + e-mail + código). O pedido
    // do não sócio (/ingressos/pedido/<id>) e o "perdi o link" também — quem
    // abre é o token do pedido (cookie httpOnly). `:path+` (e não `:path*`)
    // para não casar com o próprio /ingressos/meus.
    "/ingressos/meus/:path+",
  ]
}