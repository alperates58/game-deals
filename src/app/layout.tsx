import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#09090b",
};

export const metadata: Metadata = {
  title: "Xbox Gerçek Fırsat Takip Sistemi | game.alperates.com.tr",
  description:
    "Xbox ve Microsoft Store Türkiye'deki gerçek indirimleri, takip başladığından beri görülen en düşük fiyatları ve fırsat analizlerini keşfedin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark">
      <body
        className={`${inter.variable} min-h-screen bg-zinc-950 text-zinc-100 antialiased flex flex-col font-sans overflow-x-hidden w-full max-w-full relative`}
      >
        <Header />
        <main className="flex-1 w-full max-w-full overflow-x-hidden">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
