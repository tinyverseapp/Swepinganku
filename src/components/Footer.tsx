import { BrandLogoIcon } from './BrandLogo';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white border-t border-slate-200 mt-auto print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-14 sm:pb-5">
        {/* Left: Web Logo, Name, and Subtitle with safe-area padding for the floating team button */}
        <div className="flex items-center gap-3 min-w-0 max-w-xl sm:pl-48 md:pl-56 lg:pl-60 transition-all">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/90 p-1.5 flex items-center justify-center shadow-2xs shrink-0">
            <BrandLogoIcon className="w-full h-full" size={26} />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
              <span>Sweping</span>
              <span className="text-teal-600">anku</span>
            </div>
            <p className="text-xs text-slate-500 font-normal leading-relaxed mt-0.5">
              Website List &amp; Rekap Pasien Mingguan.
            </p>
          </div>
        </div>

        {/* Right: Creator Attribution & Copyright */}
        <div className="text-left md:text-right shrink-0">
          <div className="text-xs sm:text-sm text-slate-500">
            <span>Dibuat oleh </span>
            <span className="font-bold text-slate-900">M. Hafidzuddin Shofwan</span>
          </div>
          <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            © {currentYear} Swepinganku
          </div>
        </div>
      </div>
    </footer>
  );
}
