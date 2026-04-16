import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// metadataBase is required for social crawlers (WeChat, Slack, Twitter, etc.)
// to resolve relative OG image paths into absolute URLs.
const siteUrl = process.env.AUTH_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Crazy Hikers",
  description: "Hiking club activity management",
  openGraph: {
    title: "Crazy Hikers",
    description: "Hiking club activity management",
    siteName: "Crazy Hikers",
    images: ["/logo.jpg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crazy Hikers",
    description: "Hiking club activity management",
    images: ["/logo.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-geist-sans)]">
        {children}
      </body>
    </html>
  );
}
