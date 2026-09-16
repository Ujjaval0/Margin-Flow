import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PlatformProvider } from "@/domain/store";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Unified Platform | Financial & Operations Intelligence",
  description:
    "Transaction-level financial intelligence and operations platform for multi-channel e-commerce.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#F5F5F7] text-[#1D1D1F] min-h-screen font-sans antialiased selection:bg-neutral-900 selection:text-white">
        <PlatformProvider>{children}</PlatformProvider>
      </body>
    </html>
  );
}
