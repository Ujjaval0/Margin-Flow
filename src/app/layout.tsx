import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PlatformProvider } from "@/domain/store";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "MarginFlow | Financial Intelligence Platform",
  description:
    "Transaction-level multi-channel profit engine & financial intelligence for modern e-commerce.",
  icons: {
    icon: "/margin-flow-icon.png",
    shortcut: "/margin-flow-icon.png",
    apple: "/margin-flow-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable} ${geistMono.variable} h-full scroll-smooth`}>
      <body className={`${inter.className} bg-[#F5F5F7] text-[#1D1D1F] min-h-full font-sans antialiased selection:bg-neutral-900 selection:text-white m-0 p-0`}>
        <PlatformProvider>{children}</PlatformProvider>
      </body>
    </html>
  );
}
