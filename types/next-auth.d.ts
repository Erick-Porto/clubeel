import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  /**
   * Estende a interface da Sessão padrão do NextAuth.
   * Isso corrige o erro: Property 'accessToken' does not exist on type 'Session'
   */
  interface Session {
    accessToken: string
    user: {
      /** O ID do usuário no seu banco de dados */
      id: string
      /** Adicionei aqui campos que vi você usar nos outros componentes */
      cpf?: string
      title?: string // Matrícula
      telephone?: string
      born_date?: string
    } & DefaultSession["user"]
  }

  /**
   * Estende a interface do Usuário (objeto retornado pelo callback `authorize`)
   */
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
  /**
   * Estende o Token JWT para garantir que os dados persistam entre chamadas
   */
  interface JWT {
    accessToken: string
    id: string
    cpf?: string
    title?: string
    telephone?: string
    born_date?: string
  }
}