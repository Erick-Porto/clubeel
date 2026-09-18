export { default } from "next-auth/middleware"

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
  ]
}