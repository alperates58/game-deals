import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

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
      <body className={`${inter.variable} min-h-screen bg-zinc-950 text-zinc-100 antialiased flex flex-col font-sans`}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
