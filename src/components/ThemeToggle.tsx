"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/client/theme";

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemeChoice, string> = { system: "시스템", light: "라이트", dark: "다크" };
const ICON = { system: Monitor, light: Sun, dark: Moon } as const;

/** 상태 바의 테마 전환 — 누를 때마다 시스템 → 라이트 → 다크 */
export default function ThemeToggle() {
  const [choice, setChoice] = useTheme();
  const current = choice ?? "system";
  const Icon = ICON[current];
  return (
    <button
      type="button"
      onClick={() => setChoice(NEXT[current])}
      className="flex items-center gap-1.5 px-2 hover:bg-white/15"
      aria-label={`테마: ${LABEL[current]}. 누르면 ${LABEL[NEXT[current]]}로 바뀝니다`}
      title="테마 전환"
    >
      <Icon className="size-3.5" aria-hidden />
      <span>{LABEL[current]}</span>
    </button>
  );
}
