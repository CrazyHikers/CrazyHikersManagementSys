import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { getBaseUrl } from "@/lib/url";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// metadataBase is required for social crawlers (WeChat, Slack, Twitter, etc.)
// to resolve relative OG image paths into absolute URLs. Uses getBaseUrl()
// so previews link OG images at their own deployment, not production.
const siteUrl = getBaseUrl();

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
        {/* sampleRate=0.2: we were 3.4x over the 10K/mo Speed Insights data
            point quota; sampling 20% lands us at ~6.8K projected. p75 metrics
            on the homepage and activity detail still get plenty of samples
            at this rate; low-traffic dashboard routes will be noisier. */}
        <SpeedInsights sampleRate={0.2} />
        <Analytics />
      </body>
    </html>
  );
}
