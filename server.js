/***** server.gs – SPREC v5.3.1 (Corrección de Router) *****/
const TZ = 'America/Santiago';
const SS = SpreadsheetApp.getActive();

// Hojas
const SHEET_CASES = 'Casos';
const SHEET_DATA  = 'Ingreso de datos';
const SHEET_RESP  = 'Responsables';
const SHEET_LOG   = 'Historial envíos';
const SHEET_URINE = 'Casos Orina';

// Reglas/Límites
const CASE_CODE_REGEX = /^\d{8}$/; // 8 dígitos exactos
const MAX_TUBES_PER_TYPE = 8;
const MAX_ALIQ_PER_TUBE  = 9;
//const MAX_COLLECTION_AGE_DAYS = 30;
const CENTRIF_MIN_GT = 10;
const CENTRIF_WARN_GT = 40;
const FUTURE_TOLERANCE_MINUTES = 5;

const HEAD_CASES = ['CodigoCaso','TiempoColeccionSangre','TiempoColeccionOrinaInit','Mes','nTubosEDTA','nTubosSERUM','nTubosURINE','Responsable','Creado'];
const HEAD_DATA = ['Mes','Codigo muestra Noraybank','Codigo de entrada','A. Tipo de muestra','B. Tipo de contenedor primario','Tiempo de colección','D. Primera Centrifugación','E. Segunda Centrifugación','G.1 Tiempo de inicio de almacenamiento a largo plazo','Estado de control','(fecha digitación)','(obs digitación)','(revisor)','(fecha revisión)','(obs revisión)','(estado final)'];
const HEAD_LOG = ['Fecha envío','Responsable (digitación)','Email usuario','Casos','Total filas generadas','D.1 (lote)','E.1 (lote)','G.1 (EDTA/Serum)','G.1 (Orina)','UBC habilitado','UBC por caso (JSON)','Productos (resumen JSON)','Observaciones','ID de envío','Tipo de envío'];

/* =========== Utils =========== */
const _HEAD_CACHE_ = {};
function headMap_(sh){
  const name = sh.getName(); const cols = sh.getLastColumn(); const key = `${name}::${cols}`;
  if (_HEAD_CACHE_[key]) return _HEAD_CACHE_[key];
  const h = sh.getRange(1,1,1,cols).getValues()[0];
  const m={}; h.forEach((v,i)=> m[v]=i+1);
  _HEAD_CACHE_[key] = m;
  return m;
}
function ensureCases(){
  const sh = SS.getSheetByName(SHEET_CASES) || SS.insertSheet(SHEET_CASES);
  if (sh.getLastRow()===0){ sh.appendRow(HEAD_CASES); sh.setFrozenRows(1); }
  const map = headMap_(sh);
  sh.getRange('A:A').setNumberFormat('@');
  if (map.TiempoColeccionSangre)     sh.getRange(2,map.TiempoColeccionSangre,sh.getMaxRows()-1,1).setNumberFormat('yyyy-mm-dd hh:mm');
  if (map.TiempoColeccionOrinaInit)  sh.getRange(2,map.TiempoColeccionOrinaInit,sh.getMaxRows()-1,1).setNumberFormat('yyyy-mm-dd hh:mm');
  if (map.Creado)                    sh.getRange(2,map.Creado,sh.getMaxRows()-1,1).setNumberFormat('dd/mm/yyyy hh:mm');
  return sh;
}
function ensureData(){
  const sh = SS.getSheetByName(SHEET_DATA) || SS.insertSheet(SHEET_DATA);
  if (sh.getLastRow()===0){ sh.appendRow(HEAD_DATA); sh.setFrozenRows(1); }
  sh.getRange('B:B').setNumberFormat('@'); return sh;
}
function ensureUrine(){
  const sh = SS.getSheetByName(SHEET_URINE) || SS.insertSheet(SHEET_URINE);
  if (sh.getLastRow()===0){ sh.getRange(1,1,1,3).setValues([['CodigoCaso','Tubo','TiempoColeccionOrina']]); sh.setFrozenRows(1); }
  sh.getRange('A:A').setNumberFormat('@'); sh.getRange('B:B').setNumberFormat('0'); sh.getRange('C:C').setNumberFormat('yyyy-mm-dd hh:mm');
  return sh;
}
function ensureLog(){
  const sh = SS.getSheetByName(SHEET_LOG) || SS.insertSheet(SHEET_LOG);
  if (sh.getLastRow()===0){ sh.appendRow(HEAD_LOG); sh.setFrozenRows(1); }
  sh.getRange('A:A').setNumberFormat('dd/mm/yyyy hh:mm'); sh.getRange('D:D').setNumberFormat('@'); sh.getRange('I:I').setNumberFormat('dd/mm/yyyy hh:mm');
  sh.getRange('N:N').setNumberFormat('@'); sh.getRange('O:O').setNumberFormat('@');
  return sh;
}
function fmtLocal(d){ return d ? Utilities.formatDate(new Date(d), TZ, 'dd-MM-yy HH:mm') : ''; }
function monthEs(d){ const M=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']; const x=new Date(d); return M[x.getMonth()]; }
function minutesDiff_(a,b){ return (a-b)/(1000*60); }
function isFutureBeyondTolerance_(dt, now){
  return minutesDiff_(dt, now) > FUTURE_TOLERANCE_MINUTES;
}
function ok(d){ return ContentService.createTextOutput(JSON.stringify({ok:true,data:d})).setMimeType(ContentService.MimeType.JSON); }
function err(m){ return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(m)})).setMimeType(ContentService.MimeType.JSON); }
function lastDataRowByColumns_(sh, columns){
  const maxRows = sh.getMaxRows();
  let last = 1;
  columns.forEach(col=>{
    if (!col) return;
    const values = sh.getRange(1, col, maxRows, 1).getDisplayValues();
    for (let i = values.length - 1; i >= 0; i--){
      if (String(values[i][0] || '').trim() !== ''){
        last = Math.max(last, i + 1);
        break;
      }
    }
  });
  return last;
}
function nextDataRow_(sh, columns){
  return lastDataRowByColumns_(sh, columns) + 1;
}
function respName_(email){
  const sh = SS.getSheetByName(SHEET_RESP); if(!sh) return email||'';
  const last = sh.getLastRow(); if (last<2) return email||'';
  const vals = sh.getRange(2,1,last-1,2).getValues();
  const f = vals.find(r=> String(r[0]).trim().toLowerCase() === String(email||'').trim().toLowerCase());
  return f ? (f[1]||email) : (email||'');
}
function findCaseRow_(code){
  const sh = ensureCases(); const map = headMap_(sh);
  const last = sh.getLastRow(); if (last<2) return {row:-1,sh,map};
  const col = map.CodigoCaso;
  const vals = sh.getRange(2,col,last-1,1).getValues().flat();
  const i = vals.findIndex(v=> String(v)===String(code));
  return {row: i<0? -1 : i+2, sh, map};
}
function makeEnvId_(){ const n=new Date(), p=n=>String(n).padStart(2,'0'); return `ENV-${n.getFullYear()}${p(n.getMonth()+1)}${p(n.getDate())}-${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}-${Math.random().toString(36).slice(2,5)}`; }
function parseLocalISO_(str){ if(!str) return null; const d = new Date(str); return isNaN(d.getTime()) ? null : d; }

/* =========== Router =========== */
function doGet(e){
  const a = e?.parameter?.action||'';
  try{
    // ANOTACIÓN: La función 'checkCaseExists' no existe en la v5.2, la mantengo por si la usas en el futuro.
    if(a==='checkCaseExists')      return checkCaseExists_(e.parameter.code);
    if(a==='listCasesAndStatus')   return listCasesAndStatus_();
    if(a==='listHistory')          return listHistory_(Number(e?.parameter?.limit||12));
    if(a==='me')                   return me_();
    return HtmlService.createHtmlOutputFromFile('index').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }catch(ex){ return err(ex.message||ex); }
}

function doPost(e){
  try{
    const p = e.postData?.contents ? JSON.parse(e.postData.contents) : {};
    // ANOTACIÓN: Se restauran las rutas eliminadas por error. Esta es la corrección principal.
    if(p.action==='createOrUpdateCase') return createOrUpdateCase_(p);
    if(p.action==='generateRows2')      return generateRows2_(p);
    if(p.action==='discardUrine')       return discardUrine_(p);
    if(p.action==='discardBlood')       return discardBlood_(p);
    if(p.action==='checkCaseExists')    return checkCaseExists_(p.caseCode);
    if(p.action==='listCasesAndStatus') return listCasesAndStatus_();
    if(p.action==='listHistory')        return listHistory_(Number(p?.limit||12));
    if(p.action==='listStatus')         return listStatus_(); // Restaurada
    if(p.action==='saveUrineTimes')     return saveUrineTimes_(p); // Restaurada por completitud
    return err('Acción no soportada');
  }catch(ex){ return err(ex.message||ex); }
}

/* =========== API Core (sin cambios respecto a la v5.3) =========== */

function _getCaseObjects(){
  const sh = ensureCases(); const map = headMap_(sh);
  const arr = sh.getDataRange().getValues(); arr.shift();
  const out = arr.filter(r=>r[map.CodigoCaso-1]).map(r=>({
    codigoCaso: String(r[map.CodigoCaso-1]),
    tColSangre: r[map.TiempoColeccionSangre-1] ? fmtLocal(r[map.TiempoColeccionSangre-1]) : '',
    tColOrina0: r[map.TiempoColeccionOrinaInit-1] ? fmtLocal(r[map.TiempoColeccionOrinaInit-1]) : '',
    mes: r[map.Mes-1] || '',
    nTubosEDTA: Number(r[map.nTubosEDTA-1]||0),
    nTubosSERUM: Number(r[map.nTubosSERUM-1]||0),
    nTubosURINE: Number(r[map.nTubosURINE-1]||0),
    responsableEtapa1: r[map.Responsable-1] || '',
    creado: r[map.Creado-1] ? fmtLocal(r[map.Creado-1]) : ''
  }));
  out.sort((a,b)=> (b.creado||'').localeCompare(a.creado||''));
  return out;
}
function _getStatusMap(cases){
  const proc = readProcessedTypes_();
  const shU = ensureUrine(); const last = shU.getLastRow();
  const urineTimes = {};
  if(last>=2){
    const vals = shU.getRange(2,1,last-1,3).getValues();
    vals.forEach(r=>{
      const cc=String(r[0]||''); const t=Number(r[1]||0); const dt=r[2]?fmtLocal(r[2]):'';
      if(!urineTimes[cc]) urineTimes[cc] = {}; urineTimes[cc][t]=dt;
    });
  }
  const status = {};
  cases.forEach(c=>{
    const p = proc[c.codigoCaso] || {plasma:false, serum:false, urine:false};
    const pendingBlood = ( (c.nTubosEDTA>0 && !p.plasma) || (c.nTubosSERUM>0 && !p.serum) );
    const pendingUrine = ( c.nTubosURINE>0 && !p.urine );
    status[c.codigoCaso] = {processed:p, pendingBlood, pendingUrine, nEDTA:c.nTubosEDTA, nSER:c.nTubosSERUM, nURI:c.nTubosURINE};
  });
  return status;
}
function readProcessedTypes_(){
  const cache = CacheService.getDocumentCache();
  const cached = cache.get('processed_types_v1');
  if (cached){ try { return JSON.parse(cached); } catch(_) {} }
  const sh = ensureData(); const last = sh.getLastRow(); const map = {};
  if(last>=2){
    const vals = sh.getRange(2,1,last-1,5).getValues();
    vals.forEach(r=>{
      const codeSample = String(r[1]||''); if(!codeSample) return;
      const tipo = String(r[3]||'').toLowerCase();
      const caseCode = codeSample.substring(0,8);
      if(!map[caseCode]) map[caseCode] = {plasma:false, serum:false, urine:false};
      if(tipo.includes('plasma')) map[caseCode].plasma = true;
      else if(tipo.includes('serum')) map[caseCode].serum = true;
      else if(tipo.includes('urine')) map[caseCode].urine = true;
    });
  }
  cache.put('processed_types_v1', JSON.stringify(map), 120);
  return map;
}

function checkCaseExists_(code){
  if (!code || !CASE_CODE_REGEX.test(code)) return ok({ exists: false, message: 'Código inválido' });
  const q = findCaseRow_(code);
  return ok({ exists: q.row > -1 });
}
function listCasesAndStatus_(){
  const cases = _getCaseObjects();
  const status = _getStatusMap(cases);
  return ok({cases, status});
}
function listStatus_(){
    const cases = _getCaseObjects();
    const status = _getStatusMap(cases);
    return ok(status);
}
function me_(){
  const email = Session.getActiveUser().getEmail()||'';
  return ok({email, name: respName_(email)});
}
function createOrUpdateCase_(p){
  const code = String(p.caseCode||'').trim();
  if(!CASE_CODE_REGEX.test(code)) return err('El código debe tener 8 dígitos.');
  const selEDTA = !!p.selEDTA, selSER=!!p.selSER, selURI=!!p.selURI;
  if(!selEDTA && !selSER && !selURI) return err('Selecciona al menos un tipo.');
  const now = new Date();
  const email = Session.getActiveUser().getEmail()||'';
  const responsable = respName_(email);
  const tColS = (selEDTA||selSER) ? parseLocalISO_(p.collectionISO_sangre) : null;
  const tColU = (selURI) ? parseLocalISO_(p.collectionISO_orina) : null;
  function validateCol(dt,label){
    if(!dt || isNaN(dt.getTime())) throw new Error(`Falta o es inválido el tiempo de colección (${label}).`);
    if(isFutureBeyondTolerance_(dt, now)) throw new Error(`El tiempo de colección (${label}) no puede ser futuro.`);
    //if((now - dt) > MAX_COLLECTION_AGE_DAYS*24*60*60*1000) throw new Error(`El tiempo de colección (${label}) no puede tener más de $///{MAX_COLLECTION_AGE_DAYS} días.`);
  }
  if (selEDTA||selSER) validateCol(tColS,'sangre');
  if (selURI)          validateCol(tColU,'orina');
  const nE = selEDTA ? Number(p.tubesEDTA||0) : null;
  const nS = selSER  ? Number(p.tubesSerum||0) : null;
  const nU = selURI  ? Number(p.tubesUrine||0) : null;
  const checkInt = (v,lab)=>{ if(v===null) return; if(!Number.isInteger(v)||v<0||v>MAX_TUBES_PER_TYPE) throw new Error(`${lab}: 0–${MAX_TUBES_PER_TYPE}`); };
  checkInt(nE,'# EDTA'); checkInt(nS,'# Serum'); checkInt(nU,'# Orina');
  if((selEDTA||selSER) && ((nE||0)+(nS||0)===0)) throw new Error('Ingresa tubos de EDTA y/o Serum.');
  if(selURI && (nU||0)===0) throw new Error('Ingresa tubos de Orina.');
  const sh = ensureCases(); const map = headMap_(sh);
  const q = findCaseRow_(code);
  if (q.row<0){
    const row = [];
    row[map.CodigoCaso-1] = code;
    row[map.TiempoColeccionSangre-1]    = tColS||'';
    row[map.TiempoColeccionOrinaInit-1] = tColU||'';
    row[map.Mes-1] = monthEs((tColS||tColU));
    row[map.nTubosEDTA-1] = (nE===null?0:nE);
    row[map.nTubosSERUM-1]= (nS===null?0:nS);
    row[map.nTubosURINE-1]= (nU===null?0:nU);
    row[map.Responsable-1]= responsable;
    row[map.Creado-1] = new Date();
    const targetRow = nextDataRow_(sh, [map.CodigoCaso]);
    sh.getRange(targetRow,1,1,HEAD_CASES.length).setValues([row]);
    sh.getRange(targetRow, map.CodigoCaso).setNumberFormat('@');
  } else {
    if (selEDTA||selSER){
      sh.getRange(q.row, map.TiempoColeccionSangre).setValue(tColS);
      if (nE!==null) sh.getRange(q.row, map.nTubosEDTA).setValue(nE);
      if (nS!==null) sh.getRange(q.row, map.nTubosSERUM).setValue(nS);
      sh.getRange(q.row, map.Mes).setValue(monthEs(tColS));
    }
    if (selURI){
      sh.getRange(q.row, map.TiempoColeccionOrinaInit).setValue(tColU);
      if (nU!==null) sh.getRange(q.row, map.nTubosURINE).setValue(nU);
      const mesCell = sh.getRange(q.row, map.Mes).getValue();
      if (!mesCell) sh.getRange(q.row, map.Mes).setValue(monthEs(tColU));
    }
    sh.getRange(q.row, map.Responsable).setValue(responsable);
  }
  return ok({caseCode:code, responsable});
}
function saveUrineTimes_(p){
  const code = String(p.caseCode||'').trim();
  if(!CASE_CODE_REGEX.test(code)) return err('Código inválido.');
  const q = findCaseRow_(code); if(q.row<0) return err('El caso no existe.');
  const nU = Number(q.sh.getRange(q.row, q.map.nTubosURINE).getValue()||0);
  if(nU<=0) return err('Este caso no tiene tubos de orina.');

  const tmap = p.urineTimes||{}; if(!tmap || typeof tmap!=='object') return err('Sin datos de orina.');
  const now = new Date();
  const shU = ensureUrine();

  const colA = shU.getRange('A:A');
  const ranges = colA.createTextFinder(code).matchEntireCell(true).findAll() || [];
  for (let i = ranges.length - 1; i >= 0; i--) {
    const row = ranges[i].getRow();
    if (row > 1) shU.deleteRow(row);
  }

  const ins=[];
  Object.keys(tmap).forEach(k=>{
    const tn=Number(k); const dt=parseLocalISO_(tmap[k]);
    if(!Number.isInteger(tn)||tn<1||tn>nU) return;
    if(!dt || isNaN(dt.getTime()) || isFutureBeyondTolerance_(dt, now)) return;
    ins.push([code, tn, dt]);
  });
  if(ins.length) shU.getRange(nextDataRow_(shU, [1,2,3]),1,ins.length,3).setValues(ins);

  return ok({saved:ins.length});
}
function generateRows2_(p){
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const kind = String(p.kind||'').toLowerCase();
    const list = Array.isArray(p.cases)?p.cases:[];
    if(!['blood','urine'].includes(kind)) return err('kind inválido.');
    if(!list.length) return err('Faltan casos.');
    if(list.length>4) return err('Máximo 4 casos por lote.');
    const M = { plasma: { m:'M16', cont:'Potassium EDTA', label:'Plasma, double spun' }, serum:  { m:'M26', cont:'Serum tube without clot activator', label:'Serum' }, urine:  { m:'M13', cont:'Polypropylene tube sterile',       label:'Urine, random (spot)' } };
    const UBC = { m:'M03', cont:'Potassium EDTA', label:'Unficolled buffy coat, non viable' };
    const email = Session.getActiveUser().getEmail()||'';
    const resp  = respName_(email);
    const now   = new Date();
    const d1ISO    = p.d1StartISO ? parseLocalISO_(p.d1StartISO) : null;
    const e1ISO    = p.e1StartISO ? parseLocalISO_(p.e1StartISO) : null;
    const g1SerISO = p.g1StartISO ? parseLocalISO_(p.g1StartISO) : null;
    const g1UriISO = p.g1UrineISO ? parseLocalISO_(p.g1UrineISO) : null;
    const obs = p.notes||'';
    if (kind==='blood'){
      if(!d1ISO || !e1ISO || !g1SerISO) return err('D.1, E.1 y G.1 (EDTA/Serum) son obligatorios.');
      if([d1ISO, e1ISO, g1SerISO].some(dt=>isFutureBeyondTolerance_(dt, now))) return err('Fechas de sangre no pueden ser futuras.');
      if(!(minutesDiff_(e1ISO,d1ISO) > CENTRIF_MIN_GT)) return err(`E.1 − D.1 debe ser > ${CENTRIF_MIN_GT} min.`);
    } else {
      if(!g1UriISO) return err('G.1 (Orina) es obligatorio.');
      if(isFutureBeyondTolerance_(g1UriISO, now)) return err('G.1 (Orina) no puede ser futuro.');
    }
    const shC = ensureCases(); const mapC = headMap_(shC);
    const shD = ensureData();  const shU = ensureUrine();
    const processed = readProcessedTypes_();
    let warning = '';
    if (kind==='blood' && minutesDiff_(e1ISO,d1ISO) > CENTRIF_WARN_GT){ warning = 'Menos cháchara y acorte los tiempos (E.1 supera 40 min desde D.1).'; }
    const rowsOut = [];
    const ubcPerCase = {};
    const productsSummary = {};
    list.forEach(caseData =>{
      const code = String(caseData.caseCode||'').trim(); if(!CASE_CODE_REGEX.test(code)) throw new Error('Código inválido');
      const q = findCaseRow_(code); if(q.row<0) throw new Error(`Caso ${code} no existe.`);
      const row = shC.getRange(q.row,1,1,shC.getLastColumn()).getValues()[0];
      const mes   = row[mapC.Mes-1] || '';
      const tColS = row[mapC.TiempoColeccionSangre-1] || null;
      const tColU0= row[mapC.TiempoColeccionOrinaInit-1] || null;
      const nE = Number(row[mapC.nTubosEDTA-1]||0);
      const nS = Number(row[mapC.nTubosSERUM-1]||0);
      const nU = Number(row[mapC.nTubosURINE-1]||0);
      productsSummary[code] = {plasma:{}, serum:{}, urine:{}};
      ubcPerCase[code] = [];
      const proc = processed[code] || {plasma:false, serum:false, urine:false};
      if (kind==='blood'){
        if(!tColS) throw new Error(`Falta tiempo de colección (sangre) en caso ${code}.`);
        if(!(tColS < d1ISO))    throw new Error(`Colección (sangre) debe ser < D.1 (caso ${code}).`);
        if(!(d1ISO < e1ISO))    throw new Error(`D.1 < E.1 (caso ${code}).`);
        if(!(e1ISO < g1SerISO)) throw new Error(`E.1 < G.1 (caso ${code}).`);
        const products = Array.isArray(caseData.products)?caseData.products:[];
        const hasPlasma = products.some(x=>x.type==='plasma' && (x.tubes||[]).length);
        const hasSerum  = products.some(x=>x.type==='serum'  && (x.tubes||[]).length);
        const ubcTubes  = Array.isArray(caseData.ubcTubes)? Array.from(new Set(caseData.ubcTubes.map(Number))) : [];
        if(!hasPlasma && !hasSerum && !ubcTubes.length) throw new Error(`Sin alícuotas/UBC (caso ${code}).`);
        if(proc.plasma && hasPlasma) throw new Error(`Caso ${code} ya procesó Plasma.`);
        if(proc.serum  && hasSerum)  throw new Error(`Caso ${code} ya procesó Serum.`);
        products.filter(x=>x.type==='plasma').forEach(px=>{
          (px.tubes||[]).forEach(t=>{
            const tn=Number(t.tube||0), nAli=Number(t.aliquots||0);
            if(!Number.isInteger(tn)||tn<1||tn>nE) throw new Error(`Tubo EDTA ${tn} inválido (${code}).`);
            if(!Number.isInteger(nAli)||nAli<0||nAli>MAX_ALIQ_PER_TUBE) throw new Error(`Alícuotas inválidas (Plasma, tubo ${tn}, ${code}).`);
            if (!productsSummary[code].plasma[tn]) productsSummary[code].plasma[tn]=0;
            productsSummary[code].plasma[tn]+=nAli;
            for(let a=1;a<=nAli;a++){ rowsOut.push([ mes, `${code}${M.plasma.m}${tn}.${a}`,'', M.plasma.label, M.plasma.cont, fmtLocal(tColS), fmtLocal(d1ISO), fmtLocal(e1ISO), fmtLocal(g1SerISO), resp, new Date(), obs,'','','','' ]); }
          });
        });
        products.filter(x=>x.type==='serum').forEach(px=>{
          (px.tubes||[]).forEach(t=>{
            const tn=Number(t.tube||0), nAli=Number(t.aliquots||0);
            if(!Number.isInteger(tn)||tn<1||tn>nS) throw new Error(`Tubo Serum ${tn} inválido (${code}).`);
            if(!Number.isInteger(nAli)||nAli<0||nAli>MAX_ALIQ_PER_TUBE) throw new Error(`Alícuotas inválidas (Serum, tubo ${tn}, ${code}).`);
            if (!productsSummary[code].serum[tn]) productsSummary[code].serum[tn]=0;
            productsSummary[code].serum[tn]+=nAli;
            for(let a=1;a<=nAli;a++){ rowsOut.push([ mes, `${code}${M.serum.m}${tn}.${a}`,'', M.serum.label, M.serum.cont, fmtLocal(tColS), 'NA', 'NA', fmtLocal(g1SerISO), resp, new Date(), obs,'','','','' ]); }
          });
        });
        if(ubcTubes.length){
          ubcTubes.forEach(tn=>{
            if(!Number.isInteger(tn)||tn<1||tn>nE) throw new Error(`UBC: tubo EDTA ${tn} inválido (${code}).`);
            rowsOut.push([ mes, `${code}${UBC.m}${tn}`,'', UBC.label, UBC.cont, fmtLocal(tColS), fmtLocal(d1ISO), fmtLocal(e1ISO), fmtLocal(g1SerISO), resp, new Date(), obs,'','','','' ]);
          });
          ubcPerCase[code] = ubcTubes.slice();
        }
      } else {
        if (proc.urine) throw new Error(`Caso ${code} ya procesó Orina.`);
        if (nU<=0) throw new Error(`Caso ${code} no tiene tubos de orina.`);
        const times = {};
        if (shU.getLastRow()>=2){ shU.getRange(2,1,shU.getLastRow()-1,3).getValues().forEach(r=>{ if(String(r[0])===code) times[Number(r[1])] = new Date(r[2]); }); }
        const urine = Array.isArray(caseData.urine)?caseData.urine:[];
        if(!urine.length) throw new Error(`Sin alícuotas de orina para ${code}.`);
        urine.forEach(t=>{
          const tn=Number(t.tube||0), nAli=Number(t.aliquots||0);
          if(!Number.isInteger(tn)||tn<1||tn>nU) throw new Error(`Tubo Orina ${tn} inválido (${code}).`);
          const tColU = times[tn] || tColU0;
          if(!tColU || isNaN(new Date(tColU).getTime())) { throw new Error(`Falta tiempo de colección de orina para el tubo ${tn} del caso ${code}.`); }
          if(!(new Date(tColU) < g1UriISO)) throw new Error(`Colección (Orina, tubo ${tn}) debe ser < G.1 (Orina) (${code}).`);
          if(!Number.isInteger(nAli)||nAli<0||nAli>MAX_ALIQ_PER_TUBE) throw new Error(`Alícuotas inválidas (Orina, tubo ${tn}, ${code}).`);
          if (!productsSummary[code].urine[tn]) productsSummary[code].urine[tn]=0;
          productsSummary[code].urine[tn]+=nAli;
          for(let a=1;a<=nAli;a++){ rowsOut.push([ mes, `${code}${M.urine.m}${tn}.${a}`,'', M.urine.label, M.urine.cont, fmtLocal(tColU), 'NA','NA', fmtLocal(g1UriISO), resp, new Date(), obs,'','','','' ]); }
        });
      }
    });
    if(!rowsOut.length) return err('No hay filas para generar.');
    shD.getRange(nextDataRow_(shD, [2]),1,rowsOut.length,rowsOut[0].length).setValues(rowsOut);
    CacheService.getDocumentCache().remove('processed_types_v1');
    const envioId = makeEnvId_();
    const log = [ new Date(), resp, email, list.map(x=>x.caseCode).join(', '), rowsOut.length, d1ISO ? fmtLocal(d1ISO) : '', e1ISO ? fmtLocal(e1ISO) : '', g1SerISO ? fmtLocal(g1SerISO) : '', g1UriISO ? fmtLocal(g1UriISO) : '', Object.values(ubcPerCase).some(a=>a && a.length) ? 'sí' : 'no', JSON.stringify(ubcPerCase), JSON.stringify(productsSummary), obs, envioId, (kind==='urine'?'urine':'blood') ];
    const shL = ensureLog();
    const r = nextDataRow_(shL, [1,14]);
    shL.getRange(r,1,1,log.length).setValues([log]);
    shL.getRange(r,4).setNumberFormat('@');
    const res = {generated:rowsOut.length, envioId, kind};
    if (warning) res.warning = warning;
    return ok(res);
  } finally {
    lock.releaseLock();
  }
}
function discardUrine_(p){
  const code = String(p.caseCode||'').trim();
  if(!CASE_CODE_REGEX.test(code)) return err('Código inválido.');
  const q = findCaseRow_(code); if(q.row<0) return err('Caso no existe.');
  const sh = q.sh; const map = headMap_(sh);
  const shD = ensureData();
  if(shD.getLastRow()>=2){
    const hasM13 = shD.getRange(2,1,shD.getLastRow()-1,4).getValues().some(r=>(String(r[1]||'').startsWith(code) && String(r[3]||'').toLowerCase().includes('urine')));
    if (hasM13) return err('No se puede descartar: ya existen filas de Orina (M13).');
  }
  sh.getRange(q.row, map.nTubosURINE).setValue(0);
  if (p?.purgeTimes){
    const shU = ensureUrine();
    const tf = shU.getRange('A:A').createTextFinder(code).matchEntireCell(true).findAll() || [];
    for (let i=tf.length-1; i>=0; i--){
      const row = tf[i].getRow(); if(row>1) shU.deleteRow(row);
    }
  }
  CacheService.getDocumentCache().remove('processed_types_v1');
  return ok({caseCode:code, nTubosURINE:0});
}
function discardBlood_(p){
  const code = String(p.caseCode||'').trim();
  if(!CASE_CODE_REGEX.test(code)) return err('Código inválido.');
  const q = findCaseRow_(code); if(q.row<0) return err('Caso no existe.');
  const sh = q.sh; const map = headMap_(sh);
  const shD = ensureData();
  if(shD.getLastRow()>=2){
    const hasBlood = shD.getRange(2,1,shD.getLastRow()-1,4).getValues().some(r=>{
      const nb = String(r[1]||'');
      return nb.startsWith(code) && (nb.includes('M16') || nb.includes('M26') || nb.includes('M03'));
    });
    if(hasBlood) return err('No se puede descartar: ya existen filas de plasma/suero generadas para este caso.');
  }
  if(map.nTubosEDTA) sh.getRange(q.row, map.nTubosEDTA).setValue(0);
  if(map.nTubosSERUM) sh.getRange(q.row, map.nTubosSERUM).setValue(0);
  CacheService.getDocumentCache().remove('processed_types_v1');
  return ok({caseCode:code, nTubosEDTA:0, nTubosSERUM:0});
}
function listHistory_(limit){
  const sh = ensureLog(); const last = sh.getLastRow(); if(last<2) return ok([]);
  const data = sh.getRange(2,1,last-1,HEAD_LOG.length).getValues().slice(-limit).reverse();
  const toSum = (o)=> Object.values(o||{}).reduce((a,v)=> a + (typeof v==='number'?v : (v&&typeof v==='object'? Object.values(v).reduce((x,y)=>x+Number(y||0),0) : 0)), 0);
  const out = data.map(r=>{
    const [fecha,resp,email,casos,total,d1,e1,g1s,g1u,,ubcJson,prodJson,obs,envioId,kind] = r;
    let ubc={}, prod={}; try{ubc=JSON.parse(ubcJson||'{}');}catch(_){}; try{prod=JSON.parse(prodJson||'{}');}catch(_){};
    let plasmaTotal=0, serumTotal=0, urineTotal=0, ubcTotal=0;
    Object.keys(prod).forEach(k=>{ plasmaTotal+=toSum(prod[k]?.plasma||{}); serumTotal+=toSum(prod[k]?.serum||{}); urineTotal+=toSum(prod[k]?.urine||{}); });
    Object.keys(ubc).forEach(k=>{ const a=ubc[k]||[]; ubcTotal+=Array.isArray(a)?a.length:0; });
    return {fechaEnvio:fecha?Utilities.formatDate(new Date(fecha), TZ, 'dd/MM/yy HH:mm'):'', envioId, responsable:resp, email, casos:(casos||'').toString().split(',').map(s=>s.trim()).filter(Boolean),
            totalFilas:Number(total||0), plasmaTotal, serumTotal, urineTotal, ubcTotal, obs, kind};
  });
  return ok(out);
}

/* =========== Wrappers UI =========== */
function uiListCasesAndStatus(){ return JSON.parse(listCasesAndStatus_().getContent()); }
function uiMe(){ return JSON.parse(me_().getContent()); }
function uiCreateOrUpdateCase(p){ return JSON.parse(createOrUpdateCase_(p).getContent()); }
function uiGenerateRows2(p){ return JSON.parse(generateRows2_(p).getContent()); }
function uiDiscardUrine(p){ return JSON.parse(discardUrine_(p).getContent()); }
function uiDiscardBlood(p){ return JSON.parse(discardBlood_(p).getContent()); }
function uiListHistory(limit){ return JSON.parse(listHistory_(limit).getContent()); }
function uiCheckCaseExists(p) { return JSON.parse(checkCaseExists_(p.caseCode).getContent()); }
