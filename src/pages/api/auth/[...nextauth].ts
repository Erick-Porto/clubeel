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
          // 1. Faz a chamada (agora retorna { data, ok, status, message })
          const response = await API_CONSUME('POST', 'login', {
                'Session': null
            }, {
              login: credentials.login,
              password: credentials.password,
            }
          );

          // 2. Verificação de Erro (Novo Padrão)
          // Se não for OK (ex: 401 Unauthorized), lançamos erro para o NextAuth
          if (!response.ok) {
            throw new Error(response.message || "Credenciais inválidas.");
          }

          // 3. Acesso aos dados reais
          const payload = response.data;

          // 4. Validação do Payload
          if (payload && payload.user && payload.token) {
            return {
              ...payload.user,
              accessToken: payload.token,
            };
          }

          // Se deu 200 OK mas não veio user/token, algo está errado na API
          throw new Error("Resposta inválida da API: Token ou Usuário ausentes.");

        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Erro desconhecido no login.";
          console.error("Authorize Error:", errorMessage);
          // Re-lança o erro para o NextAuth redirecionar para ?error=...
          throw new Error(errorMessage);
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // ... (Seus callbacks permanecem iguais, pois dependem apenas do retorno acima)
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