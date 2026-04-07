import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { sendMagicLinkEmail } from "./email";
import { db } from "./db";
import { rateLimit } from "./rate-limit";
import { verifyTurnstile } from "./turnstile";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { NextAuthConfig } from "next-auth";

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
    const created = await db.user.create({
      data: { email: user.email, name: user.email, role: "member" },
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
    EmailProvider({
      server: { host: "smtp.placeholder.com", port: 587, auth: { user: "", pass: "" } },
      from: "noreply@crazyhiker.com",
      sendVerificationRequest: async ({ identifier: email, url }) => {
        // Rate limit: max 3 magic links per email per 15 minutes
        const { allowed } = rateLimit(`signin:${email}`, { maxAttempts: 3, windowMs: 15 * 60 * 1000 });
        if (!allowed) {
          console.warn(`[AUTH] Rate limited magic link for ${email}`);
          throw new Error("Too many sign-in attempts. Please try again later.");
        }
        console.log(`[AUTH] Magic link for ${email}: ${url}`);
        await sendMagicLinkEmail(email, url).catch((err) => {
          console.error("[AUTH] Email send failed:", err);
        });
      },
    }),
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

        // Rate limit password attempts
        const { allowed } = rateLimit(`password:${email}`, {
          maxAttempts: 5,
          windowMs: 15 * 60 * 1000,
        });
        if (!allowed) {
          console.warn(`[AUTH] Rate limited password attempt for ${email}`);
          return null;
        }

        // Verify Turnstile
        if (turnstileToken) {
          const valid = await verifyTurnstile(turnstileToken);
          if (!valid) {
            console.warn(`[AUTH] Turnstile verification failed for ${email}`);
            return null;
          }
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
      // On first sign-in, `user` is present. On subsequent requests, only `token` is.
      // Always refresh role from DB to pick up role changes.
      const email = user?.email || (token.email as string) || (token.sub as string);
      console.log("[AUTH] jwt callback - email:", email, "token.role:", token.role);
      if (email) {
        try {
          const dbUser = await db.user.findUnique({
            where: { email },
            include: { managerProfile: true },
          });
          console.log("[AUTH] jwt db lookup result:", dbUser ? { email: dbUser.email, role: dbUser.role } : "NOT FOUND");
          if (dbUser) {
            token.email = dbUser.email;
            token.name = dbUser.name;
            token.role = dbUser.role;
            token.tag = dbUser.managerProfile?.tag;
            token.isIntern = dbUser.managerProfile?.intern;
            token.hasPassword = !!dbUser.passwordHash;
            console.log("[AUTH] jwt token.role set to:", token.role);
          }
        } catch (err) {
          console.error("[AUTH] jwt db error:", err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = session.user as any;
      const email = token?.email || token?.sub || session.user?.email;
      if (email) {
        // Always read role from DB since JWT token doesn't persist custom fields with adapter
        const dbUser = await db.user.findUnique({
          where: { email: email as string },
          include: { managerProfile: true },
        });
        if (dbUser) {
          user.email = dbUser.email;
          user.name = dbUser.name;
          user.role = dbUser.role;
          user.tag = dbUser.managerProfile?.tag;
          user.isIntern = dbUser.managerProfile?.intern;
          user.hasPassword = !!dbUser.passwordHash;
        }
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
