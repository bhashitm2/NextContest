import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT sessions: stateless, work on serverless/edge, no Session table reads.
  session: { strategy: "jwt" },
  // Required for non-Vercel hosts (and fine locally).
  trustHost: true,
  // Provider credentials are read from AUTH_GITHUB_ID/SECRET, AUTH_GOOGLE_ID/SECRET.
  providers: [GitHub, Google],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
