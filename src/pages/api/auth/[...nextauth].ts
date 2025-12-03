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
      async authorize(credentials, req) {
        
        if (!credentials?.login || !credentials?.password) {
          throw new Error("CPF e senha são obrigatórios.");
        }

        try {
          // Chama a sua API de backend para validar as credenciais
          const data = await API_CONSUME('POST', 'login', {
                'Session': null
            }, {
              login: credentials.login,
              password: credentials.password,
            }
          );
          // Se a API de backend retornar um erro, lance-o para o NextAuth.
          if (data && data.error) {
            throw new Error(data.message || "Credenciais inválidas.");
          }

          // Se a API retornar dados válidos, retorne o objeto do usuário.
          if (data && data.user && data.token) {
            return {
              ...data.user,
              accessToken: data.token,
            };
          }
          console.log("Login failed: Invalid response", data);
          // Se a resposta da API não for o esperado, lance um erro genérico.
          throw new Error("Resposta inválida da API de autenticação.");

        } catch (error: any) {
          // Repassa qualquer erro (da API ou outro) para o NextAuth.
          console.error("Authorize Error:", error.message);
          throw new Error(error.message || "Ocorreu um erro durante a autorização.");
        }
      },
    }),
  ],
  // Define a estratégia de sessão como JWT (JSON Web Token)
  session: {
    strategy: "jwt",
  },
  // Callbacks para controlar o que é salvo no token e na sessão
  callbacks: {
    // Este callback é chamado sempre que um JWT é criado ou atualizado.
    async jwt({ token, user }) {
      // Se 'user' existir (ocorre no login), estamos adicionando os dados ao token.
      if (user) {
        token.id = user.id;
        token.accessToken = user.accessToken;
        token.name = user.name;
        token.email = user.email;
        token.title = user.title;
        token.telephone = user.telephone;
        token.cpf = user.cpf;
        // Adicione outros campos do usuário que você queira no token
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.accessToken = token.accessToken as string;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.title = token.title as string;
        session.user.cpf = token.cpf as string;
        session.user.telephone = token.telephone as string;
      }
      return session;
    },
  },
  // Define a página de login personalizada
  pages: {
    signIn: '/login',
  },
  // Adiciona um secret para assinar os JWTs em produção
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);