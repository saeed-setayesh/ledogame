import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        username: { label: "Username", type: "text" },
        isRegister: { label: "Is Register", type: "checkbox" },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          throw new Error("Email is required");
        }

        // Registration flow
        if (credentials.isRegister === "true") {
          if (!credentials.username || !credentials.password) {
            throw new Error(
              "Username and password are required for registration"
            );
          }

          // Check if user already exists
          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { email: credentials.email },
                { username: credentials.username },
              ],
            },
          });

          if (existingUser) {
            throw new Error("User with this email or username already exists");
          }

          // Hash password
          const hashedPassword = await bcrypt.hash(credentials.password, 10);

          // Create user (wallet will be created separately in wallet integration)
          const user = await prisma.user.create({
            data: {
              email: credentials.email,
              username: credentials.username,
              password: hashedPassword,
            },
          });

          return {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.username,
          };
        }

        // Login flow
        if (!credentials.password) {
          throw new Error("Password is required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValidPassword) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.username,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true, // Trust the host for production deployment
};
