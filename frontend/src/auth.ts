import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          // Request id_token to exchange with backend
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account }) {
      // On first sign-in, exchange Google id_token for our backend JWT
      if (account?.id_token) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/v1/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_token: account.id_token }),
          });
          if (res.ok) {
            const data = await res.json();
            token.backendToken = data.access_token;
            token.backendUser = data.user;
          } else {
            console.error("[Auth] Backend token exchange failed:", await res.text());
          }
        } catch (err) {
          console.error("[Auth] Backend exchange error:", err);
        }
      }
      return token;
    },

    async session({ session, token }) {
      // Expose backend token and user info to client
      session.backendToken = token.backendToken as string | undefined;
      if (token.backendUser) {
        const bu = token.backendUser as Record<string, unknown>;
        session.user = {
          ...session.user,
          id: bu.user_id as string,
          name: (bu.name as string) || session.user?.name || "",
          email: (bu.email as string) || session.user?.email || "",
          image: (bu.avatar_url as string | null) ?? session.user?.image ?? null,
        };
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
