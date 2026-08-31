import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("Auth: Missing credentials");
          return null;
        }

        const { db } = await import("@/lib/db");
        const { users } = await import("@/lib/db/schema");
        const { eq } = await import("drizzle-orm");

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email),
          with: { family: true }
        });

        if (!user) {
          console.log(`Auth: No user found for email: ${credentials.email}`);
          return null;
        }

        if (user.passwordHash) {
          if (!user.passwordHash.startsWith("$2")) {
            console.error(`Auth: Hash for ${credentials.email} does not look like a valid bcrypt hash. It should start with "$2". Current value starts with: ${user.passwordHash.substring(0, 3)}`);
            return null;
          }

          try {
            const isValid = await bcrypt.compare(
              credentials.password,
              user.passwordHash
            );

            if (isValid) {
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                familyId: user.familyId,
                familyName: user.family?.name || "Recipe Book Family",
                appName: user.family?.appName || "Ginger",
              };
            } else {
              console.log(`Auth: Invalid password for user: ${credentials.email}`);
            }
          } catch (error) {
            console.error("Auth: Error comparing passwords", error);
          }
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.name = user.name;
        token.familyId = user.familyId;
        token.familyName = user.familyName;
        token.appName = user.appName;
      }
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.appName) token.appName = session.appName;
        if (session.familyName) token.familyName = session.familyName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.familyId = token.familyId as string;
        session.user.familyName = token.familyName as string;
        session.user.appName = token.appName as string;
      }
      return session;
    },
  },
};
