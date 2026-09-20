import { useState, useEffect, FormEvent } from 'react';
import { Patient } from '../types';
import {
  MASTER_ROOMS,
  PEDIATRIC_CONSULTANTS,
  isBedRoom,
  normalizeRoomName,
  formatKamarOrBed,
  getPatientHonorific,
  parseAgeInYears,
  formatPatientNameWithHonorific
} from '../data/constants';
import { calculateAgeFromDob, formatDateDMY } from '../utils/storage';
import { X, UserPlus, Save, Sparkles } from 'lucide-react';

interface PatientModalProps {
  isOpen: boolean;
  initialData: Patient | null;
  defaultDpjp: string;
  existingDpjps: string[];
  division?: string;
  divisionConsultants?: string[];
  activeDate?: string;
  onClose: () => void;
  onSave: (patient: Patient) => void;
}

export function PatientModal({
  isOpen,
  initialData,
  defaultDpjp,
  existingDpjps,
  division,
  divisionConsultants,
  activeDate,
  onClose,
  onSave
}: PatientModalProps) {
  const [dpjp, setDpjp] = useState('');
  const [doctorRole, setDoctorRole] = useState<Patient['doctorRole']>('DPJP');
  const [supervisingDpjp, setSupervisingDpjp] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('IGD');
  const [isCustomRoom, setIsCustomRoom] = useState(false);
  const [customRoomName, setCustomRoomName] = useState('');
  const [kamar, setKamar] = useState('');
  const [name, setName] = useState('');
  const [jk, setJk] = useState<'L' | 'P' | ''>('');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState('');
  const [rm, setRm] = useState('');
  const [dx, setDx] = useState('');
  const [presenceStatus, setPresenceStatus] = useState<Patient['presenceStatus']>('belum_periksa');
  const [weeklyStatus, setWeeklyStatus] = useState<Patient['weeklyStatus']>('baru');
  const [admissionDate, setAdmissionDate] = useState('');

  useEffect(() => {
    if (initialData) {
      setDpjp(initialData.dpjp || '');
      setDoctorRole(initialData.doctorRole || 'DPJP');
      setSupervisingDpjp(initialData.supervisingDpjp || '');
      setPresenceStatus(initialData.presenceStatus || 'belum_periksa');
      setWeeklyStatus(initialData.weeklyStatus || 'baru');
      setAdmissionDate(initialData.admissionDate || initialData.date || activeDate || '');
      const rawRoom = initialData.room || '';
      const normalized = normalizeRoomName(rawRoom);
      const isMaster = MASTER_ROOMS.some((r) => r.toLowerCase() === rawRoom.toLowerCase());
      if (isMaster) {
        setSelectedRoom(normalized);
        setIsCustomRoom(false);
        setCustomRoomName('');
      } else if (rawRoom) {
        setSelectedRoom('__CUSTOM__');
        setIsCustomRoom(true);
        setCustomRoomName(rawRoom);
      } else {
        setSelectedRoom('IGD');
        setIsCustomRoom(false);
        setCustomRoomName('');
      }
      setKamar(initialData.kamar || '');
      setName(initialData.name || '');
      setJk(initialData.jk || '');
      const patientDob = initialData.dob || '';
      setDob(patientDob);
      let patientAge = initialData.age || '';
      if (patientDob && (!patientAge || patientAge.trim() === '')) {
        patientAge = calculateAgeFromDob(patientDob, activeDate || undefined) || '';
      }
      setAge(patientAge);
      setRm(initialData.rm || '');
      setDx(initialData.dx || '');
    } else {
      setDpjp(defaultDpjp || '');
      setDoctorRole('DPJP');
      setSupervisingDpjp('');
      setSelectedRoom('IGD');
      setIsCustomRoom(false);
      setCustomRoomName('');
      setKamar('');
      setName('');
      setJk('');
      setDob('');
      setAge('');
      setRm('');
      setDx('');
      setPresenceStatus('belum_periksa');
      setWeeklyStatus('baru');
      setAdmissionDate(activeDate || '');
    }
  }, [initialData, defaultDpjp, isOpen, activeDate]);

  if (!isOpen) return null;

  const currentRoomName = isCustomRoom ? (customRoomName.trim() || 'Ruangan Khusus') : selectedRoom;
  const isCurrentBed = isBedRoom(currentRoomName);
  const needsSupervisingDpjp = doctorRole === 'RABER' || doctorRole === 'KONSUL';
  const supervisingDpjpOptions = Array.from(new Set([...(existingDpjps || []), ...PEDIATRIC_CONSULTANTS]));

  const handleDobChange = (val: string) => {
    setDob(val);
    if (val && val.trim()) {
      const calculated = calculateAgeFromDob(val.trim(), activeDate || undefined);
      if (calculated) {
        setAge(calculated);
      }
    }
  };

  const handleRoomSelectChange = (val: string) => {
    if (val === '__CUSTOM__') {
      setIsCustomRoom(true);
      setSelectedRoom('__CUSTOM__');
    } else {
      setIsCustomRoom(false);
      setSelectedRoom(val);
    }
  };

  const handleRoleChange = (role: Patient['doctorRole']) => {
    setDoctorRole(role);
    if (role === 'DPJP') setSupervisingDpjp('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rm.trim()) return;
    if (needsSupervisingDpjp && !supervisingDpjp.trim()) return;

    const finalRoom = isCustomRoom ? (customRoomName.trim() || 'Ruangan Khusus') : selectedRoom;
    const normalizedRoom = normalizeRoomName(finalRoom);
    let finalKamar = kamar.trim();
    if (finalKamar) finalKamar = formatKamarOrBed(normalizedRoom, finalKamar);

    const formattedName = formatPatientNameWithHonorific(name.trim(), age.trim(), jk);
    const patient: Patient = {
      id: initialData ? initialData.id : crypto.randomUUID(),
      dpjp: dpjp.trim() || 'dr. DPJP, Sp.B',
      doctorRole: doctorRole || 'DPJP',
      supervisingDpjp: needsSupervisingDpjp ? supervisingDpjp.trim() : undefined,
      room: normalizedRoom,
      kamar: finalKamar,
      name: formattedName,
      jk,
      dob: dob.trim() || undefined,
      age: age.trim(),
      rm: rm.trim(),
      dx: dx.trim(),
      updatedAt: new Date().toISOString(),
      presenceStatus,
      weeklyStatus,
      admissionDate: weeklyStatus === 'baru' ? (admissionDate || activeDate || initialData?.date || '') : ''
    };
    onSave(patient);
  };

  const autoHonorific = getPatientHonorific(age, jk);
  const parsedYears = parseAgeInYears(age);
  const previewName = name.trim() ? formatPatientNameWithHonorific(name, age, jk) : '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-200/60 flex items-center justify-center shrink-0"><UserPlus className="w-4 h-4" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">{initialData ? 'Edit Data Pasien' : 'Tambah Pasien Sweeping'}</h2>
              <p className="text-[11px] text-slate-500 line-clamp-1">Lengkapi identitas, pemilihan ruangan master, dan resume klinis</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Dokter Bedah &amp; Peran * </label>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <input type="text" required list="dpjpDatalist" value={dpjp} onChange={(e) => setDpjp(e.target.value)} placeholder="Contoh: dr. Andi Mohammad Ardan, Sp. BP-RE" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all" />
                <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 gap-1">
                  {([['DPJP', 'DPJP'], ['RABER', 'Raber'], ['KONSUL', 'Konsul']] as const).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => handleRoleChange(value)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${doctorRole === value ? 'bg-white text-teal-700 shadow-sm border border-teal-200' : 'text-slate-500 hover:text-slate-700'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Pilih peran dokter bedah pada pasien: <b>DPJP</b>, <b>Raber (rawat bersama)</b>, atau <b>Konsul</b>.</p>
              <datalist id="dpjpDatalist">{(existingDpjps || []).map((d) => <option key={d} value={d} />)}</datalist>
              {divisionConsultants && divisionConsultants.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-slate-500 font-medium">Konsulen {division}:</span>
                  {(divisionConsultants || []).map((c) => (
                    <button key={c} type="button" onClick={() => setDpjp(c)} className="text-[10px] bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-md px-1.5 py-0.5 font-semibold transition-colors cursor-pointer" title={`Pilih ${c}`}>+ {c.replace(/^dr\.\s*/i, '').split(',')[0]}</button>
                  ))}
                </div>
              )}

              {needsSupervisingDpjp && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                  <label className="block font-bold text-amber-900 mb-1">Nama Dokter DPJP *</label>
                  <input
                    type="text"
                    required
                    list="supervisingDpjpDatalist"
                    value={supervisingDpjp}
                    onChange={(e) => setSupervisingDpjp(e.target.value)}
                    placeholder="Pilih dokter DPJP, misalnya dokter anak atau dokter bedah"
                    className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />
                  <p className="text-[10px] text-amber-800 mt-1">Wajib diisi karena dokter di atas berperan sebagai <b>{doctorRole === 'RABER' ? 'Raber' : 'Konsul'}</b>, bukan DPJP utama pasien.</p>
                  <datalist id="supervisingDpjpDatalist">{supervisingDpjpOptions.map((d) => <option key={`supervising-${d}`} value={d} />)}</datalist>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-slate-600 font-semibold">Dokter Anak:</span>
                    {PEDIATRIC_CONSULTANTS.map((c) => (
                      <button key={`pediatric-${c}`} type="button" onClick={() => setSupervisingDpjp(c)} className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md px-1.5 py-0.5 font-semibold transition-colors cursor-pointer" title={`Pilih ${c} sebagai DPJP utama`}>+ {c.replace(/^dr\.\s*/i, '').split(',')[0]}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1"><label className="font-bold text-slate-700">Ruangan Rawat Inap *</label><span className="text-[10px] font-semibold text-slate-500">Master DB (19 Ruangan)</span></div>
              <select value={isCustomRoom ? '__CUSTOM__' : selectedRoom} onChange={(e) => handleRoomSelectChange(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer">
                <optgroup label="Master Database Ruangan (Urutan Tetap)">{MASTER_ROOMS.map((r) => <option key={r} value={r}>{r} {isBedRoom(r) ? '→ Format Bed' : ''}</option>)}</optgroup>
                <optgroup label="Pilihan Kasus Khusus"><option value="__CUSTOM__">+ Input Ruangan Kustom (Lainnya)...</option></optgroup>
              </select>
              {isCustomRoom && <div className="mt-1.5 animate-fadeIn"><input type="text" required value={customRoomName} onChange={(e) => setCustomRoomName(e.target.value)} placeholder="Ketik nama ruangan kustom..." className="w-full bg-white border border-teal-400 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20" autoFocus /><p className="text-[10px] text-slate-500 mt-0.5">Hanya gunakan untuk ruangan khusus yang belum terdaftar di master.</p></div>}
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1"><label className="font-bold text-slate-700">{isCurrentBed ? 'Nomor Bed *' : 'Nomor Kamar'}</label>{isCurrentBed ? <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200">Sistem Bed ({currentRoomName})</span> : <span className="text-[10px] text-slate-500">Kamar / Bed</span>}</div>
              <input type="text" value={kamar} onChange={(e) => setKamar(e.target.value)} placeholder={isCurrentBed ? 'Contoh: Bed 1, Bed 2, Bed 3' : 'Contoh: 2003 (otomatis menjadi K2003)'} className={`w-full border rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 transition-all ${isCurrentBed ? 'bg-purple-50/50 border-purple-300 focus:border-purple-500 focus:ring-purple-500/20 text-purple-950 font-medium' : 'bg-slate-50 border-slate-300 focus:border-teal-500 focus:ring-teal-500/20'}`} />
              {isCurrentBed ? <p className="text-[10px] text-purple-700 mt-1 font-medium">* Ruangan {currentRoomName} menggunakan format Bed (misal: "Bed 1").</p> : <p className="text-[10px] text-slate-400 mt-1">Nomor kamar atau bed tempat pasien dirawat.</p>}
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1"><label className="block font-bold text-slate-700">Nama Lengkap Pasien *</label><span className="text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md flex items-center gap-1"><Sparkles className="w-3 h-3" />Sapaan Otomatis: <b className="font-bold">{autoHonorific}</b></span></div>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Budi Santoso / Tn. Budi Santoso" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium" />
              {previewName && <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1"><span>Format tersimpan otomatis:</span><span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-xs">{previewName}</span></p>}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
              <div className="flex items-center gap-4 py-2">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium"><input type="radio" name="modal_jk" value="L" checked={jk === 'L'} onChange={() => setJk('L')} className="accent-teal-600" /><span>Laki-laki (L)</span></label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium"><input type="radio" name="modal_jk" value="P" checked={jk === 'P'} onChange={() => setJk('P')} className="accent-teal-600" /><span>Perempuan (P)</span></label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">Tanggal Lahir (DOB)</label>
                {dob && (
                  <span className="text-[10.5px] text-teal-700 font-semibold flex items-center gap-1 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/70">
                    ✓ Usia otomatis terhitung
                  </span>
                )}
              </div>
              <input
                type="date"
                value={dob}
                onChange={(e) => handleDobChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
              />
              <p className="text-[10px] text-slate-500 mt-1">Tanggal lahir pasien (usia otomatis terhitung langsung saat tanggal dipilih).</p>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">Usia Pasien</label>
                {dob && (
                  <span className="text-[10.5px] text-slate-500">
                    DOB: <span className="font-mono font-medium text-slate-700">{formatDateDMY(dob)}</span>
                  </span>
                )}
              </div>
              <input type="text" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Contoh: 15 hari / 8 bln / 14 th / 45 th" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all" />
              <p className="text-[10px] text-slate-500 mt-1">
                {autoHonorific ? (
                  autoHonorific === 'By.' ? (
                    <span className="text-emerald-700 font-medium">✓ Usia &lt; 1 bulan ({age}) → Otomatis <b>By.</b></span>
                  ) : autoHonorific === 'An.' ? (
                    <span className="text-amber-700 font-medium">✓ Usia 1 bln s.d. &lt; 18 th → Otomatis <b>An.</b></span>
                  ) : (
                    <span className="text-teal-700 font-medium">✓ Usia dewasa ({jk === 'L' ? 'L' : 'P'}) → Otomatis <b>{autoHonorific}</b></span>
                  )
                ) : (
                  <span>Ketik usia atau pilih Tanggal Lahir (DOB) untuk deteksi otomatis (misal: 10 hr → By., 14 th → An., 45 th → Tn./Ny.)</span>
                )}
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Nomor Rekam Medis (No. RM) *</label>
              <input type="text" required value={rm} onChange={(e) => setRm(e.target.value)} placeholder="00-88-21-45" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all" />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Diagnosis Klinis, Tindakan Operasi &amp; Catatan Khusus</label>
              <textarea rows={3} value={dx} onChange={(e) => setDx(e.target.value)} placeholder="Contoh: Post Appendectomy Laparoskopi H+1, drain minimal kemerahan, flatus (+), diet bubur halus..." className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all leading-relaxed" />
            </div>

            {/* Klasifikasi Status Pasien Mingguan & Tanggal Masuk */}
            <div className="sm:col-span-2 bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700">Status Pasien (Mingguan)</label>
                <span className="text-[10.5px] text-slate-500 font-medium">Badge Pasien Baru vs Pasien Lama</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setWeeklyStatus('baru');
                    if (!admissionDate) setAdmissionDate(activeDate || initialData?.date || '');
                  }}
                  className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    weeklyStatus === 'baru'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>Pasien Baru (Minggu Ini)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWeeklyStatus('lama')}
                  className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    weeklyStatus === 'lama'
                      ? 'bg-sky-50 border-sky-400 text-sky-800 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                  <span>Pasien Lama (Minggu Lalu)</span>
                </button>
              </div>

              {weeklyStatus === 'baru' ? (
                <div className="mt-2 pt-2 border-t border-slate-200/70">
                  <label className="block font-bold text-slate-700 mb-1">
                    Tanggal Masuk Pasien Baru *
                  </label>
                  <input
                    type="date"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                    className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    *Tanggal pertama kali pasien diinput atau mulai dirawat. Keterangan ini akan otomatis muncul pada kolom <b>Tanggal Masuk</b> di rekapan mingguan.
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 pt-0.5">
                  *Pasien bawaan dari minggu sebelumnya. Pada rekapan mingguan, kolom tanggal masuk akan ditandai (-).
                </p>
              )}
            </div>

            <div className="sm:col-span-2 bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700">Tanda Sweeping Pagi</label>
                <span className="text-[10.5px] text-slate-500 font-medium">Penanda visual saat sweeping ronde</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPresenceStatus('belum_periksa')}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    presenceStatus === 'belum_periksa'
                      ? 'bg-slate-200 border-slate-400 text-slate-800 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                  <span>Belum Dicek</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPresenceStatus('ada')}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    presenceStatus === 'ada'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>Masih Ada</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPresenceStatus('pulang')}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    presenceStatus === 'pulang'
                      ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span>Tanda Pulang</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight pt-0.5">
                *Status sweeping: Pasien baru atau operan hari baru otomatis berstatus <b>Belum Dicek</b>. Tandai Masih Ada saat visite/sweeping di ruangan, atau Tanda Pulang jika menunggu evaluasi residen.
              </p>
            </div>
          </div>

          <div className="pt-3.5 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0 bg-white">
            <button type="button" onClick={onClose} className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 active:bg-slate-100 transition-colors text-center cursor-pointer min-h-[42px]">Batal</button>
            <button type="submit" className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold transition-colors shadow-sm cursor-pointer min-h-[42px]"><Save className="w-4 h-4" /><span>Simpan Pasien</span></button>
          </div>
        </form>
      </div>
    </div>
  );
}