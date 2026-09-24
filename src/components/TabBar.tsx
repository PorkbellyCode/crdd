"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  /** 이 경로로 시작하면 활성 탭 */
  match: (path: string) => boolean;
}

/**
 * 상단 탭 바 — 에디터의 열린 파일 탭처럼 생겼다. 활성 탭은 위쪽 파란 선과 편집기 배경색으로
 * 아래 본문과 이어진다. 에디터처럼 창 가장자리에 붙인다 (본문 폭에 맞춰 가운데로 모으지 않는다).
 */
export default function TabBar({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  const tabs: Tab[] = [
    { href: "/", label: "분석", match: (p) => p === "/" || p.startsWith("/a/") || p.startsWith("/quiz/") },
    { href: "/demo", label: "데모", match: (p) => p.startsWith("/demo") },
    ...(signedIn ? [{ href: "/me", label: "내 프로젝트", match: (p: string) => p.startsWith("/me") }] : []),
    { href: "/settings", label: "API 키", match: (p) => p.startsWith("/settings") },
  ];

  return (
    <header className="border-b border-border bg-chrome">
      <nav className="flex items-stretch overflow-x-auto px-4" aria-label="주요 화면">
        <Link href="/" className="flex items-center pr-5 text-[13px] font-bold tracking-tight text-foreground">
          crdd
        </Link>
        {tabs.map((tab) => {
          const active = tab.match(path);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center border-x border-t-2 px-4 py-2 text-[13px] whitespace-nowrap",
                active
                  ? "border-x-border border-t-primary bg-background text-foreground"
                  : "border-x-transparent border-t-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
