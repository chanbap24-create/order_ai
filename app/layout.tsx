import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./styles/design-system.css";
import Navigation from "./components/Navigation";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sales Desk - Internal Sales Automation Tool",
  description: "와인 & 와인잔 발주 자동 생성 시스템",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1, // ✅ 모바일 자동 줌 방지
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${inter.variable} antialiased`}
      >
        <Navigation />
        <main style={{ paddingTop: '70px', minHeight: '100vh' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
