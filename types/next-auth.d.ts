import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    accessToken: string
    user: {
      id: string
      cpf?: string
      title?: string
      telephone?: string
      born_date?: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    accessToken?: string
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
    cpf?: string
    title?: string
    telephone?: string
    born_date?: string
  }
}