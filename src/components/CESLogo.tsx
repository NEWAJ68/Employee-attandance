import React from 'react';

interface CESLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'sidebar';
  variant?: 'full' | 'icon-only' | 'sidebar';
}

export default function CESLogo({ className = '', size = 'md', variant = 'full' }: CESLogoProps) {
  // Height classes for responsive container sizing
  const heightClass = {
    sm: 'h-8',
    md: 'h-14',
    lg: 'h-24',
    sidebar: 'h-9',
  }[size];

  if (variant === 'icon-only') {
    return (
      <svg
        viewBox="0 0 160 160"
        className={`${heightClass} w-auto ${className} shrink-0`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Orange Wave Arch */}
        <path
          d="M 50 125 C 45 92, 75 58, 128 55"
          fill="none"
          stroke="#EA580C"
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* Outer Connection Tracks / Rods & Circles */}
        <path
          d="M 34 84 L 46 60"
          fill="none"
          stroke="#EA580C"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle cx="50" cy="52" r="7" fill="#EA580C" />

        <path
          d="M 28 104 L 34 94"
          fill="none"
          stroke="#EA580C"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx="26" cy="112" r="6" fill="#EA580C" />

        {/* Inner Blue Wave swooping upward */}
        <path
          d="M 60 138 C 66 112, 60 82, 92 70"
          fill="none"
          stroke="#0029FF"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Blue Contact Diodes */}
        <circle cx="98" cy="68" r="7" fill="#0029FF" />
        <circle cx="58" cy="144" r="7" fill="#0029FF" />
      </svg>
    );
  }

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <svg
        viewBox="0 0 520 160"
        className={`${heightClass} w-auto`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ contentVisibility: 'auto' }}
      >
        {/* --- LEFT: VECTOR TECH ICON --- */}
        <g id="ces-logo-symbol">
          {/* Outer Orange Wave Arch */}
          <path
            d="M 50 125 C 45 92, 75 58, 128 55"
            fill="none"
            stroke="#EA580C"
            strokeWidth="11"
            strokeLinecap="round"
          />

          {/* Outer Connection Tracks / Rods & Circles */}
          <path
            d="M 34 84 L 46 60"
            fill="none"
            stroke="#EA580C"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <circle cx="50" cy="52" r="7" fill="#EA580C" />

          <path
            d="M 28 104 L 34 94"
            fill="none"
            stroke="#EA580C"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle cx="26" cy="112" r="6" fill="#EA580C" />

          {/* Inner Blue Wave swooping upward */}
          <path
            d="M 60 138 C 66 112, 60 82, 92 70"
            fill="none"
            stroke="#0029FF"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Blue Contact Diodes */}
          <circle cx="98" cy="68" r="7" fill="#0029FF" />
          <circle cx="58" cy="144" r="7" fill="#0029FF" />
        </g>

        {/* --- RIGHT: WORDMARK & TAGLINE --- */}
        {/* 'CES' Main Bold Italic Heading */}
        <text
          x="150"
          y="105"
          fontFamily="Inter, system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize="92"
          fill="#0029FF"
          letterSpacing="-3"
        >
          CES
        </text>

        {/* 'ENGINEERING SOLUTIONS PVT. LTD.' Tagline */}
        <text
          x="152"
          y="134"
          fontFamily="Inter, system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="14.5"
          fill="#334155"
          letterSpacing="0.8"
          textLength="350"
          lengthAdjust="spacingAndGlyphs"
        >
          ENGINEERING SOLUTIONS PVT. LTD.
        </text>
      </svg>
    </div>
  );
}
