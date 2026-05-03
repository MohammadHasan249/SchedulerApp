import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Scheduler",
  description: "Workforce scheduling platform",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Scheduler",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon/180?color=%233b82f6" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${poppins.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-right" />
        <ServiceWorkerRegistrar />
        <PWAInstallBanner />
      </body>
    </html>
  );
}
