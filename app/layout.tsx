import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { runtimeEnv } from "@/lib/env";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const baseUrl = runtimeEnv.siteUrl || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "PolicyPilot | Enterprise AI Compliance Training",
    template: "%s | PolicyPilot",
  },
  description:
    "From AI policy docs to role-ready training in under 45 minutes, with auditable attestations and exportable evidence.",
  openGraph: {
    title: "PolicyPilot",
    description:
      "Transform policy documents into enterprise-ready AI compliance learning workflows.",
    url: baseUrl,
    siteName: "PolicyPilot",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}
