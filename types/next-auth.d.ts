import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

/** `usuario` (padrão) ou `administrador` — dado no Lara (Reservas › Contas do site). */
export type SiteRole = "usuario" | "administrador"

declare module "next-auth" {
  interface Session {
    accessToken: string
    user: {
      id: string
      cpf?: string
      title?: string
      telephone?: string
      born_date?: string
      /** Perfil da conta no Lara. Só decide se o link "Painel" aparece; quem protege é a API. */
      site_role?: SiteRole
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    accessToken?: string
    site_role?: string
    cpf?: string
    title?: string
    telephone?: string
    born_date?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken: string
    id: string
    site_role?: SiteRole
    cpf?: string
    title?: string
    telephone?: string
    born_date?: string
  }
}