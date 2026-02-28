import { ExpressAuth } from "@auth/express"
import GitHub from "@auth/core/providers/github"
import Google from "@auth/core/providers/google"
import { upsertUser, getUserById } from "../db/users.ts"

export const authConfig = {
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (user.email) {
        upsertUser(user.email, user.name || null, user.image || null);
      }
      return true;
    },
    async session({ session, token }: any) {
      if (session.user?.email) {
        const dbUser = upsertUser(session.user.email, session.user.name || null, session.user.image || null);
        session.user.id = dbUser.id;
        session.user.role = dbUser.role;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET || "super_secret_fallback_key",
  trustHost: true,
  useSecureCookies: true,
  cookies: {
    sessionToken: {
      name: `__Secure-authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "none" as "none",
        path: "/",
        secure: true,
      },
    },
    callbackUrl: {
      name: `__Secure-authjs.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "none" as "none",
        path: "/",
        secure: true,
      },
    },
    csrfToken: {
      name: `__Host-authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "none" as "none",
        path: "/",
        secure: true,
      },
    },
  },
}
