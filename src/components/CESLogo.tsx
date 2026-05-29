import React from 'react';
import { motion } from 'motion/react';

interface CESLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'sidebar';
  variant?: 'full' | 'icon-only' | 'sidebar';
  theme?: 'light' | 'dark' | 'auto';
}

export default function CESLogo({ 
  className = '', 
  size = 'md', 
  variant = 'full',
  theme = 'auto'
}: CESLogoProps) {
  // Height classes for responsive container sizing
  const heightClass = {
    sm: 'h-8',
    md: 'h-14',
    lg: 'h-24',
    sidebar: 'h-9',
  }[size];

  // Auto-detect dark mode based on size/variant (since sidebar is dark)
  const isDarkTheme = theme === 'dark' || (theme === 'auto' && size === 'sidebar');

  // Interactive color definitions
  const orangeColor = '#EA580C';
  const blueColor = isDarkTheme ? '#3b82f6' : '#0029FF';
  const taglineColor = isDarkTheme ? '#cbd5e1' : '#334155';
  const ringFill = isDarkTheme ? '#0b0f19' : '#ffffff';

  if (variant === 'icon-only') {
    return (
      <svg
        viewBox="0 0 160 160"
        className={`${heightClass} w-auto ${className} shrink-0`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Orange Wave Arch with motion */}
        <motion.path
          d="M 50 125 C 45 92, 75 58, 135 52"
          fill="none"
          stroke={orangeColor}
          strokeWidth="11"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />

        {/* Outer Connection Tracks / Rods & Circles */}
        <motion.path
          d="M 34 84 L 50 52"
          fill="none"
          stroke={orangeColor}
          strokeWidth="8"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        />
        
        <motion.path
          d="M 34 94 L 26 112"
          fill="none"
          stroke={orangeColor}
          strokeWidth="7"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
        />

        {/* Inner Blue Wave swooping upward */}
        <motion.path
          d="M 58 144 C 66 112, 60 82, 98 68"
          fill="none"
          stroke={blueColor}
          strokeWidth="10"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, delay: 0.3, ease: "easeOut" }}
        />

        {/* --- DYNAMIC INTERACTIVE HOLLOW RINGS MATCHING PHOTO --- */}
        {/* Top-Left Orange Ring (on the first rod) */}
        <motion.circle
          cx="50"
          cy="52"
          r="7.5"
          fill={ringFill}
          stroke={orangeColor}
          strokeWidth="4.2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [1, 1.15, 1], opacity: 1 }}
          transition={{
            scale: { repeat: Infinity, repeatType: "reverse", duration: 2.2, ease: "easeInOut", delay: 0.1 },
            opacity: { duration: 0.4, delay: 0.1 }
          }}
        />

        {/* Bottom-Left Orange Ring (on the second rod) */}
        <motion.circle
          cx="26"
          cy="112"
          r="7.5"
          fill={ringFill}
          stroke={orangeColor}
          strokeWidth="4.2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [1, 1.15, 1], opacity: 1 }}
          transition={{
            scale: { repeat: Infinity, repeatType: "reverse", duration: 2.2, ease: "easeInOut", delay: 0.3 },
            opacity: { duration: 0.4, delay: 0.3 }
          }}
        />

        {/* Top-Right Blue Ring (Tip of Orange Wave) */}
        <motion.circle
          cx="135"
          cy="52"
          r="7.5"
          fill={ringFill}
          stroke={blueColor}
          strokeWidth="4.2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [1, 1.15, 1], opacity: 1 }}
          transition={{
            scale: { repeat: Infinity, repeatType: "reverse", duration: 2.2, ease: "easeInOut", delay: 0.5 },
            opacity: { duration: 0.4, delay: 0.5 }
          }}
        />

        {/* Center Blue Ring (End of Blue Wave) */}
        <motion.circle
          cx="98"
          cy="68"
          r="7.5"
          fill={ringFill}
          stroke={blueColor}
          strokeWidth="4.2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [1, 1.15, 1], opacity: 1 }}
          transition={{
            scale: { repeat: Infinity, repeatType: "reverse", duration: 2.2, ease: "easeInOut", delay: 0.7 },
            opacity: { duration: 0.4, delay: 0.7 }
          }}
        />

        {/* Bottom-Center Blue Ring (Start of Blue Wave) */}
        <motion.circle
          cx="58"
          cy="144"
          r="7.5"
          fill={ringFill}
          stroke={blueColor}
          strokeWidth="4.2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [1, 1.15, 1], opacity: 1 }}
          transition={{
            scale: { repeat: Infinity, repeatType: "reverse", duration: 2.2, ease: "easeInOut", delay: 0.9 },
            opacity: { duration: 0.4, delay: 0.9 }
          }}
        />
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
          {/* Outer Orange Wave Arch with motion */}
          <motion.path
            d="M 50 125 C 45 92, 75 58, 135 52"
            fill="none"
            stroke={orangeColor}
            strokeWidth="11"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />

          {/* Outer Connection Tracks / Rods & Circles */}
          <motion.path
            d="M 34 84 L 50 52"
            fill="none"
            stroke={orangeColor}
            strokeWidth="8"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          />

          <motion.path
            d="M 34 94 L 26 112"
            fill="none"
            stroke={orangeColor}
            strokeWidth="7"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          />

          {/* Inner Blue Wave swooping upward */}
          <motion.path
            d="M 58 144 C 66 112, 60 82, 98 68"
            fill="none"
            stroke={blueColor}
            strokeWidth="10"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.1, delay: 0.3, ease: "easeOut" }}
          />

          {/* Top-Left Orange Ring */}
          <motion.circle
            cx="50"
            cy="52"
            r="7.5"
            fill={ringFill}
            stroke={orangeColor}
            strokeWidth="4.2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.15, 1], opacity: 1 }}
            transition={{
              scale: { repeat: Infinity, repeatType: "reverse", duration: 2.2, ease: "easeInOut", delay: 0.1 },
              opacity: { duration: 0.4, delay: 0.1 }
            }}
          />

          {/* Bottom-Left Orange Ring */}
          <motion.circle
            cx="26"
            cy="112"
            r="7.5"
            fill={ringFill}
            stroke={orangeColor}
            strokeWidth="4.2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.15, 1], opacity: 1 }}
            transition={{
              scale: { repeat: Infinity, repeatType: "reverse", duration: 2.2, ease: "easeInOut", delay: 0.3 },
              opacity: { duration: 0.4, delay: 0.3 }
            }}
          />

          {/* Top-Right Blue Ring (Tip of Orange Wave) */}
          <motion.circle
            cx="135"
            cy="52"
            r="7.5"
            fill={ringFill}
            stroke={blueColor}
            strokeWidth="4.2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.15, 1], opacity: 1 }}
            transition={{
              scale: { repeat: Infinity, repeatType: "reverse", duration: 2.2, ease: "easeInOut", delay: 0.5 },
              opacity: { duration: 0.4, delay: 0.5 }
            }}
          />

          {/* Center Blue Ring (End of Blue Wave) */}
          <motion.circle
            cx="98"
            cy="68"
            r="7.5"
            fill={ringFill}
            stroke={blueColor}
            strokeWidth="4.2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.15, 1], opacity: 1 }}
            transition={{
              scale: { repeat: Infinity, repeatType: "reverse", duration: 2.2, ease: "easeInOut", delay: 0.7 },
              opacity: { duration: 0.4, delay: 0.7 }
            }}
          />

          {/* Bottom-Center Blue Ring (Start of Blue Wave) */}
          <motion.circle
            cx="58"
            cy="144"
            r="7.5"
            fill={ringFill}
            stroke={blueColor}
            strokeWidth="4.2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.15, 1], opacity: 1 }}
            transition={{
              scale: { repeat: Infinity, repeatType: "reverse", duration: 2.2, ease: "easeInOut", delay: 0.9 },
              opacity: { duration: 0.4, delay: 0.9 }
            }}
          />
        </g>

        {/* --- RIGHT: WORDMARK & TAGLINE --- */}
        {/* 'CES' Main Bold Italic Heading with Slide-Fade Animation */}
        <motion.text
          x="150"
          y="105"
          fontFamily="&quot;Plus Jakarta Sans&quot;, &quot;Inter&quot;, system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize="92"
          fill={blueColor}
          letterSpacing="-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="cursor-pointer"
        >
          CES
        </motion.text>

        {/* 'ENGINEERING SOLUTIONS PVT. LTD.' Tagline with Elegant Fade */}
        <motion.text
          x="152"
          y="134"
          fontFamily="&quot;Plus Jakarta Sans&quot;, &quot;Inter&quot;, system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="14.5"
          fill={taglineColor}
          letterSpacing="0.8"
          textLength="350"
          lengthAdjust="spacingAndGlyphs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.1, delay: 0.4, ease: "easeOut" }}
        >
          ENGINEERING SOLUTIONS PVT. LTD.
        </motion.text>
      </svg>
    </div>
  );
}
