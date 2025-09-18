// src/components/NeonBrushLogo.tsx
import React from "react";

type Props = { text?: string; className?: string };

export default function NeonBrushLogo({ text = "Anborco", className = "" }: Props) {
  return (
    <svg
      role="img"
      aria-label={text}
      viewBox="0 0 600 120"
      preserveAspectRatio="xMinYMid meet"
      className={`block ${className}`}
    >
      <defs>
        {/* 荒れ(刷毛っぽさ)を出すためのノイズ変形 */}
        <filter id="roughen" x="-20%" y="-40%" width="140%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* ネオングロー（外側に発光）※緑 */}
        <filter id="neon" x="-60%" y="-60%" width="220%" height="220%">
          <feMorphology operator="dilate" radius="1" in="SourceAlpha" result="thicken" />
          <feGaussianBlur in="thicken" stdDeviation="3" result="blurred" />
          <feFlood floodColor="#22c55e" floodOpacity="0.9" result="color" />
          <feComposite in="color" in2="blurred" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* 文字色（白インクっぽいグラデ） */}
        <linearGradient id="ink" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e5e7eb" />
        </linearGradient>
      </defs>

      {/* 太い下地のストローク（発光の素） */}
      <g filter="url(#neon)">
        <text
          x={4}
          y={90}
          fontSize={88}
          fontWeight={900}
          letterSpacing={2}
          fill="none"
          stroke="#22c55e"        /* 緑の太ストローク */
          strokeWidth={10}
          style={{ filter: "url(#roughen)" as any }}
        >
          {text}
        </text>

        {/* 本体（少しだけアウトラインを残す） */}
        <text
          x={4}
          y={90}
          fontSize={88}
          fontWeight={900}
          letterSpacing={2}
          fill="url(#ink)"
          stroke="#86efac"        /* 薄い緑で縁取り */
          strokeWidth={2}
          style={{
            paintOrder: "stroke",
            filter: "url(#roughen)" as any,
            fontFamily:
              'system-ui,"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif',
          }}
        >
          {text}
        </text>
      </g>
    </svg>
  );
}
