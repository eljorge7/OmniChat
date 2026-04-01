import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/api/inbox/login`, {
            method: 'POST',
            body: JSON.stringify(credentials),
            headers: { "Content-Type": "application/json" }
          });
          const user = await res.json();
          if (res.ok && user && !user.error) {
            return { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId, avatarUrl: user.avatarUrl };
          }
          return null;
        } catch (e) {
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
        token.companyId = user.companyId;
        token.id = user.id;
        token.avatarUrl = user.avatarUrl;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token) {
        (session.user as any).role = token.role;
        (session.user as any).companyId = token.companyId;
        (session.user as any).id = token.id;
        (session.user as any).avatarUrl = token.avatarUrl;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as const
  },
  secret: process.env.NEXTAUTH_SECRET || "omnichat-super-secret-key-12345"
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
