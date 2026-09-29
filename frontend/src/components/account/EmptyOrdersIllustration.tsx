import React from "react";

export default function EmptyOrdersIllustration({ className = "w-36 h-36" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Soft botanical leaf gradients */}
        <linearGradient id="bagLeafGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#95B176" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#467065" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="bagLeafGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7C9C59" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#3C5E55" stopOpacity="0.35" />
        </linearGradient>
        {/* Bag paper gradient */}
        <linearGradient id="bagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EDEAE2" />
          <stop offset="100%" stopColor="#DFDACF" />
        </linearGradient>
        <linearGradient id="bagSideGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D5CFBF" />
          <stop offset="100%" stopColor="#C4BDB0" />
        </linearGradient>
      </defs>

      {/* Ground soft shadow */}
      <ellipse cx="80" cy="132" rx="42" ry="7" fill="#467065" fillOpacity="0.08" />
      <ellipse cx="78" cy="132" rx="28" ry="4.5" fill="#467065" fillOpacity="0.12" />

      {/* Botanical leaves behind the bag on the right */}
      <g>
        {/* Branch stem */}
        <path
          d="M85 88 C105 75 120 62 138 42"
          stroke="#7C9C59"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.45"
        />
        {/* Leaf 1 (Top right) */}
        <path
          d="M138 42 C146 32 142 22 130 26 C118 30 124 40 138 42 Z"
          fill="url(#bagLeafGrad1)"
        />
        {/* Leaf 2 (Upper side) */}
        <path
          d="M122 55 C132 46 136 38 126 40 C114 42 116 52 122 55 Z"
          fill="url(#bagLeafGrad2)"
        />
        {/* Leaf 3 (Middle branch) */}
        <path
          d="M108 68 C124 62 128 52 115 54 C104 56 102 65 108 68 Z"
          fill="url(#bagLeafGrad1)"
        />
        {/* Leaf 4 (Lower accent) */}
        <path
          d="M96 78 C110 74 114 67 104 70 C96 72 92 77 96 78 Z"
          fill="url(#bagLeafGrad2)"
        />
      </g>

      {/* Bag string handles (behind front lip) */}
      <path
        d="M62 68 C62 44 72 40 76 40 C80 40 90 44 90 68"
        stroke="#8C8476"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M58 72 C58 48 68 44 72 44 C76 44 86 48 86 72"
        stroke="#59544D"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* Shopping bag 3D body */}
      {/* Side facet */}
      <polygon
        points="48,74 58,70 58,124 48,128"
        fill="url(#bagSideGrad)"
        stroke="#BDB5A4"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Front facet */}
      <polygon
        points="58,70 102,70 104,124 58,124"
        fill="url(#bagGrad)"
        stroke="#BDB5A4"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Top rim fold / turn-over */}
      <polygon
        points="58,70 102,70 101.5,75 58,75"
        fill="#D6D0C2"
        stroke="#C4BCAB"
        strokeWidth="0.6"
      />

      {/* Center fold crease line on front */}
      <line
        x1="80"
        y1="75"
        x2="80"
        y2="124"
        stroke="#C8C1B0"
        strokeWidth="0.8"
        strokeDasharray="2 3"
        strokeOpacity="0.6"
      />

      {/* Handle attachment eyelets/rivets on front */}
      <circle cx="68" cy="78" r="1.5" fill="#6A6258" />
      <circle cx="92" cy="78" r="1.5" fill="#6A6258" />
    </svg>
  );
}
