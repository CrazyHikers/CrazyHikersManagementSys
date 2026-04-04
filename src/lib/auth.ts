import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { sendMagicLinkEmail } from "./email";
import { db } from "./db";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { NextAuthConfig } from "next-auth";

// Minimal adapter: only handles verification tokens and user lookup via managers table
const managerAdapter: Adapter = {
  async createUser(user) {
    // We don't create users — managers already exist in the DB
    const manager = await db.manager.findUnique({
      where: { email: user.email! },
    });
    if (!manager) throw new Error("Manager not found");
    return {
      id: manager.id,
      email: manager.email,
      name: manager.name,
      emailVerified: null,
    };
  },
  async getUser(id) {
    const manager = await db.manager.findUnique({ where: { id } });
    if (!manager) return null;
    return {
      id: manager.id,
      email: manager.email,
      name: manager.name,
      emailVerified: null,
    };
  },
  async getUserByEmail(email) {
    const manager = await db.manager.findUnique({ where: { email } });
    if (!manager) return null;
    return {
      id: manager.id,
      email: manager.email,
      name: manager.name,
      emailVerified: null,
    };
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
    // JWT strategy — no DB sessions
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
      data: {
        identifier: data.identifier,
        token: data.token,
        expires: data.expires,
      },
    });
    return data;
  },
  async useVerificationToken({ identifier, token }) {
    try {
      const existing = await db.verificationToken.findUnique({
        where: { identifier_token: { identifier, token } },
      });
      if (!existing) return null;
      await db.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      });
      return existing;
    } catch {
      return null;
    }
  },
};

export const authConfig: NextAuthConfig = {
  adapter: managerAdapter,
  providers: [
    EmailProvider({
      server: { host: "smtp.placeholder.com", port: 587, auth: { user: "", pass: "" } },
      from: "noreply@crazyhiker.com",
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const manager = await db.manager.findUnique({
        where: { email: user.email },
      });
      return !!manager;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const manager = await db.manager.findUnique({
          where: { email: user.email },
        });
        if (manager) {
          token.managerId = manager.id;
          token.managerName = manager.name;
          token.isIntern = manager.intern;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = session.user as any;
        user.managerId = token.managerId;
        user.managerName = token.managerName;
        user.isIntern = token.isIntern;
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin/signin",
    verifyRequest: "/admin/verify",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
