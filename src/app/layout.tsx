import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { cn } from "@/lib/utils";

const plexSans = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "CRDD — Understand the code you build with AI",
  description:
    "AI가 만든 코드를 얼마나 이해하고 있는지 프로젝트 구조 위에 부채비율로 보여주는 도구",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // 다크 단일 테마 — 토큰 값 자체가 다크라 .dark는 shadcn 변형을 위해 붙인다
    <html lang="ko" className={cn("dark", plexSans.variable, plexMono.variable)}>
      <body className="font-sans leading-relaxed">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
