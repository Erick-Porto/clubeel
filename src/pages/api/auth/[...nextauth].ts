import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import API_CONSUME from "@/services/api-consume";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        login: { label: "Login", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        
        if (!credentials?.login || !credentials?.password) {
          throw new Error("CPF e senha são obrigatórios.");
        }

        try {
          const data = await API_CONSUME('POST', 'login', {
                'Session': null
            }, {
              login: credentials.login,
              password: credentials.password,
            }
          );

          if (data && data.error) {
            throw new Error(data.message || "Credenciais inválidas.");
          }

          if (data && data.user && data.token) {
            return {
              ...data.user,
              accessToken: data.token,
            };
          }
          console.log("Login failed: Invalid response", data);
          throw new Error("Resposta inválida da API de autenticação.");

        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido durante a autorização.";
          
          console.error("Authorize Error:", errorMessage);
          throw new Error(errorMessage);
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        if (user.id) token.id = user.id as string;
        if (user.accessToken) token.accessToken = user.accessToken as string;
        if (user.name) token.name = user.name;
        if (user.email) token.email = user.email;
        if (user.title) token.title = user.title as string;
        if (user.telephone) token.telephone = user.telephone as string;
        if (user.cpf) token.cpf = user.cpf as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        if (token.id) session.user.id = token.id as string;
        if (token.accessToken) session.accessToken = token.accessToken as string;
        if (token.name) session.user.name = token.name;
        if (token.email) session.user.email = token.email;
        if (token.title) session.user.title = token.title as string;
        if (token.cpf) session.user.cpf = token.cpf as string;
        if (token.telephone) session.user.telephone = token.telephone as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);