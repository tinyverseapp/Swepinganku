import { useState } from 'react';
import { Settings, X, KeyRound, ArrowRight, Palette, RotateCcw, Check, Sparkles } from 'lucide-react';
import { DivisionTeam } from '../types';
import { DIVISIONS } from '../data/constants';
import {
  COLOR_PALETTE,
  AVAILABLE_COLOR_KEYS,
  useDivisionColors,
  getDivisionColorTheme
} from '../utils/divisionColors';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTeam?: DivisionTeam;
  currentDivision?: string;
  onOpenTeamModal?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  activeTeam,
  currentDivision,
  onOpenTeamModal
}: SettingsModalProps) {
  const effectiveDivision = activeTeam?.division || currentDivision || DIVISIONS[0] || 'Bedah Digestif & Umum';
  const { colorMap, updateDivisionColor, resetColors } = useDivisionColors(effectiveDivision);
  const [selectedDivForPreview, setSelectedDivForPreview] = useState<string>(effectiveDivision);

  if (!isOpen) return null;

  const currentTheme = getDivisionColorTheme(selectedDivForPreview, colorMap);

  const handleColorSelect = (division: string, colorKey: string) => {
    updateDivisionColor(division, colorKey);
    setSelectedDivForPreview(division);
  };

  const handleResetAll = () => {
    resetColors();
    setSelectedDivForPreview(effectiveDivision);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Pengaturan Aplikasi</h3>
              <p className="text-xs text-slate-500">Warna identitas divisi &amp; konfigurasi tim</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
            aria-label="Tutup Pengaturan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Active Team Card */}
          {activeTeam?.teamCode && (
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 transition-all ${currentTheme.bannerBg}`}>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentTheme.hex }} />
                  <span>Tim Aktif Saat Ini</span>
                </div>
                <div className="text-sm font-extrabold text-slate-900 truncate mt-0.5">
                  {activeTeam.teamName || activeTeam.division}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${currentTheme.badge}`}>
                    {activeTeam.division}
                  </span>
                  <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-white border ${currentTheme.border} ${currentTheme.text}`}>
                    PIN: {activeTeam.teamCode}
                  </span>
                </div>
              </div>
              {onOpenTeamModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTeamModal();
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
                >
                  <span>Ganti Tim</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Section: Warna Identitas Divisi */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                  <Palette className="w-4 h-4 text-blue-600" />
                  <span>Warna Identitas Divisi</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Beri warna khusus pada setiap divisi stase bedah agar mudah dibedakan saat berganti-ganti tim.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetAll}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer shrink-0 transition-colors"
                title="Kembalikan semua warna ke default"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset ke Standar</span>
              </button>
            </div>

            {/* Live Preview Box */}
            <div className={`p-3 rounded-xl border transition-all ${currentTheme.bannerBg}`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Pratinjau Aksen: <b>{selectedDivForPreview}</b></span>
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentTheme.badge}`}>
                  {currentTheme.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-md ${currentTheme.bg} text-white flex items-center justify-center text-xs font-bold shadow-2xs`}>
                  {selectedDivForPreview.charAt(0)}
                </div>
                <span className="text-xs font-bold text-slate-800">
                  Bilah kontrol &amp; kartu pasien akan menggunakan aksen warna ini saat stase {selectedDivForPreview} aktif.
                </span>
              </div>
            </div>

            {/* Division List with Swatches */}
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white overflow-hidden shadow-2xs">
              {DIVISIONS.map((divName) => {
                const selectedKey = colorMap[divName] || 'blue';
                const divTheme = COLOR_PALETTE[selectedKey] || COLOR_PALETTE.blue;
                const isActive = divName === effectiveDivision;

                return (
                  <div
                    key={divName}
                    className={`p-3 sm:p-3.5 transition-colors ${
                      selectedDivForPreview === divName ? 'bg-slate-50/70' : 'hover:bg-slate-50/40'
                    }`}
                    onClick={() => setSelectedDivForPreview(divName)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="min-w-0 flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs border border-white"
                          style={{ backgroundColor: divTheme.hex }}
                        />
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {divName}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                            Aktif
                          </span>
                        )}
                      </div>

                      {/* Color Palette Swatches */}
                      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                        {AVAILABLE_COLOR_KEYS.map((cKey) => {
                          const opt = COLOR_PALETTE[cKey];
                          const isPicked = selectedKey === cKey;

                          return (
                            <button
                              key={cKey}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleColorSelect(divName, cKey);
                              }}
                              title={`${opt.name} untuk ${divName}`}
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer relative shadow-2xs ${
                                isPicked
                                  ? 'ring-2 ring-offset-2 ring-slate-700 scale-110'
                                  : 'hover:scale-115 opacity-85 hover:opacity-100'
                              }`}
                              style={{ backgroundColor: opt.hex }}
                            >
                              {isPicked && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Display Mode Info */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3 text-xs text-slate-700">
            <div className="font-bold mb-1 flex items-center gap-1.5 text-slate-800">
              <KeyRound className="w-3.5 h-3.5 text-blue-600" />
              <span>Penyimpanan Otomatis</span>
            </div>
            <div>
              Warna identitas divisi yang Anda atur disimpan secara lokal di perangkat Anda, sehingga langsung aktif setiap kali Anda masuk atau berpindah tim.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer transition-colors shadow-xs"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
