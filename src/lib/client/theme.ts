"use client";

import { useEffect, useState } from "react";

/**
 * 테마: system(OS 설정 따름) → light → dark 순으로 돈다.
 * 선택은 이 브라우저 localStorage에만 두고, 실제 적용은 <html data-theme>.
 * 첫 페인트 전에 적용하는 건 layout.tsx의 THEME_SCRIPT가 맡는다 (깜빡임 방지).
 */
export type ThemeChoice = "system" | "light" | "dark";

const KEY = "crdd.theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function readThemeChoice(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && media().matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function useTheme(): [ThemeChoice | null, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    setChoice(readThemeChoice());
    // system일 때는 OS 설정이 바뀌면 따라간다
    const query = media();
    const onChange = () => {
      if (readThemeChoice() === "system") applyTheme("system");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const update = (next: ThemeChoice) => {
    try {
      if (next === "system") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, next);
    } catch {
      // 저장이 막혀도 이번 화면에는 적용한다
    }
    applyTheme(next);
    setChoice(next);
  };

  return [choice, update];
}

/** 첫 페인트 전에 실행되는 인라인 스크립트 — useTheme과 같은 규칙 */
export const THEME_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("${KEY}");var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);d.dataset.theme=dark?"dark":"light"}catch(e){d.dataset.theme="light"}})();`;
