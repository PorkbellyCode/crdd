"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Box } from "@/lib/crdd/tidy";

/**
 * SVG 확대·이동 — viewBox를 바꿔서 한다 (DOM 변환 없이, 선 굵기·글자도 같이 커진다).
 *
 *   휠 / 트랙패드 핀치  → 커서 위치 기준 확대·축소
 *   드래그             → 이동 (4px 넘게 움직였으면 클릭으로 치지 않는다)
 *   zoomBy / fit       → 버튼용
 *
 * 배율 100% = 좌표 1단위가 화면 1px. 전체 보기는 내용이 칸보다 크면 줄이지만(72%까지),
 * 작다고 키우지는 않는다 — 키우면 글자·선이 같이 커져 지도가 뭉툭해진다.
 * 72%로도 다 안 들어가는 큰 지도는 초점(선택한 개념)을 가운데에 둔다.
 */
export function fitToViewport(
  content: Box,
  width: number,
  height: number,
  focus?: { x: number; y: number },
): Box {
  if (width <= 0 || height <= 0) return content;
  const needed = Math.max(content.w / width, content.h / height, 1);
  // 좁은 화면·큰 지도에서는 72%까지만 줄인다 — 더 줄이면 이름을 읽을 수 없다
  const scale = Math.min(needed, 1 / 0.72);
  const w = width * scale;
  const h = height * scale;
  const centered = { x: content.x + (content.w - w) / 2, y: content.y + (content.h - h) / 2, w, h };
  if (scale >= needed || !focus) return centered;
  // 다 들어가지 않으면 초점(선택한 개념)을 가운데에 두되, 내용 밖으로 나가지 않게
  const clampAxis = (center: number, size: number, start: number, span: number) =>
    span <= size ? start + (span - size) / 2 : Math.min(Math.max(center - size / 2, start), start + span - size);
  return {
    x: clampAxis(focus.x, w, content.x, content.w),
    y: clampAxis(focus.y, h, content.y, content.h),
    w,
    h,
  };
}

export function usePanZoom(contentBox: Box, focus?: { x: number; y: number }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const rect = svg.getBoundingClientRect();
      setSize((prev) =>
        Math.abs(prev.w - rect.width) < 1 && Math.abs(prev.h - rect.height) < 1
          ? prev
          : { w: rect.width, h: rect.height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  // 초점은 처음 맞출 때만 쓴다 — 개념을 고를 때마다 화면이 튀지 않게 보기(데이터)가 바뀔 때만 다시 계산
  const focusRef = useRef(focus);
  const focusKey = `${contentBox.x}:${contentBox.y}:${contentBox.w}:${contentBox.h}`;
  const lastKey = useRef(focusKey);
  if (lastKey.current !== focusKey) {
    lastKey.current = focusKey;
    focusRef.current = focus;
  }
  const fitBox = fitToViewport(contentBox, size.w, size.h, focusRef.current);
  const [box, setBox] = useState<Box>(fitBox);
  const boxRef = useRef(box);
  boxRef.current = box;
  /** 방금 드래그했는지 — 노드 onClick에서 확인해 클릭을 무시한다 */
  const dragged = useRef(false);

  // 데이터나 보기가 바뀌면 전체 맞춤으로 돌아간다
  useEffect(() => setBox(fitBox), [fitBox.x, fitBox.y, fitBox.w, fitBox.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const clamp = useCallback(
    (next: Box): Box => {
      // 실제 크기의 4배까지 확대, 전체 보기의 두 배까지 축소
      const minW = Math.min(fitBox.w, size.w || fitBox.w) / 4;
      const maxW = fitBox.w * 2;
      const w = Math.min(Math.max(next.w, minW), maxW);
      const ratio = w / next.w;
      return { x: next.x, y: next.y, w, h: next.h * ratio };
    },
    [fitBox.w, size.w],
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
    /** 실제 크기 대비 배율 (1 = 좌표 1단위가 1px) */
    zoom: size.w > 0 ? size.w / box.w : 1,
    dragged,
    zoomBy: (factor: number) => zoomAt(factor),
    fit: () => setBox(fitBox),
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
