"use client";

import { useRef, useState } from "react";
import { getRandomColor } from "../../lib/utils/color";

function normalizePairs(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const left = "left" in item && typeof item.left === "string" ? item.left : "";
      const right = "right" in item && typeof item.right === "string" ? item.right : "";
      if (!left || !right) return null;
      return { left, right };
    })
    .filter((item) => item !== null);
}

function normalizeStringList(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((item) => typeof item === "string");
}

export function MatchingQuestionUI({ question, value, onChange, readOnly }) {
  const lefts = normalizePairs(question.answerKey?.pairs ?? []).map((p) => p.left);
  const rights = (question.answerKey?.options && Array.isArray(question.answerKey.options)
    ? normalizeStringList(question.answerKey.options)
    : normalizePairs(question.answerKey?.pairs ?? []).map((p) => p.right));
  const selectedPairs = normalizePairs(value);
  const [pendingLeft, setPendingLeft] = useState(null);
  const leftRefs = useRef([]);
  const rightRefs = useRef([]);

  const colorMap = {};
  selectedPairs.forEach((pair) => {
    colorMap[pair.left + "-" + pair.right] = getRandomColor(pair.left + "-" + pair.right);
  });

  const lines = selectedPairs.map((pair) => {
    const lIdx = lefts.indexOf(pair.left);
    const rIdx = rights.indexOf(pair.right);
    if (lIdx === -1 || rIdx === -1) return null;
    const leftEl = leftRefs.current[lIdx];
    const rightEl = rightRefs.current[rIdx];
    if (!leftEl || !rightEl) return null;
    const leftRect = leftEl.getBoundingClientRect();
    const rightRect = rightEl.getBoundingClientRect();
    const svgRect = leftEl.parentElement?.parentElement?.getBoundingClientRect();
    if (!svgRect) return null;
    const y1 = leftRect.top + leftRect.height / 2 - svgRect.top;
    const y2 = rightRect.top + rightRect.height / 2 - svgRect.top;
    const x1 = leftRect.right - svgRect.left;
    const x2 = rightRect.left - svgRect.left;
    const color = colorMap[pair.left + "-" + pair.right] || getRandomColor(pair.left + "-" + pair.right);
    return (
      <line
        key={pair.left + "-" + pair.right}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={4}
        markerEnd="url(#arrow)"
      />
    );
  });

  function handleLeftClick(left) {
    if (readOnly) return;
    setPendingLeft(left === pendingLeft ? null : left);
  }
  function handleRightClick(right) {
    if (readOnly || !pendingLeft) return;
    const filtered = selectedPairs.filter((p) => p.left !== pendingLeft && p.right !== right);
    const withoutLeft = filtered.filter((p) => p.left !== pendingLeft);
    const next = [...withoutLeft, { left: pendingLeft, right }];
    setPendingLeft(null);
    onChange?.(next);
  }
  function handleRemovePair(left) {
    if (readOnly) return;
    const next = selectedPairs.filter((p) => p.left !== left);
    onChange?.(next);
  }

  return (
    <div style={{ position: "relative" }}>
      <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L10,5 L0,10" fill="gray" />
          </marker>
        </defs>
        {lines}
      </svg>
      <div className="grid grid-cols-2 gap-4 relative z-10">
        <div className="space-y-2">
          {lefts.map((left, idx) => {
            const pair = selectedPairs.find((p) => p.left === left);
            const color = pair ? colorMap[pair.left + "-" + pair.right] : undefined;
            return (
              <div
                key={left}
                ref={el => leftRefs.current[idx] = el}
                className={`rounded-md border px-3 py-2 text-sm cursor-pointer select-none flex items-center gap-2 ${pendingLeft === left ? "ring-2 ring-blue-400" : ""}`}
                style={{ background: color || undefined, borderColor: color || undefined, opacity: pair ? 0.95 : 1 }}
                onClick={() => handleLeftClick(left)}
              >
                <span>{left}</span>
                {pair && !readOnly ? (
                  <button type="button" className="ml-auto text-xs text-red-600" onClick={e => { e.stopPropagation(); handleRemovePair(left); }}>Hapus</button>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          {rights.map((right, idx) => {
            const pair = selectedPairs.find((p) => p.right === right);
            const color = pair ? colorMap[pair.left + "-" + pair.right] : undefined;
            return (
              <div
                key={right}
                ref={el => rightRefs.current[idx] = el}
                className={`rounded-md border px-3 py-2 text-sm cursor-pointer select-none ${pair ? "opacity-95" : ""}`}
                style={{ background: color || undefined, borderColor: color || undefined }}
                onClick={() => handleRightClick(right)}
              >
                <span>{right}</span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-2">Klik kiri lalu klik kanan untuk menjodohkan. Klik "Hapus" untuk membatalkan pasangan.</p>
    </div>
  );
}
