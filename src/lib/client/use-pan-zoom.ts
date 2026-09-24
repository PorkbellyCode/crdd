"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Box } from "@/lib/crdd/tidy";

/**
 * SVG 확대·이동 — viewBox를 바꿔서 한다 (DOM 변환 없이, 선 굵기·글자도 같이 커진다).
 *
 *   휠 / 트랙패드 핀치  → 커서 위치 기준 확대·축소
 *   드래그             → 이동 (4px 넘게 움직였으면 클릭으로 치지 않는다)
 *   zoomBy / fit       → 버튼용
 */
export function usePanZoom(fitBox: Box) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [box, setBox] = useState<Box>(fitBox);
  const boxRef = useRef(box);
  boxRef.current = box;
  /** 방금 드래그했는지 — 노드 onClick에서 확인해 클릭을 무시한다 */
  const dragged = useRef(false);

  // 데이터나 보기가 바뀌면 전체 맞춤으로 돌아간다
  useEffect(() => setBox(fitBox), [fitBox.x, fitBox.y, fitBox.w, fitBox.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const clamp = useCallback(
    (next: Box): Box => {
      const minW = fitBox.w / 10;
      const maxW = fitBox.w * 2;
      const w = Math.min(Math.max(next.w, minW), maxW);
      const ratio = w / next.w;
      return { x: next.x, y: next.y, w, h: next.h * ratio };
    },
    [fitBox.w],
  );

  /** 화면 좌표 → SVG 좌표 */
  const toSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }, []);

  const zoomAt = useCallback(
    (factor: number, at?: { x: number; y: number }) => {
      setBox((current) => {
        const center = at ?? { x: current.x + current.w / 2, y: current.y + current.h / 2 };
        const next = clamp({ ...current, w: current.w * factor, h: current.h * factor });
        const applied = next.w / current.w;
        return {
          x: center.x - (center.x - current.x) * applied,
          y: center.y - (center.y - current.y) * applied,
          w: next.w,
          h: next.h,
        };
      });
    },
    [clamp],
  );

  // 휠은 passive가 아니어야 페이지 스크롤을 막을 수 있어서 직접 등록한다
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const at = toSvg(event.clientX, event.clientY) ?? undefined;
      // 트랙패드 핀치는 ctrlKey와 함께 작은 delta로 온다 — 더 민감하게
      const speed = event.ctrlKey ? 0.01 : 0.0015;
      zoomAt(Math.exp(event.deltaY * speed), at);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [toSvg, zoomAt]);

  const start = useRef<{ x: number; y: number; box: Box; scale: number } | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const current = boxRef.current;
    // preserveAspectRatio="meet" — 더 많이 줄어든 축의 비율이 실제 배율이다
    const scale = Math.max(current.w / rect.width, current.h / rect.height);
    start.current = { x: event.clientX, y: event.clientY, box: current, scale };
    dragged.current = false;
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const origin = start.current;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (!dragged.current && Math.hypot(dx, dy) < 4) return;
    if (!dragged.current) {
      dragged.current = true;
      svgRef.current?.setPointerCapture(event.pointerId);
    }
    setBox({ ...origin.box, x: origin.box.x - dx * origin.scale, y: origin.box.y - dy * origin.scale });
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    start.current = null;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    // 드래그 뒤 따라오는 click 이벤트가 지나간 다음에 풀어준다
    setTimeout(() => {
      dragged.current = false;
    }, 0);
  }, []);

  return {
    svgRef,
    viewBox: `${box.x} ${box.y} ${box.w} ${box.h}`,
    zoom: fitBox.w / box.w,
    dragged,
    zoomBy: (factor: number) => zoomAt(factor),
    fit: () => setBox(fitBox),
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
