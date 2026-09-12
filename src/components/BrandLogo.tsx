import React from 'react';

interface BrandLogoIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
  variant?: 'default' | 'white' | 'monochrome';
}

/**
 * Standalone Icon Version of the Swepinganku Logo
 * Minimalist geometric healthcare mark combining:
 * - Medical cross (+)
 * - Dynamic sweeping curve ("S")
 * - Patient care silhouette & telemetry node
 * - Structured clinical documentation lines
 */
export function BrandLogoIcon({
  size = 24,
  className = '',
  variant = 'default',
  ...props
}: BrandLogoIconProps) {
  const isWhite = variant === 'white';
  const isMono = variant === 'monochrome';

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-label="Swepinganku Logo Icon"
      {...props}
    >
      <defs>
        <linearGradient id="blNavy" x1="12" y1="26" x2="38" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        <linearGradient id="blTeal" x1="26" y1="8" x2="54" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="40%" stopColor="#0D9488" />
          <stop offset="100%" stopColor="#0F766E" />
        </linearGradient>

        <linearGradient id="blAccent" x1="41" y1="13" x2="49" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>

      {/* Shape B: Navy Arm (Left & Bottom - Clinical Records & Foundation) */}
      <path
        d="M24 26H14C10.6863 26 8 28.6863 8 32C8 35.3137 10.6863 38 14 38H26V50C26 53.3137 28.6863 56 32 56C35.3137 56 38 53.3137 38 50V40L24 26Z"
        fill={isWhite ? '#FFFFFF' : isMono ? 'currentColor' : 'url(#blNavy)'}
        fillOpacity={isWhite ? 0.9 : 1}
      />

      {/* Patient Data & Ward Tracking Micro-indicators */}
      {!isWhite && !isMono && (
        <>
          <rect x="13" y="29.5" width="7.5" height="2" rx="1" fill="#38BDF8" fillOpacity="0.9" />
          <rect x="13" y="33" width="5" height="1.8" rx="0.9" fill="#94A3B8" fillOpacity="0.75" />
        </>
      )}

      {/* Shape A: Teal Arm (Top & Right - Surgical Rounds & Teamwork) */}
      <path
        d="M26 24V14C26 10.6863 28.6863 8 32 8C35.3137 8 38 10.6863 38 14V26H50C53.3137 26 56 28.6863 56 32C56 35.3137 53.3137 38 50 38H40L26 24Z"
        fill={isWhite ? '#FFFFFF' : isMono ? 'currentColor' : 'url(#blTeal)'}
        fillOpacity={isWhite ? 0.75 : 1}
      />

      {/* Patient Silhouette Head & Telemetry Node */}
      <circle
        cx="46"
        cy="18"
        r="7.5"
        stroke={isWhite ? '#FFFFFF' : '#06B6D4'}
        strokeWidth="1"
        strokeOpacity={isWhite ? 0.35 : 0.3}
      />
      <circle
        cx="46"
        cy="18"
        r="4.5"
        fill={isWhite ? '#FFFFFF' : isMono ? 'currentColor' : 'url(#blAccent)'}
      />
      <circle cx="44.5" cy="16.5" r="1.3" fill="#FFFFFF" fillOpacity={isWhite ? 0.5 : 0.85} />
    </svg>
  );
}

interface BrandLogoProps {
  className?: string;
  iconSize?: number;
  showSubtitle?: boolean;
  subtitleText?: string;
  divisionBadge?: string;
  divisionTheme?: { badge: string; hex: string };
  layout?: 'horizontal' | 'stacked';
}

/**
 * Primary Brand Logo (Symbol + Typography)
 * Horizontal composition for dashboard headers, auth forms, reports, and documentation.
 */
export function BrandLogo({
  className = '',
  iconSize = 36,
  showSubtitle = true,
  subtitleText = 'Surgical Sweeping & WA Report',
  divisionBadge,
  divisionTheme,
  layout = 'horizontal',
}: BrandLogoProps) {
  if (layout === 'stacked') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <div className="w-14 h-14 rounded-2xl bg-slate-900/5 border border-slate-200/80 p-2.5 flex items-center justify-center shadow-xs">
          <BrandLogoIcon size={iconSize} className="w-full h-full" />
        </div>
        <div className="mt-3">
          <div className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
            <span>Sweping</span>
            <span className="text-teal-600">anku</span>
          </div>
          {showSubtitle && (
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{subtitleText}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <div className="relative shrink-0 rounded-xl bg-gradient-to-br from-slate-50 to-white p-1.5 border border-slate-200/90 shadow-2xs">
        <BrandLogoIcon size={iconSize} />
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 leading-tight">
            <span>Sweping</span>
            <span className="text-teal-600 font-bold">anku</span>
          </div>
          {divisionBadge && divisionTheme && (
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${divisionTheme.badge}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: divisionTheme.hex }}
              />
              <span>{divisionBadge}</span>
            </span>
          )}
        </div>

        <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate flex items-center gap-1.5">
          <span>{subtitleText}</span>
          {divisionBadge && divisionTheme && (
            <span
              className={`sm:hidden inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold border ${divisionTheme.badge}`}
            >
              <span
                className="w-1 h-1 rounded-full shrink-0"
                style={{ backgroundColor: divisionTheme.hex }}
              />
              <span>{divisionBadge}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
