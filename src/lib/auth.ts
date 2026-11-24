import NextAuth, { CredentialsSignin } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { verifyTurnstileStatus } from "./turnstile";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { NextAuthConfig } from "next-auth";

class TurnstileSigninError extends CredentialsSignin {
  code = "turnstile_verification_failed";
}

// On Vercel preview deploys the project-level AUTH_URL env var is shared
// with production, so Auth.js builds sign-in/sign-out redirects pointing
// at the canonical production host. The browser follows them off the
// preview deployment and the preview's session cookie ends up not being
// cleared — leaving the user "still signed in" when they come back.
//
// Rewrite AUTH_URL to the actual preview hostname before NextAuth reads
// it. Production is untouched. Local dev (no VERCEL_ENV) is untouched.
// Discord OAuth (which intentionally pins to the production redirect_uri
// registered in the Discord Developer Portal) is unaffected on preview
// because Discord linking was never functional there to begin with.
if (
  process.env.VERCEL_ENV &&
  process.env.VERCEL_ENV !== "production"
) {
  const previewHost =
    process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  if (previewHost) {
    process.env.AUTH_URL = `https://${previewHost}`;
  }
}

// Adapter: maps Auth.js user operations to our unified User table (email PK)
const userAdapter: Adapter = {
  async createUser(user) {
    if (!user.email) throw new Error("Email required");
    // Find existing user or auto-create on first magic link click
    const existing = await db.user.findUnique({ where: { email: user.email } });
    if (existing) {
      return {
        id: existing.email,
        email: existing.email,
        name: existing.name,
        emailVerified: null,
      };
    }
    // Leave `name` empty on auto-create so the user must enter a real name
    // in their profile before it becomes visible anywhere. Using the email
    // as a placeholder caused users to miss the field entirely and end up
    // with their email address shown as their display name.
    const created = await db.user.create({
      data: { email: user.email, name: "", role: "member" },
    });
    return {
      id: created.email,
      email: created.email,
      name: created.name,
      emailVerified: null,
    };
  },
  async getUser(id) {
    const user = await db.user.findUnique({ where: { email: id } });
    if (!user) return null;
    return { id: user.email, email: user.email, name: user.name, emailVerified: null };
  },
  async getUserByEmail(email) {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return null;
    return { id: user.email, email: user.email, name: user.name, emailVerified: null };
  },
  async getUserByAccount() {
    return null;
  },
  async updateUser(user) {
    return user as AdapterUser;
  },
  async linkAccount() {
    return undefined;
  },
  async createSession() {
    return { sessionToken: "", userId: "", expires: new Date() };
  },
  async getSessionAndUser() {
    return null;
  },
  async updateSession() {
    return null;
  },
  async deleteSession() {},
  async createVerificationToken(data) {
    await db.verificationToken.create({
      data: { identifier: data.identifier, token: data.token, expires: data.expires },
    });
    return data;
  },
  async useVerificationToken({ identifier, token }) {
    console.log("[AUTH] useVerificationToken:", { identifier, token: token.substring(0, 10) + "..." });
    try {
      const existing = await db.verificationToken.findUnique({
        where: { identifier_token: { identifier, token } },
      });
      console.log("[AUTH] token found:", !!existing);
      if (!existing) return null;
      await db.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      });
      return existing;
    } catch (err) {
      console.error("[AUTH] useVerificationToken error:", err);
      return null;
    }
  },
};

export const authConfig: NextAuthConfig = {
  adapter: userAdapter,
  providers: [
    CredentialsProvider({
      id: "credentials",
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
        turnstileToken: { type: "text" },
      },
      async authorize(credentials) {
        const email = credentials.email as string;
        const password = credentials.password as string;
        const turnstileToken = credentials.turnstileToken as string;

        if (!email || !password) return null;

        // Turnstile is the login endpoint's bot protection and must not be
        // bypassable by calling the Auth.js callback directly.
        if (!turnstileToken) {
          console.warn(`[AUTH] Missing Turnstile token for ${email}`);
          throw new TurnstileSigninError();
        }

        const status = await verifyTurnstileStatus(turnstileToken);
        if (status === "unavailable") {
          throw new Error("Turnstile verification service unavailable");
        }
        if (status === "invalid") {
          console.warn(`[AUTH] Turnstile verification failed for ${email}`);
          throw new TurnstileSigninError();
        }

        // Look up user
        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        // Verify password
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return null;

        return { id: user.email, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      console.log("[AUTH] signIn callback for:", user.email);
      if (!user.email) return false;
      // Allow both existing users and new signups (user will be created by adapter)
      return true;
    },
    async jwt({ token, user }) {
      // The cookie proves identity, but its role/intern claims can be stale
      // after an admin changes this account. Refresh from the database on
      // every session read so promotions and revocations apply immediately,
      // including to existing cookies. Never trust client update payloads.
      const email = user?.email || (token.email as string) || (token.sub as string);
      if (!email) return null;

      try {
        const dbUser = await db.user.findUnique({
          where: { email },
          select: {
            email: true,
            name: true,
            role: true,
            passwordHash: true,
            managerProfile: { select: { tag: true, intern: true } },
          },
        });
        if (!dbUser) return null;
        token.email = dbUser.email;
        token.name = dbUser.name;
        token.role = dbUser.role;
        token.tag = dbUser.managerProfile?.tag;
        // A manager with a missing profile has no verified qualification.
        token.isIntern = dbUser.role === "manager" && (dbUser.managerProfile?.intern ?? true);
        token.hasPassword = !!dbUser.passwordHash;
      } catch (err) {
        console.error("[AUTH] jwt db error:", err);
        // Do not authorize using old privileges when they cannot be verified.
        return null;
      }
      return token;
    },
    async session({ session, token }) {
      // The JWT callback has refreshed these claims for this session read.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = session.user as any;
      if (token) {
        if (token.email) user.email = token.email;
        if (token.name !== undefined) user.name = token.name;
        user.role = token.role;
        user.tag = token.tag;
        user.isIntern = token.isIntern;
        user.hasPassword = token.hasPassword;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
    verifyRequest: "/verify",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
