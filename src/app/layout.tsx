import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRDD — Understand the code you build with AI",
  description:
    "AI가 만든 코드를 얼마나 이해하고 있는지 프로젝트 구조 위에 부채비율로 보여주는 도구",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
