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
    "/",
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
  ]
}