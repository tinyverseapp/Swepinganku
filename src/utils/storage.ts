import { Patient, WeeklyRow, RotationWeek, DivisionTeam } from '../types';
import {
  SAMPLE_PATIENTS,
  MASTER_ROOMS,
  DIVISIONS,
  DEFAULT_TEAM_CODES,
  getDefaultTeamCode,
  isBedRoom,
  normalizeRoomName,
  formatKamarOrBed,
  formatPatientNameWithHonorific,
  formatRoomDisplay
} from '../data/constants';

const KEY_PREFIX = 'sweepinganku';

export function getStorageKey(date: string, division: string, teamCode?: string): string {
  if (teamCode) return `${KEY_PREFIX}:team:${teamCode.trim().toUpperCase()}:${date}`;
  return `${KEY_PREFIX}:${date}:${division}`;
}

export function parseDateSafely(dateStr?: string | null): Date {
  if (!dateStr || typeof dateStr !== 'string') { const d = new Date(); d.setHours(0,0,0,0); return d; }
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
  const parts = clean.split('-');
  if (parts.length === 3) { const y=parseInt(parts[0],10), m=parseInt(parts[1],10)-1, d=parseInt(parts[2],10); if(!isNaN(y)&&!isNaN(m)&&!isNaN(d)&&y>1900&&m>=0&&m<=11&&d>=1&&d<=31) return new Date(y,m,d); }
  const fallback = new Date(clean); if(isNaN(fallback.getTime())) { const d=new Date(); d.setHours(0,0,0,0); return d; } return fallback;
}
export function formatDateIso(d: Date): string { if(!d||isNaN(d.getTime())) return today(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function today(): string { return formatDateIso(new Date()); }
export interface WeekDayInfo { dayName:'Senin'|'Selasa'|'Rabu'|'Kamis'|'Jumat'|'Sabtu'|'Minggu'; shortName:string; date:string; dayOfMonth:number; monthName:string; isToday:boolean; isSelected:boolean; }
export function getWeekDays(referenceDate:string, selectedDate:string):WeekDayInfo[]{ const d=parseDateSafely(referenceDate); const day=d.getDay(); const diffToMonday=day===0?-6:1-day; const monday=new Date(d.getFullYear(),d.getMonth(),d.getDate()+diffToMonday); const dayNames:Array<WeekDayInfo['dayName']>=['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu']; const shortNames=['Sen','Sel','Rab','Kam','Jum','Sab','Min']; const todayStr=today(); const selDate=selectedDate?formatDateIso(parseDateSafely(selectedDate)):todayStr; return dayNames.map((name,i)=>{const cur=new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+i); const dateStr=formatDateIso(cur); let monthName='Bln'; try{monthName=cur.toLocaleDateString('id-ID',{month:'short'});}catch{monthName=String(cur.getMonth()+1);} return {dayName:name,shortName:shortNames[i],date:dateStr,dayOfMonth:cur.getDate(),monthName,isToday:dateStr===todayStr,isSelected:dateStr===selDate};}); }
export function shiftDateByDays(dateStr:string,days:number):string{const d=parseDateSafely(dateStr);return formatDateIso(new Date(d.getFullYear(),d.getMonth(),d.getDate()+days));}
export function formatIndonesianDate(dateStr:string,options?:Intl.DateTimeFormatOptions):string{if(!dateStr)return '';try{return parseDateSafely(dateStr).toLocaleDateString('id-ID',options||{day:'2-digit',month:'long',year:'numeric'});}catch{return dateStr;}}
export function getDefaultTeam(division:string,koasName?:string):DivisionTeam{return {teamCode:getDefaultTeamCode(division),division,teamName:`Tim ${division}`,members:[koasName||'dr. Muda / Koas Bedah']};}
export function getActiveTeam(defaultDivision?:string,defaultKoasName?:string):DivisionTeam{const raw=localStorage.getItem(`${KEY_PREFIX}:activeTeam`);if(raw){try{const parsed=JSON.parse(raw);if(parsed&&parsed.teamCode){if(defaultDivision&&parsed.division!==defaultDivision){parsed.division=defaultDivision;if(!parsed.teamName||parsed.teamName.startsWith('Tim '))parsed.teamName=`Tim ${defaultDivision}`;localStorage.setItem(`${KEY_PREFIX}:activeTeam`,JSON.stringify(parsed));}return parsed;}}catch{}}const div=defaultDivision||'Bedah Digestif & Umum';const def=getDefaultTeam(div,defaultKoasName);localStorage.setItem(`${KEY_PREFIX}:activeTeam`,JSON.stringify(def));return def;}
export function setActiveTeam(team:DivisionTeam):void{localStorage.setItem(`${KEY_PREFIX}:activeTeam`,JSON.stringify(team));}
export function isRemovedDoctor(dpjp?:string):boolean{if(!dpjp)return false;const s=dpjp.toLowerCase();return /\bhendra\b/i.test(s)||/\bandi\s+w[\.,\s]/i.test(dpjp)||/\bandi\s+w$/i.test(dpjp);}
export function cleanRemovedDoctorsFromStorage():void{if(typeof window==='undefined'||!window.localStorage)return;try{const keys:string[]=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&(key.startsWith(KEY_PREFIX)||key.startsWith('sweeping:')))keys.push(key);}const ids=new Set(['p-1994648','p-02029139','p-02032640','p-02026511','p-02031900','p-02032317','p-02034100','p-02026268','p-02031580','p-02028071','p-01952560','p-01983979','p-02032635']);keys.forEach(k=>{const val=localStorage.getItem(k);if(!val)return;try{const parsed=JSON.parse(val);if(Array.isArray(parsed)){const cleaned=parsed.filter((p:any)=>!isRemovedDoctor(p?.dpjp)&&!ids.has(p?.id));if(cleaned.length!==parsed.length)localStorage.setItem(k,JSON.stringify(cleaned));}}catch{}});}catch{}}
if(typeof window!=='undefined')cleanRemovedDoctorsFromStorage();
export function loadPatients(date:string,division:string,teamCode?:string):Patient[]{const k=getStorageKey(date,division,teamCode);const raw=localStorage.getItem(k);if(raw){try{const list=JSON.parse(raw);if(Array.isArray(list)&&list.length>0){const filtered=list.filter((p:Patient)=>!isRemovedDoctor(p?.dpjp));if(filtered.length!==list.length)savePatients(date,division,filtered,teamCode);return filtered;}}catch{return []}}if(teamCode){const legacyKey=getStorageKey(date,division),legacyRaw=localStorage.getItem(legacyKey);if(legacyRaw){try{const legacyList=JSON.parse(legacyRaw);if(Array.isArray(legacyList)&&legacyList.length>0){const filtered=legacyList.filter((p:Patient)=>!isRemovedDoctor(p?.dpjp));savePatients(date,division,filtered,teamCode);return filtered;}}catch{}}}return []}
export function savePatients(date:string,division:string,patients:Patient[],teamCode?:string):void{const k=getStorageKey(date,division,teamCode);const normalized=(Array.isArray(patients)?patients:[]).map(p=>({...p,name:p.name?p.name.trim():''}));localStorage.setItem(k,JSON.stringify(normalized));if(teamCode)saveTeamPatientsServer(teamCode,date,normalized).catch(()=>{});}
export async function fetchTeamPatientsServer(teamCode:string,date:string):Promise<Patient[]|null>{try{const res=await fetch(`/api/teams/${encodeURIComponent(teamCode)}/patients?date=${encodeURIComponent(date)}`);if(!res.ok)return null;const data=await res.json();if(data&&Array.isArray(data.patients))return data.patients.map((p:Patient)=>({...p,name:formatPatientNameWithHonorific(p.name,p.age,p.jk)}));}catch{}return null;}
export async function saveTeamPatientsServer(teamCode:string,date:string,patients:Patient[],memberName?:string):Promise<boolean>{try{const res=await fetch(`/api/teams/${encodeURIComponent(teamCode)}/patients`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,patients,memberName})});return res.ok;}catch{return false;}}
export async function joinTeamServer(teamCode:string,division:string,teamName:string,memberName:string):Promise<DivisionTeam|null>{try{const res=await fetch('/api/teams/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({teamCode,division,teamName,memberName})});if(!res.ok)return null;const data=await res.json();return data.team||null;}catch{return null;}}
export async function fetchTeamInfoServer(teamCode:string):Promise<DivisionTeam|null>{try{const res=await fetch(`/api/teams/${encodeURIComponent(teamCode)}`);if(!res.ok)return null;const data=await res.json();return data||null;}catch{return null;}}
export async function handoverPatientsServer(teamCode:string,fromDate:string,toDate:string):Promise<{success:boolean;addedCount:number;patients:Patient[]}|null>{try{const res=await fetch(`/api/teams/${encodeURIComponent(teamCode)}/handover`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fromDate,toDate})});if(!res.ok)return null;return await res.json();}catch{return null;}}
export function handoverPatientsLocal(teamCode:string,division:string,fromDate:string,toDate:string):{addedCount:number;patients:Patient[]}{const sourcePatients=loadPatients(fromDate,division,teamCode),targetPatients=loadPatients(toDate,division,teamCode);let addedCount=0;const merged=[...targetPatients];for(const sp of sourcePatients){if(!merged.some(tp=>tp.rm===sp.rm)){merged.push({...sp,id:`handover-${Date.now()}-${Math.random().toString(36).substr(2,6)}`,updatedAt:new Date().toISOString()});addedCount++;}}savePatients(toDate,division,merged,teamCode);return {addedCount,patients:merged};}
export function getKoasName():string{return localStorage.getItem(`${KEY_PREFIX}:koasName`)||'dr. Muda / Koas Bedah';}
export function setKoasName(name:string):void{localStorage.setItem(`${KEY_PREFIX}:koasName`,name);}
export function getCompactMode():boolean{try{return localStorage.getItem(`${KEY_PREFIX}:compactMode`)==='true';}catch{return false;}}
export function setCompactMode(enabled:boolean):void{try{localStorage.setItem(`${KEY_PREFIX}:compactMode`,enabled?'true':'false');}catch{}}
export const saveKoasName=setKoasName;
export const loadCurrentTeam=(division?:string,koasName?:string)=>getActiveTeam(division,koasName);
export const saveCurrentTeam=setActiveTeam;
export function handoverYesterdayPatients(todayDate:string,division:string,_carryOverStatusOnly:boolean=true):{addedCount:number;patients:Patient[]}{return handoverPatientsLocal(getActiveTeam(division).teamCode,division,shiftDateByDays(todayDate,-1),todayDate);}

function roleLinesForPatient(p:Patient):string{
  const doctor=p.dpjp||'-';
  if(p.doctorRole==='RABER') return `\nDPJP: ${p.supervisingDpjp||'-'}\nRaber: ${doctor}`;
  if(p.doctorRole==='KONSUL') return `\nDPJP: ${p.supervisingDpjp||'-'}\nKonsul: ${doctor}`;
  return `\nDPJP: ${doctor}`;
}

function roleHeaderForPatients(patients:Patient[], fallback?:string):string{
  const roles=Array.from(new Set(patients.map(p=>p.doctorRole||'DPJP')));
  if(roles.length===1&&roles[0]==='RABER') return `*Raber: ${fallback||patients[0]?.dpjp||'-'}*`;
  if(roles.length===1&&roles[0]==='KONSUL') return `*Konsul: ${fallback||patients[0]?.dpjp||'-'}*`;
  return `*DPJP: ${fallback||patients[0]?.dpjp||'-'}*`;
}

export function generateReportText({mode,date,division,koasName,selectedDpjp,patients,allRooms}:{mode:'dpjp'|'all';date:string;division:string;koasName:string;selectedDpjp?:string;patients:Patient[];allRooms:string[]}):string{
  const d=parseDateSafely(date);let dayName=date;try{dayName=d.toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});}catch{}
  const header=`Selamat pagi, dokter. Mohon maaf mengganggu waktunya, dokter.\nPerkenalkan, dokter, saya ${koasName||'[Nama Koas]'} selaku dokter muda yang saat ini sedang menjalani stase bedah Divisi ${division}.\nMohon izin untuk melaporkan pasien dokter di ruangan rawat inap pada hari ini, dokter. 🙏🏻\n\n*${dayName}*`;
  const closing='\n\nMohon maaf jika terdapat kesalahan, dokter. Terima kasih, dokter. 🙏🏻';
  let filtered=patients;
  if(mode==='dpjp'){
    const target=selectedDpjp||(patients[0]?.dpjp||'[DPJP]');
    filtered=patients.filter(p=>p.dpjp===target);
    let out=`${header}\n${roleHeaderForPatients(filtered,target)}\n*Total pasien: ${filtered.length} pasien*\n`;
    out+=formatRoomsReport(filtered,false,allRooms); return out+closing;
  }
  return `${header}\n*Total pasien keseluruhan: ${filtered.length} pasien*\n${formatRoomsReport(filtered,true,allRooms)}${closing}`;
}

export function generateDocSweepingReportText({mode,date,division,koasName,selectedDpjp,patients,allRooms}:{mode:'dpjp'|'all';date:string;division:string;koasName:string;selectedDpjp?:string;patients:Patient[];allRooms:string[]}):string{
  const d=parseDateSafely(date);let dayName=date;try{dayName=d.toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});}catch{}
  const header=`Selamat pagi, dokter. Mohon maaf mengganggu waktunya, dokter. Perkenalkan, dokter, saya ${koasName||'[Nama Koas]'} selaku dokter muda yang saat ini sedang menjalani stase bedah Divisi ${division}. Mohon izin untuk melaporkan pasien dokter di ruangan rawat inap pada hari ini, dokter. 🙏🏻\n\n*${dayName}*`;
  const closing='\n\nMohon maaf jika terdapat kesalahan, dokter. Terima kasih, dokter. 🙏🏻';
  let filtered=patients;let targetHeader='';
  if(mode==='dpjp'){
    const target=selectedDpjp||(patients[0]?.dpjp||'[DPJP]');filtered=patients.filter(p=>p.dpjp===target);
    targetHeader=`\n${roleHeaderForPatients(filtered,target)}\n*Total pasien: ${filtered.length} pasien*\n`;
  }else targetHeader=`\n*Total pasien: ${filtered.length} pasien*\n`;
  const roomOrder=allRooms&&allRooms.length>0?allRooms:MASTER_ROOMS;
  const customRooms=[...new Set(filtered.map(p=>normalizeRoomName(p.room)))].filter(r=>!roomOrder.some(mr=>mr.toLowerCase()===r.toLowerCase()));
  const completeRooms=[...roomOrder,...customRooms];
  const body=completeRooms.map(r=>{const roomPatients=filtered.filter(p=>normalizeRoomName(p.room).toLowerCase()===r.toLowerCase());if(roomPatients.length===0)return `*${r.toUpperCase()} (0)*\n__________________\n`;const lines=roomPatients.map((p,i)=>{const bedOrKamar=formatKamarOrBed(p.room,p.kamar);const formattedName=formatPatientNameWithHonorific(p.name,p.age,p.jk);return `${i+1}. ${bedOrKamar} / ${formattedName} / ${p.jk||'-'} / ${p.age||'-'} / ${p.rm||'-'} / ${p.dx||'-'}${roleLinesForPatient(p)}`;}).join('\n');return `*${r.toUpperCase()} (${roomPatients.length})*\n${lines}\n`;}).join('\n');
  return `${header}${targetHeader}\n${body.trim()}${closing}`;
}

function formatRoomsReport(patients:Patient[],withDpjp:boolean,defaultRooms:string[]):string{
  const patientRooms=[...new Set(patients.map(p=>normalizeRoomName(p.room)))];const roomOrder=defaultRooms&&defaultRooms.length>0?defaultRooms:MASTER_ROOMS;
  const sortedRooms=[...roomOrder.filter(r=>patientRooms.some(pr=>pr.toLowerCase()===r.toLowerCase())),...patientRooms.filter(pr=>!roomOrder.some(r=>r.toLowerCase()===pr.toLowerCase())).sort()];
  if(sortedRooms.length===0)return '\n(Belum ada pasien yang terdaftar di ruangan rawat inap)';
  return sortedRooms.map(r=>{const roomPatients=patients.filter(p=>normalizeRoomName(p.room).toLowerCase()===r.toLowerCase());if(!roomPatients.length)return '';const lines=roomPatients.map((p,i)=>{const bedOrKamar=formatKamarOrBed(p.room,p.kamar);const formattedName=formatPatientNameWithHonorific(p.name,p.age,p.jk);return `${i+1}. ${bedOrKamar} / ${formattedName} / ${p.jk||'-'} / ${p.age||'-'} / ${p.rm||'-'} / ${p.dx||'-'}${roleLinesForPatient(p)}`;}).join('\n');return `\n*${r} (${roomPatients.length} pasien)*\n────────────────────\n${lines}`;}).filter(Boolean).join('\n');
}

export function getDatesBetween(startDate:string,endDate:string):string[]{const result:string[]=[];const current=parseDateSafely(startDate);const stop=parseDateSafely(endDate);let count=0;while(current<=stop&&count<60){result.push(formatDateIso(current));current.setDate(current.getDate()+1);count++;}return result;}
export function buildExcelCsvString(headers:string[],rows:(string|number)[][],delimiter:string=';'):string{const escapeCell=(val:string|number|undefined|null)=>{if(val===undefined||val===null)return '""';const s=String(val).replace(/\r\n/g,' ').replace(/[\r\n]/g,' ').trim();if(s.startsWith('="')&&s.endsWith('"'))return s;return `"${s.replace(/"/g,'""')}"`;};return `sep=${delimiter}\r\n${headers.map(escapeCell).join(delimiter)}\r\n${rows.map(r=>r.map(escapeCell).join(delimiter)).join('\r\n')}`;}
export function triggerCsvDownload(csvString:string,filename:string):void{const blob=new Blob(['\ufeff'+csvString],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();document.body.removeChild(link);URL.revokeObjectURL(url);}
export function normalizeRmKey(rm?:string|null):string{const clean=(rm||'').trim().replace(/[^a-zA-Z0-9]/g,'').toLowerCase();return clean.replace(/^0+/,'')||clean;}
export function getWeeklyPatientList(startDate:string,endDate:string,division:string,teamCode?:string):Patient[]{const dates=getDatesBetween(startDate,endDate);const patientMap=new Map<string,Patient>();dates.forEach(dt=>loadPatients(dt,division,teamCode).forEach(p=>{if(!p.rm||isRemovedDoctor(p?.dpjp))return;const key=normalizeRmKey(p.rm);if(!key)return;const existing=patientMap.get(key);if(!existing)patientMap.set(key,{...p,date:dt,division:p.division||division});else patientMap.set(key,{...existing,name:p.name||existing.name,jk:p.jk||existing.jk,age:p.age||existing.age,dx:p.dx||existing.dx,dpjp:p.dpjp||existing.dpjp,room:p.room||existing.room,kamar:p.kamar||existing.kamar,lastDate:dt});}));return Array.from(patientMap.values()).sort((a,b)=>(a.room||'').localeCompare(b.room||'')||(a.name||'').localeCompare(b.name||''));}
export function computeWeeklyRecap(startDate:string,endDate:string,division:string,teamCode?:string):{rows:WeeklyRow[];dates:string[]}{const dates=getDatesBetween(startDate,endDate);const map=new Map<string,WeeklyRow>();dates.forEach(dt=>loadPatients(dt,division,teamCode).forEach(p=>{if(!p.rm||isRemovedDoctor(p?.dpjp))return;const key=normalizeRmKey(p.rm);if(!key)return;let r=map.get(key);if(!r){r={rm:p.rm,name:formatPatientNameWithHonorific(p.name,p.age,p.jk),jk:p.jk||'-',age:p.age||'-',dpjp:p.dpjp,dx:p.dx||'',first:dt,last:dt,lastRoom:p.room,lastKamar:p.kamar||'',days:{}};map.set(key,r);}r.name=formatPatientNameWithHonorific(p.name,p.age,p.jk);r.jk=p.jk;r.age=p.age;r.dpjp=p.dpjp;r.dx=p.dx;r.last=dt;r.lastRoom=normalizeRoomName(p.room);r.lastKamar=p.kamar;const bedOrKamar=formatKamarOrBed(p.room,p.kamar);r.days[dt]=`${normalizeRoomName(p.room)} (${bedOrKamar})`;}));return {rows:[...map.values()].sort((a,b)=>a.name.localeCompare(b.name)),dates};}
export function exportPatientsCSV(patients:Patient[],division:string='Bedah',dateOrRange:string='',filenamePrefix:string='daftar-pasien-sweeping',delimiter:string=';'):void{if(!patients.length)return;const seen=new Set<string>();const unique=patients.filter(p=>{const key=normalizeRmKey(p.rm)||p.id||p.name;if(seen.has(key))return false;seen.add(key);return true;});if(!unique.length)return;const headers=['No','No. RM','Nama','JK','Usia','Diagnosis','DPJP','Ruangan'];const rows=unique.map((p,i)=>{const cleanName=(p.name||'').replace(/^(tn\.?|ny\.?|an\.?|by\.?|nn\.?|sdr\.?|sdri\.?|tuan|nyonya|anak|bayi)\s+/i,'').trim();const cleanRm=(p.rm||'').replace(/["=]/g,'').trim();const rmVal=cleanRm?(cleanRm.startsWith('0')?`="${cleanRm}"`:cleanRm):'-';const cleanAge=(p.age||'').replace(/\s*(th|tahun|yr|year)s?/i,'').trim();const jkVal=p.jk?(p.jk.toUpperCase().startsWith('L')?'L':p.jk.toUpperCase().startsWith('P')?'P':p.jk):'-';return [i+1,rmVal,cleanName||p.name||'-',jkVal,cleanAge||p.age||'-',p.dx||'-',p.dpjp||'-',formatRoomDisplay(p.room,p.kamar)];});triggerCsvDownload(buildExcelCsvString(headers,rows,delimiter),`${(filenamePrefix||'daftar-pasien-sweeping').replace(/\.csv$/,'')}.csv`);}
export function exportWeeklyCSV(rows:WeeklyRow[],dates:string[],division:string,startDate:string,endDate:string,delimiter:string=';'):void{if(!rows.length)return;const dayHeaders=dates.map(x=>{const d=parseDateSafely(x);try{return d.toLocaleDateString('id-ID',{weekday:'short',day:'2-digit',month:'2-digit'});}catch{return x;}});const headers=['No','No. RM','Nama Pasien','Jenis Kelamin','Usia','DPJP','Ruangan Terakhir','No. Kamar / Bed','Lokasi Lengkap','Diagnosis','Tgl Pertama Sweeping','Tgl Terakhir Sweeping',...dayHeaders];const dataRows=rows.map((r,i)=>[i+1,r.rm?`="${r.rm.replace(/"/g,'')}"`:'-',r.name,r.jk==='L'?'Laki-laki (L)':r.jk==='P'?'Perempuan (P)':r.jk,r.age,r.dpjp,normalizeRoomName(r.lastRoom),formatKamarOrBed(r.lastRoom,r.lastKamar),`${normalizeRoomName(r.lastRoom)} - ${formatKamarOrBed(r.lastRoom,r.lastKamar)}`,r.dx,r.first,r.last,...dates.map(d=>r.days[d]||'-')]);triggerCsvDownload(buildExcelCsvString(headers,dataRows,delimiter),`rekap-sweeping-matriks-${division.replace(/\s+/g,'-')}-${startDate}_${endDate}.csv`);}

const ROTATION_ROSTER_KEY=`${KEY_PREFIX}:rotation_roster`;
export function generateDefaultRotationRoster(refDate:string=today()):RotationWeek[]{const d=parseDateSafely(refDate),day=d.getDay(),diffToMonday=day===0?-6:1-day,currentMonday=new Date(d.getFullYear(),d.getMonth(),d.getDate()+diffToMonday),defaultDivs=['Bedah Digestif & Umum','Ortopedi','Urologi','Bedah Saraf','BTKV','Bedah Digestif & Umum','Bedah Anak','Bedah Onkologi','Bedah Plastik','Urologi'],week1Monday=new Date(currentMonday.getFullYear(),currentMonday.getMonth(),currentMonday.getDate()-5*7);const weeks:RotationWeek[]=[];for(let w=1;w<=10;w++){const wStart=new Date(week1Monday.getFullYear(),week1Monday.getMonth(),week1Monday.getDate()+(w-1)*7),wEnd=new Date(wStart.getFullYear(),wStart.getMonth(),wStart.getDate()+6);weeks.push({id:`rot-week-${w}`,weekNumber:w,division:defaultDivs[w-1]||'Bedah Digestif & Umum',startDate:formatDateIso(wStart),endDate:formatDateIso(wEnd),note:w===6?'Sedang berjalan (Minggu ke-6)':w>6?`Minggu ke-${w} stase bedah`:`Minggu ke-${w}`});}return weeks;}
export function loadRotationRoster():RotationWeek[]{try{const raw=localStorage.getItem(ROTATION_ROSTER_KEY);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed)&&parsed.length>0)return parsed;}}catch{}const initial=generateDefaultRotationRoster();saveRotationRoster(initial);return initial;}
export function saveRotationRoster(roster:RotationWeek[]):void{try{localStorage.setItem(ROTATION_ROSTER_KEY,JSON.stringify(roster));}catch{}}
export function findRotationWeekForDate(dateStr:string,roster:RotationWeek[]):RotationWeek|undefined{if(!dateStr||!roster?.length)return undefined;const exact=roster.find(w=>w.startDate&&w.endDate&&dateStr.trim()>=w.startDate.trim()&&dateStr.trim()<=w.endDate.trim());if(exact)return exact;try{const targetTime=new Date(dateStr).getTime();if(!isNaN(targetTime))return roster.find(w=>{if(!w.startDate||!w.endDate)return false;const s=new Date(w.startDate.trim()).getTime();const e=new Date(w.endDate.trim());e.setHours(23,59,59,999);return targetTime>=s&&targetTime<=e;});}catch{}return undefined;}
export function getInitialDivisionFromRotation(refDate:string=today()):string{try{const week=findRotationWeekForDate(refDate,loadRotationRoster());if(week?.division)return week.division;}catch{}return 'Bedah Digestif & Umum';}
