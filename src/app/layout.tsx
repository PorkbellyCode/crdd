import type { Metadata } from "next";
import { JetBrains_Mono, Nanum_Gothic_Coding } from "next/font/google";
import "./globals.css";
import StatusBar from "@/components/StatusBar";
import TabBar from "@/components/TabBar";
import { auth } from "@/auth";
import { THEME_SCRIPT } from "@/lib/client/theme";
import { cn } from "@/lib/utils";

// 라틴 문자와 숫자는 JetBrains Mono, 한글은 나눔고딕코딩 — 한국 개발자가 에디터에 흔히 쓰는 조합
const code = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-code",
});

const hangul = Nanum_Gothic_Coding({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-hangul",
  preload: false,
});

export const metadata: Metadata = {
  title: "CRDD — Understand the code you build with AI",
  description: "AI와 함께 만든 코드를 얼마나 설명할 수 있는지, 프로젝트 구조 위에 부채비율로 보여줍니다",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    // data-theme은 THEME_SCRIPT가 첫 페인트 전에 붙인다 — 서버 HTML과 달라지므로 경고를 끈다
    <html lang="ko" suppressHydrationWarning className={cn(code.variable, hangul.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh pb-7 leading-relaxed">
        <TabBar signedIn={Boolean(session?.user?.id)} />
        {children}
        <StatusBar />
      </body>
    </html>
  );
}
