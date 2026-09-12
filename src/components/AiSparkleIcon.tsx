import React from 'react';

interface AiSparkleIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/**
 * Modern, high-craft AI Sparkle Vector Icon.
 * Features curved four-point intelligence stars with dual-tone Teal/Cyan gradient
 * and optical luminosity core, perfectly tailored for Swepinganku's design system.
 */
export function AiSparkleIcon({
  size = 16,
  className = '',
  ...props
}: AiSparkleIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient
          id="aiSparkleMainGrad"
          x1="2"
          y1="2"
          x2="18"
          y2="18"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#5EEAD4" />
          <stop offset="55%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>

        <linearGradient
          id="aiSparkleAccentGrad"
          x1="14"
          y1="1"
          x2="22"
          y2="8"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="40%" stopColor="#7DD3FC" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>

        <linearGradient
          id="aiSparkleMiniGrad"
          x1="16"
          y1="15"
          x2="21"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#99F6E4" />
          <stop offset="100%" stopColor="#2DD4BF" />
        </linearGradient>

        <filter id="aiSparkleGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.8" floodColor="#2DD4BF" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Primary AI Star (Center-Left) */}
      <path
        d="M10 2 Q10 10 18 10 Q10 10 10 18 Q10 10 2 10 Q10 10 10 2 Z"
        fill="url(#aiSparkleMainGrad)"
        filter="url(#aiSparkleGlow)"
      />

      {/* Primary Star Center Luminous Core */}
      <circle cx="10" cy="10" r="1.35" fill="#FFFFFF" fillOpacity="0.9" />

      {/* Secondary Companion Sparkle (Top-Right) */}
      <path
        d="M18.5 1 Q18.5 4.5 22 4.5 Q18.5 4.5 18.5 8 Q18.5 4.5 15 4.5 Q18.5 4.5 18.5 1 Z"
        fill="url(#aiSparkleAccentGrad)"
      />

      {/* Tertiary Ambient Micro Sparkle (Bottom-Right) */}
      <path
        d="M18.5 15.5 Q18.5 17.5 20.5 17.5 Q18.5 17.5 18.5 19.5 Q18.5 17.5 16.5 17.5 Q18.5 17.5 18.5 15.5 Z"
        fill="url(#aiSparkleMiniGrad)"
      />
    </svg>
  );
}
