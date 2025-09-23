/* ===============================
   Tabs & theme
   =============================== */
const tabButtons = document.querySelectorAll('.tab-btn');
const panes = document.querySelectorAll('.pane');

tabButtons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const targetId = btn.getAttribute('data-target');

    panes.forEach(p=>{
      if(p.id === targetId){
        p.classList.add('show');
      } else {
        p.classList.remove('show');
      }
    });

    // If Everyday Tools pane is activated, ensure all accordion panels are closed by default
    if(targetId === 'pane-everyday'){
      document.querySelectorAll('#everyAcc .acc-item').forEach(it=> it.classList.remove('open'));
    }

    setTimeout(()=>{
      const activePane = document.getElementById(targetId);
      const input = activePane.querySelector('input.display, input[type="text"], input[type="number"], input[type="date"]');
      if(input) input.focus();
    }, 320);
  });
});

// theme
document.getElementById('themeToggle').addEventListener('click', ()=> document.body.classList.toggle('dark'));

/* ===============================
   History (global)
   =============================== */
let history = [];
function pushHistory(calc, expr, result){
  const ts = new Date().toLocaleString();
  history.unshift({calc, expr:String(expr), result:String(result), ts});
  if(history.length>50) history.length = 50;
  renderHistory();
}
function renderHistory(){
  const el = document.getElementById('historyList');
  const items = history.slice(0,10);
  if(items.length===0){ el.innerHTML='No history yet'; return; }
  el.innerHTML = items.map(it=>`<div class="history-item"><strong>[${it.calc}]</strong> ${escapeHtml(it.expr)} = <em>${escapeHtml(it.result)}</em><div style="font-size:0.8rem;color:var(--muted)">${it.ts}</div></div>`).join('');
}
function clearHistory(){ history=[]; renderHistory(); }
function downloadHistory(fmt='txt'){
  if(history.length===0){ alert('No history to save'); return; }
  const lines = history.map(h=>`${h.calc}\t${h.expr}\t${h.result}\t${h.ts}`);
  const blob = new Blob([lines.join('\n')], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download = `vedant_history.${fmt==='csv'?'csv':'txt'}`; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
document.getElementById('saveHistoryBtn').addEventListener('click', ()=>downloadHistory('csv'));
document.getElementById('loadHistoryBtn').addEventListener('click', ()=>document.getElementById('historyFile').click());
document.getElementById('historyFile').addEventListener('change', function(e){
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = function(){ const lines = reader.result.split(/\r?\n/).filter(Boolean); lines.forEach(line=>{ const parts = line.split(/\t/); if(parts.length>=4) history.unshift({calc:parts[0],expr:parts[1],result:parts[2],ts:parts[3]}); }); if(history.length>50) history.length=50; renderHistory(); alert('History loaded'); };
  reader.readAsText(f);
});
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ===============================
   Shared evaluation engine
   =============================== */
if(!Math.log10) Math.log10 = x => Math.log(x)/Math.LN10;

let sciIsDeg = true;
const sciModeBtn = document.getElementById('sciModeBtn');
const sciModeLabel = document.getElementById('sciModeLabel');
sciModeBtn.addEventListener('click', ()=>{ sciIsDeg = !sciIsDeg; sciModeLabel.innerText = sciIsDeg ? 'DEG' : 'RAD'; document.getElementById('sciModeLabelLive').innerText = sciModeLabel.innerText; });

const sciModeBtnLive = document.getElementById('sciModeBtnLive');
sciModeBtnLive.addEventListener('click', ()=>{ sciIsDeg = !sciIsDeg; sciModeLabel.innerText = sciIsDeg ? 'DEG' : 'RAD'; document.getElementById('sciModeLabelLive').innerText = sciModeLabel.innerText; });

function preprocess(exprRaw){
  if(exprRaw==null) return '';
  let expr = String(exprRaw);
  expr = expr.replace(/\s+/g,'');
  expr = expr.replace(/[−—–]/g,'-');
  expr = expr.replace(/π/g,'Math.PI');
  expr = expr.replace(/(^|[^A-Za-z0-9_.])pi([^A-Za-z0-9_.]|$)/ig, '$1Math.PI$2');
  expr = expr.replace(/(^|[^A-Za-z0-9_.])e([^A-Za-z0-9_.]|$)/g, '$1Math.E$2');

  // sqrt
  expr = expr.replace(/√\(/g,'Math.sqrt(');
  expr = expr.replace(/√([0-9]+(?:\.[0-9]+)?)/g,'Math.sqrt($1)');

  // functions: normalize
  expr = expr.replace(/sin\(/g,'FUNC_SIN(');
  expr = expr.replace(/cos\(/g,'FUNC_COS(');
  expr = expr.replace(/tan\(/g,'FUNC_TAN(');
  expr = expr.replace(/ln\(/g,'Math.log(');
  expr = expr.replace(/log\(/g,'Math.log10(');

  // handle sin90 etc.
  expr = expr.replace(/sin(-?[0-9]+(?:\.[0-9]+)?)/g, 'FUNC_SIN($1)');
  expr = expr.replace(/cos(-?[0-9]+(?:\.[0-9]+)?)/g, 'FUNC_COS($1)');
  expr = expr.replace(/tan(-?[0-9]+(?:\.[0-9]+)?)/g, 'FUNC_TAN($1)');
  expr = expr.replace(/ln(-?[0-9]+(?:\.[0-9]+)?)/g, 'Math.log($1)');
  expr = expr.replace(/log(-?[0-9]+(?:\.[0-9]+)?)/g, 'Math.log10($1)');

  // percentage and power
  expr = expr.replace(/([0-9]+(?:\.[0-9]+)?)%/g, '($1/100)');
  expr = expr.replace(/([0-9\.]+)\^([0-9\.]+)/g, 'Math.pow($1,$2)');

  return expr;
}

function evaluateExpression(rawExpr, useSciMode=false){
  if(rawExpr==null) return null;
  let expr = preprocess(rawExpr);

  const conv = valStr => (useSciMode && sciIsDeg) ? `(${valStr}*Math.PI/180)` : `(${valStr})`;
  expr = expr.replace(/FUNC_SIN\(([^)]+)\)/g, (_,a)=>`Math.sin(${conv(a)})`);
  expr = expr.replace(/FUNC_COS\(([^)]+)\)/g, (_,a)=>`Math.cos(${conv(a)})`);
  expr = expr.replace(/FUNC_TAN\(([^)]+)\)/g, (_,a)=>`Math.tan(${conv(a)})`);

  try{
    const fn = new Function('Math','return ' + expr + ';');
    const value = fn(Math);
    if(value===undefined) throw 'Undefined';
    return value;
  }catch(e){
    throw e;
  }
}

/* Helpers */
function formatNumber(v){
  if(typeof v === 'number'){
    if(!isFinite(v)) return String(v);
    if(Math.abs(v) < 1e-6 || Math.abs(v) > 1e12) return v.toExponential(6);
    return Number(v.toPrecision(12)).toString();
  }
  return String(v);
}
function looksComplete(expr){
  if(!expr) return false;
  const last = expr.trim().slice(-1);
  return /[0-9\)\%πeEIi]/.test(last);
}
function debounce(fn, ms=220){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; }

/* ===============================
   Simple / Students / Scientific (classic)
   =============================== */
const simpleInput = document.getElementById('simpleInput');
function appendRaw(which, token){
  const el = which==='simple' ? simpleInput : which==='sci' ? document.getElementById('sciInput') : which==='sciLive' ? document.getElementById('sciLiveInput') : which==='stud' ? document.getElementById('studInput') : null;
  if(!el) return;
  el.value += token;
  el.focus();
}
function backspaceRaw(which){
  const el = which==='simple' ? simpleInput : which==='sci' ? document.getElementById('sciInput') : which==='sciLive' ? document.getElementById('sciLiveInput') : which==='stud' ? document.getElementById('studInput') : null;
  if(!el) return;
  el.value = el.value.slice(0,-1);
  el.focus();
}
function clearInput(which){
  const el = which==='simple' ? simpleInput : which==='sci' ? document.getElementById('sciInput') : which==='sciLive' ? document.getElementById('sciLiveInput') : which==='stud' ? document.getElementById('studInput') : null;
  if(!el) return;
  el.value = '';
  if(which==='simple') document.getElementById('simpleLive').innerText='Result: —';
  if(which==='sci') document.getElementById('sciLive').innerText='Result: —';
  if(which==='sciLive'){ document.getElementById('sciLivePreview').innerText = 'Live Result: '; document.getElementById('sciLiveBelow').innerText=''; }
  if(which==='stud') document.getElementById('studLive').innerText='Result: —';
}
function forceEval(which){
  const el = which==='simple' ? simpleInput : which==='sci' ? document.getElementById('sciInput') : which==='sciLive' ? document.getElementById('sciLiveInput') : which==='stud' ? document.getElementById('studInput') : null;
  if(!el) return;
  try{
    const useSci = (which==='sci' || which==='sciLive' || which==='stud');
    const originalExpr = el.value;
    const val = evaluateExpression(el.value, useSci);
    const s = formatNumber(val);
    el.value = String(s);
    if(which==='simple') document.getElementById('simpleLive').innerText = `Result: ${s}`;
    if(which==='sci') document.getElementById('sciLive').innerText = `Result: ${s}`;
    if(which==='sciLive'){ document.getElementById('sciLivePreview').innerText = 'Live Result: ' + s; document.getElementById('sciLiveBelow').innerText = ''; }
    if(which==='stud') document.getElementById('studLive').innerText = `Result: ${s}`;
    pushHistory(which==='sci'?'Scientific': which==='sciLive'?'Scientific (Live)': which==='stud'?'Students':'Simple', originalExpr, s);
  }catch(e){
    el.value = 'Error';
    if(which==='simple') document.getElementById('simpleLive').innerText = 'Result: Error';
    if(which==='sci') document.getElementById('sciLive').innerText = 'Result: Error';
    if(which==='sciLive') document.getElementById('sciLivePreview').innerText = 'Live Result: Error';
    if(which==='stud') document.getElementById('studLive').innerText = 'Result: Error';
  }
}
simpleInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); forceEval('simple'); }});
document.getElementById('sciInput').addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); forceEval('sci'); }});
document.getElementById('studInput').addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); forceEval('stud'); }});

/* STUDENT memory */
const studInput = document.getElementById('studInput');
let STUD_MEM = 0;
function memPlus(){ try{ const cur = studInput.value ? Number(evaluateExpression(studInput.value, true)) : 0; STUD_MEM = (STUD_MEM||0) + (isNaN(cur)?0:cur); document.getElementById('studMemBox').innerText = 'Memory: ' + STUD_MEM; alert('M+ saved'); }catch(e){ alert('Error'); } }
function memMinus(){ try{ const cur = studInput.value ? Number(evaluateExpression(studInput.value, true)) : 0; STUD_MEM = (STUD_MEM||0) - (isNaN(cur)?0:cur); document.getElementById('studMemBox').innerText = 'Memory: ' + STUD_MEM; alert('M- saved'); }catch(e){ alert('Error'); } }
function memRecall(){ studInput.value += String(STUD_MEM); studInput.focus(); }
function memClear(){ STUD_MEM = 0; document.getElementById('studMemBox').innerText = 'Memory: 0'; alert('Memory cleared'); }

/* SCIENTIFIC (Live) - smart preview */
const sciLiveInput = document.getElementById('sciLiveInput');
const sciLivePreview = document.getElementById('sciLivePreview');
const sciLiveBelow = document.getElementById('sciLiveBelow');

const scheduleEvalSciLive = debounce(()=>{
  const expr = sciLiveInput.value;
  if(!looksComplete(expr)){ sciLivePreview.innerText='Live Result: '; sciLiveBelow.innerText=''; return; }
  try{
    const val = evaluateExpression(expr, true);
    const s = formatNumber(val);
    sciLivePreview.innerText = 'Live Result: ' + s;
    sciLiveBelow.innerText = '';
    pushHistory('Scientific (Live)', expr, s);
  }catch(e){
    sciLivePreview.innerText='Live Result: ';
    sciLiveBelow.innerText = '';
  }
},200);

sciLiveInput.addEventListener('input', ()=> scheduleEvalSciLive());
sciLiveInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); forceEval('sciLive'); }});

/* ===============================
   Commerce, Stats, Matrix, %Change, Currency, Finance, EMI
   =============================== */
/* Commerce */
function comQuick(){ const n=parseFloat(document.getElementById('com_num').value); const p=parseFloat(document.getElementById('com_pct').value); const out=document.getElementById('com_pctResult'); if(isNaN(n)||isNaN(p)){ out.innerText='Enter valid numbers'; return;} const val=n*(p/100); out.innerText = `${p}% of ${n} = ₹${val.toFixed(2)}`; pushHistory('Commerce','Quick% '+n+','+p, val.toFixed(2)); }
function comProfitLoss(){ const cp=parseFloat(document.getElementById('com_cp').value); const sp=parseFloat(document.getElementById('com_sp').value); const out=document.getElementById('com_plResult'); if(isNaN(cp)||isNaN(sp)){ out.innerText='Enter valid CP & SP'; return;} if(sp>cp){ const profit=sp-cp; const pct=(profit/cp)*100; out.innerHTML=`Profit: ₹${profit.toFixed(2)}<br>Profit %: ${pct.toFixed(2)}%`; pushHistory('Commerce','Profit '+cp+','+sp,`₹${profit.toFixed(2)} (${pct.toFixed(2)}%)`);} else if(sp<cp){ const loss=cp-sp; const pct=(loss/cp)*100; out.innerHTML=`Loss: ₹${loss.toFixed(2)}<br>Loss %: ${pct.toFixed(2)}%`; pushHistory('Commerce','Loss '+cp+','+sp,`₹${loss.toFixed(2)} (${pct.toFixed(2)}%)`);} else{ out.innerText='No profit, no loss (CP = SP)'; pushHistory('Commerce','NoPL','0'); } }
function comDiscount(){ const price=parseFloat(document.getElementById('com_price').value); const disc=parseFloat(document.getElementById('com_disc').value); const out=document.getElementById('com_discResult'); if(isNaN(price)||isNaN(disc)){ out.innerText='Enter valid price & discount'; return;} const final=price-(price*disc/100); out.innerHTML=`Final Price: ₹${final.toFixed(2)}<br>You saved: ₹${(price-final).toFixed(2)}`; pushHistory('Commerce','Discount '+price+','+disc, final.toFixed(2)); }

/* Statistics */
function parseList(s){ if(!s) return []; return s.split(',').map(x=>Number(x.trim())).filter(x=>!isNaN(x)); }
function statsCalc(){ const raw=document.getElementById('stats_input').value; const arr=parseList(raw); const out=document.getElementById('stats_out'); if(arr.length===0){ out.innerText='Enter numbers separated by commas'; return; } const mean=arr.reduce((a,b)=>a+b,0)/arr.length; const sorted=arr.slice().sort((a,b)=>a-b); const mid=Math.floor(sorted.length/2); const median = (sorted.length%2===1)? sorted[mid] : (sorted[mid-1]+sorted[mid])/2; const freq={}; sorted.forEach(v=>freq[v]=(freq[v]||0)+1); let maxf=0; for(const k in freq) if(freq[k]>maxf) maxf=freq[k]; const modes = Object.keys(freq).filter(k=>freq[k]===maxf).map(Number); const varPop = arr.reduce((a,b)=>a+Math.pow(b-mean,2),0)/arr.length; const sdPop=Math.sqrt(varPop); const varSamp = arr.length>1 ? arr.reduce((a,b)=>a+Math.pow(b-mean,2),0)/(arr.length-1) : 0; const sdSamp=Math.sqrt(varSamp); out.innerHTML = `Mean: ${mean.toFixed(4)}<br>Median: ${median.toFixed(4)}<br>Mode: ${modes.join(', ')}<br>Std Dev (pop): ${sdPop.toFixed(4)}<br>Std Dev (sample): ${sdSamp.toFixed(4)}`; pushHistory('Statistics', raw, `Mean ${mean.toFixed(4)}`); }
function statsClear(){ document.getElementById('stats_input').value=''; document.getElementById('stats_out').innerText='Stats'; }

/* Matrix */
function renderMatrices(){ const size = Number(document.getElementById('mat_size').value); const A=document.getElementById('matA'), B=document.getElementById('matB'); A.innerHTML=''; B.innerHTML=''; const make=(container,prefix)=>{ const grid=document.createElement('div'); grid.style.display='grid'; grid.style.gridTemplateColumns=`repeat(${size},60px)`; grid.style.gap='6px'; for(let r=0;r<size;r++) for(let c=0;c<size;c++){ const inp=document.createElement('input'); inp.type='number'; inp.placeholder='0'; inp.style.width='60px'; inp.style.padding='6px'; inp.id=`${prefix}_${r}_${c}`; grid.appendChild(inp);} container.appendChild(grid); }; make(A,'MA'); make(B,'MB'); }
renderMatrices();
// ... matrix functions omitted here for brevity above are included further below (kept same) ...
function readM(prefix){ const size = Number(document.getElementById('mat_size').value); const M = Array.from({length:size}, ()=>Array(size).fill(0)); for(let r=0;r<size;r++) for(let c=0;c<size;c++){ const el=document.getElementById(prefix+'_'+r+'_'+c); const v = el?parseFloat(el.value):NaN; M[r][c] = isNaN(v)?0:v; } return M; }
function matToStr(M){ return '<pre>'+M.map(row=>'['+row.map(v=>v.toFixed(4)).join(', ')+']').join('\n')+'</pre>'; }
function det2(M){ return M[0][0]*M[1][1]-M[0][1]*M[1][0]; }
function det3(M){ return M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1]) - M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0]) + M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]); }
function matDeterminant(){ const size=Number(document.getElementById('mat_size').value); const A=readM('MA'); let d=0; if(size===2) d=det2(A); else d=det3(A); document.getElementById('mat_out').innerHTML='Determinant: <b>'+d.toFixed(4)+'</b>'; pushHistory('Matrix','det A', d.toFixed(4)); }
function inv2(M){ const d=det2(M); if(d===0) throw 'Singular'; return [[M[1][1]/d, -M[0][1]/d],[-M[1][0]/d, M[0][0]/d]]; }
function inv3(M){ const d=det3(M); if(d===0) throw 'Singular'; const cof=(i,j)=>{ const sub=[]; for(let r=0;r<3;r++) if(r!==i){ const row=[]; for(let c=0;c<3;c++) if(c!==j) row.push(M[r][c]); sub.push(row);} return sub[0][0]*sub[1][1]-sub[0][1]*sub[1][0]; }; const adj = Array.from({length:3}, ()=>Array(3).fill(0)); for(let i=0;i<3;i++) for(let j=0;j<3;j++){ adj[j][i] = ((i+j)%2===0?1:-1)*cof(i,j); } return adj.map(row=>row.map(v=>v/d)); }
function matInverse(){ const size=Number(document.getElementById('mat_size').value); const A=readM('MA'); try{ const inv = (size===2)?inv2(A):inv3(A); document.getElementById('mat_out').innerHTML='Inverse A: '+matToStr(inv); pushHistory('Matrix','Inverse A', JSON.stringify(inv)); }catch(e){ document.getElementById('mat_out').innerText='Not invertible'; } }
function matMultiply(){ const size=Number(document.getElementById('mat_size').value); const A=readM('MA'), B=readM('MB'); const C=Array.from({length:size}, ()=>Array(size).fill(0)); for(let i=0;i<size;i++) for(let j=0;j<size;j++){ let s=0; for(let k=0;k<size;k++) s+=A[i][k]*B[k][j]; C[i][j]=s; } document.getElementById('mat_out').innerHTML='A × B: '+matToStr(C); pushHistory('Matrix','A×B', JSON.stringify(C)); }
function matClear(){ const size=Number(document.getElementById('mat_size').value); for(let r=0;r<size;r++) for(let c=0;c<size;c++){ const a=document.getElementById('MA_'+r+'_'+c), b=document.getElementById('MB_'+r+'_'+c); if(a) a.value=''; if(b) b.value=''; } document.getElementById('mat_out').innerText='Matrix results'; }

/* % change */
function calcPercentChange(){ const o=parseFloat(document.getElementById('pc_old').value); const n=parseFloat(document.getElementById('pc_new').value); const out=document.getElementById('pc_out'); if(isNaN(o)||isNaN(n)){ out.innerText='Enter valid values'; return;} if(o===0){ out.innerText='Old value zero — undefined'; return;} const ch=n-o; const pct=(ch/o)*100; const dir = pct>0?'increase':pct<0?'decrease':'no change'; out.innerHTML = `Change: ₹${ch.toFixed(2)} (${Math.abs(pct).toFixed(2)}% ${dir})`; pushHistory('% Change', `${o}->${n}`, `${pct.toFixed(4)}%`); }

/* Currency (extended list) */
function convertCur(){
  const amt=parseFloat(document.getElementById('cur_amount').value);
  const from=document.getElementById('cur_from').value;
  const to=document.getElementById('cur_to').value;
  const out=document.getElementById('cur_out');
  if(isNaN(amt)){ out.innerText='Invalid amount'; return; }

  // NOTE: These rates are static approximations for demo purposes.
  // You may replace with live rates via API later.
  const ratesToUSD = {
    USD:1, INR:0.012, EUR:1.09, GBP:1.27, JPY:0.0071, CNY:0.14, AUD:0.66, CAD:0.74,
    SGD:0.74, AED:0.27, PKR:0.0036, BDT:0.0094, NPR:0.0075, LKR:0.0028, BTN:0.012
  };
  if(!ratesToUSD[from] || !ratesToUSD[to]){ out.innerText='Currency not supported'; return; }
  const usd = amt * ratesToUSD[from];
  const converted = usd / ratesToUSD[to];
  const val = converted.toFixed(4);
  out.innerText = `${amt} ${from} ≈ ${val} ${to}`;
  pushHistory('Currency', `${amt} ${from}->${to}`, val);
}

/* Finance & EMI charts */
let sipChart=null, ciChart=null, beChart=null, emiChart=null;

function calcSIP(){
  const P=parseFloat(document.getElementById('f_sip_amt').value);
  const annual=parseFloat(document.getElementById('f_sip_rate').value);
  const years=parseFloat(document.getElementById('f_sip_years').value);
  const out=document.getElementById('f_sip_out');
  if(isNaN(P)||isNaN(annual)||isNaN(years)){ out.innerText='Enter valid values'; return; }
  const r=annual/100/12;
  const n=years*12;
  const fv = P * ((Math.pow(1+r,n)-1)/r) * (1+r);
  out.innerHTML = `Future Value: ₹${fv.toFixed(2)} (Invested: ₹${(P*n).toFixed(2)})`;
  pushHistory('SIP', `${P},${annual},${years}`, fv.toFixed(2));

  const labels=[]; const data=[];
  let balance=0;
  for(let m=1;m<=n;m++){
    balance = balance*(1+r) + P;
    if(m%12===0){ labels.push('Year ' + (m/12)); data.push(Number(balance.toFixed(2))); }
  }
  if(sipChart) sipChart.destroy();
  sipChart = new Chart(document.getElementById('sipChart'), {
    type:'line',
    data:{ labels, datasets:[{label:'Portfolio (₹)', data, fill:true}] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
  });
}

function calcCompound(){
  const P=parseFloat(document.getElementById('f_ci_p').value);
  const r=parseFloat(document.getElementById('f_ci_r').value);
  const n=parseFloat(document.getElementById('f_ci_n').value);
  const t=parseFloat(document.getElementById('f_ci_t').value);
  const out=document.getElementById('f_ci_out');
  if(isNaN(P)||isNaN(r)||isNaN(n)||isNaN(t)){ out.innerText='Enter valid values'; return; }
  const A = P * Math.pow(1 + (r/100)/n, n*t);
  out.innerHTML = `Amount: ₹${A.toFixed(2)} (Interest: ₹${(A-P).toFixed(2)})`;
  pushHistory('Compound', `${P},${r},${n},${t}`, A.toFixed(2));

  const years = Math.ceil(t);
  const labels=[]; const data=[];
  for(let y=1;y<=years;y++){ labels.push('Year '+y); data.push( (P*Math.pow(1 + (r/100)/n, n*y)).toFixed(2) ); }
  if(ciChart) ciChart.destroy();
  ciChart = new Chart(document.getElementById('ciChart'), {
    type:'line',
    data:{ labels, datasets:[{label:'Amount (₹)', data, fill:true}] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
  });
}

function calcBreakEven(){
  const fixed=parseFloat(document.getElementById('f_be_fixed').value);
  const price=parseFloat(document.getElementById('f_be_price').value);
  const variable=parseFloat(document.getElementById('f_be_variable').value);
  const out=document.getElementById('f_be_out');
  if(isNaN(fixed)||isNaN(price)||isNaN(variable)){ out.innerText='Enter valid values'; return; }
  if(price<=variable){ out.innerText='No break-even (price <= variable)'; return; }
  const units = fixed/(price-variable);
  out.innerHTML = `Break-even units: ${Math.ceil(units)} units`;
  pushHistory('BreakEven', `${fixed},${price},${variable}`, `${Math.ceil(units)}`);

  const labels=[]; const cost=[]; const revenue=[];
  const maxUnits = Math.ceil(units*2);
  for(let u=0;u<=maxUnits;u++){ labels.push(u.toString()); cost.push((fixed + variable*u).toFixed(2)); revenue.push((price*u).toFixed(2)); }
  if(beChart) beChart.destroy();
  beChart = new Chart(document.getElementById('beChart'), {
    type:'line',
    data:{ labels, datasets:[{label:'Cost (₹)', data:cost},{label:'Revenue (₹)', data:revenue}] },
    options:{ responsive:true, maintainAspectRatio:false }
  });
}

/* EMI single doughnut chart */
function calcEMI_main(){
  const P=parseFloat(document.getElementById('emi_principal').value);
  const rYear=parseFloat(document.getElementById('emi_rate').value);
  const n=parseInt(document.getElementById('emi_months').value);
  const out=document.getElementById('emi_out');
  if(isNaN(P)||isNaN(rYear)||isNaN(n)||P<=0||rYear<=0||n<=0){ out.innerHTML='<span style="color:var(--danger)">Invalid input</span>'; return; }
  const r = rYear/12/100;
  const emi = (P*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
  const totalPay = emi*n; const totalInt = totalPay - P;
  out.innerHTML = `<b>Loan:</b> ₹${P.toFixed(2)} — <b>Rate:</b> ${rYear.toFixed(2)}% p.a. — <b>Tenure:</b> ${n} months<br><hr><b>EMI:</b> ₹${emi.toFixed(2)}<br><b>Total:</b> ₹${totalPay.toFixed(2)}<br><b>Interest:</b> ₹${totalInt.toFixed(2)}`;
  pushHistory('EMI', `P${P},r${rYear},n${n}`, `EMI ${emi.toFixed(2)}`);

  const ctx = document.getElementById('emi_chart');
  if(emiChart) emiChart.destroy();
  emiChart = new Chart(ctx, {
    type:'doughnut',
    data:{ labels:['Principal','Interest'], datasets:[{data:[P, totalInt], backgroundColor:['#10b981','#f59e0b']}] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}, title:{display:true,text:'Loan Breakdown'}} }
  });
}
function clearEMI_main(){ document.getElementById('emi_principal').value=''; document.getElementById('emi_rate').value=''; document.getElementById('emi_months').value=''; document.getElementById('emi_out').innerHTML='Fill inputs and press Calculate'; if(emiChart){ emiChart.destroy(); emiChart=null } }

/* ===============================
   Init: set up accordion state, focus, render history
   =============================== */
document.querySelectorAll('.pane').forEach(p=>{
  if(!p.classList.contains('show')) p.style.display = 'none';
  else p.style.display = 'block';
});
new MutationObserver(()=>{ document.querySelectorAll('.pane').forEach(p=>{ p.style.display = p.classList.contains('show') ? 'block' : 'none'; }); }).observe(document.body, {subtree:true, attributes:true, attributeFilter:['class']});

renderHistory();
document.getElementById('simpleInput').focus();

/* ===============================
   Everyday Tools: Accordion behavior
   =============================== */
function toggleAcc(key){
  const acc = document.getElementById('everyAcc');
  const items = acc.querySelectorAll('.acc-item');
  items.forEach(it=>{
    if(it.dataset.key===key){
      const willOpen = !it.classList.contains('open');
      // close all first
      items.forEach(x => x.classList.remove('open'));
      if(willOpen) it.classList.add('open');
    } else {
      it.classList.remove('open');
    }
  });
}

/* -------------------------------
   Basic Unit Converter (keeps old simple behavior)
   ------------------------------- */
const basicUnitOptions = {
  length: { units: { km:1000, m:1, cm:0.01, mm:0.001, ft:0.3048, in:0.0254 } },
  mass: { units: { kg:1, g:0.001, lb:0.45359237, oz:0.028349523125 } },
  temp: { units: {} }
};
function renderUnitOptionsBasic(){
  const cat = document.getElementById('uc_category').value;
  const from = document.getElementById('uc_from');
  const to = document.getElementById('uc_to');
  from.innerHTML=''; to.innerHTML='';
  if(cat==='temp'){
    ['C','F','K'].forEach(u=>{ const o=document.createElement('option'); o.value=u; o.textContent=u; from.appendChild(o); to.appendChild(o.cloneNode(true)); });
  } else {
    const units = basicUnitOptions[cat].units;
    Object.keys(units).forEach(k=>{ const o=document.createElement('option'); o.value=k; o.textContent=k; from.appendChild(o); to.appendChild(o.cloneNode(true)); });
  }
  document.getElementById('uc_value').value='';
  document.getElementById('uc_result').innerText='Result';
}
renderUnitOptionsBasic();

function unitConvertBasic(){
  const cat = document.getElementById('uc_category').value;
  const v = parseFloat(document.getElementById('uc_value').value);
  const f = document.getElementById('uc_from').value;
  const t = document.getElementById('uc_to').value;
  const out = document.getElementById('uc_result');
  if(isNaN(v)){ out.innerText='Enter numeric value'; return; }
  if(cat!=='temp'){
    const baseValue = v * basicUnitOptions[cat].units[f];
    const converted = baseValue / basicUnitOptions[cat].units[t];
    out.innerText = `${v} ${f} = ${converted.toFixed(6).replace(/\.?0+$/,'')} ${t}`;
    pushHistory('Unit Converter (Basic)', `${v}${f}->${t}`, converted.toFixed(6));
  } else {
    let cVal;
    if(f==='C') cVal = v;
    if(f==='F') cVal = (v - 32) * 5/9;
    if(f==='K') cVal = v - 273.15;
    let res;
    if(t==='C') res = cVal;
    if(t==='F') res = cVal * 9/5 + 32;
    if(t==='K') res = cVal + 273.15;
    out.innerText = `${v} ${f} = ${res.toFixed(4)} ${t}`;
    pushHistory('Unit Converter (Basic)', `${v}${f}->${t}`, res.toFixed(4));
  }
}
function unitClearBasic(){ document.getElementById('uc_value').value=''; document.getElementById('uc_result').innerText='Result'; }

/* ===============================
   Advanced Unit Converter
   =============================== */
const advUnits = {
  length: { units: { km:1000, m:1, cm:0.01, mm:0.001, ft:0.3048, in:0.0254 }, symbol:'' },
  mass: { units: { kg:1, g:0.001, lb:0.45359237, oz:0.028349523125 }, symbol:'' },
  temp: { units: ['C','F','K'] },
  volume: { units: { L:1, mL:0.001, "m^3":1000, "ft^3":28.3168466 }, symbol:'' },
  speed: { units: { "m/s":1, "km/h":(1000/3600), mph:0.44704, knot:0.514444 }, symbol:'' },
  time: { units: { sec:1, min:60, hr:3600, day:86400 }, symbol:'' }
};

let activeUTab = 'length';

// render tab content
function renderUContent(){
  const container = document.getElementById('uContent');
  container.innerHTML = '';
  // header area
  const area = document.createElement('div');
  area.style.display='flex'; area.style.gap='8px'; area.style.flexWrap='wrap'; area.style.alignItems='center';
  const input = document.createElement('input'); input.id='adv_input'; input.className='small'; input.placeholder='Value';
  const from = document.createElement('select'); from.id='adv_from'; from.className='small';
  const swap = document.createElement('button'); swap.className='swap-btn'; swap.innerText='🔄'; swap.title='Swap'; swap.onclick = ()=>{ const a=from.value; from.value=to.value; to.value=a; doAdvConvert(); };
  const to = document.createElement('select'); to.id='adv_to'; to.className='small';
  const btn = document.createElement('button'); btn.className='key fn'; btn.innerText='Convert'; btn.onclick = doAdvConvert;
  const clr = document.createElement('button'); clr.className='key clear'; clr.innerText='Clear'; clr.onclick = ()=>{ input.value=''; document.getElementById('adv_result').innerText='Result'; };
  area.appendChild(input); area.appendChild(from); area.appendChild(swap); area.appendChild(to); area.appendChild(btn); area.appendChild(clr);
  container.appendChild(area);
  const resbox = document.createElement('div'); resbox.className='result-box'; resbox.id='adv_result'; resbox.innerText='Result';
  container.appendChild(resbox);

  populateUTabSelectors(activeUTab, from, to);
  // auto convert on Enter
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ doAdvConvert(); }});
}

function populateUTabSelectors(key, fromEl, toEl){
  fromEl.innerHTML=''; toEl.innerHTML='';
  if(key === 'temp'){
    ['C','F','K'].forEach(u=>{ const o=document.createElement('option'); o.value=u; o.textContent=u; fromEl.appendChild(o); toEl.appendChild(o.cloneNode(true)); });
  } else {
    const unitsObj = advUnits[key].units;
    Object.keys(unitsObj).forEach(u=>{
      const o=document.createElement('option'); o.value=u; o.textContent=u; fromEl.appendChild(o); toEl.appendChild(o.cloneNode(true));
    });
  }
}

function doAdvConvert(){
  const inp = document.getElementById('adv_input');
  const from = document.getElementById('adv_from').value;
  const to = document.getElementById('adv_to').value;
  const out = document.getElementById('adv_result');
  const v = parseFloat(inp.value);
  if(isNaN(v)){ out.innerText='Enter numeric value'; return; }
  const key = activeUTab;
  if(key === 'temp'){
    let c;
    if(from === 'C') c = v;
    if(from === 'F') c = (v-32)*5/9;
    if(from === 'K') c = v - 273.15;
    let res;
    if(to === 'C') res = c;
    if(to === 'F') res = c*9/5 + 32;
    if(to === 'K') res = c + 273.15;
    out.innerText = `${v} ${from} = ${res.toFixed(4)} ${to}`;
    pushHistory(`Unit Converter - Temp`, `${v}${from}->${to}`, res.toFixed(4));
    return;
  }
  // other categories: convert via base (m, kg, L, m/s, sec)
  const units = advUnits[key].units;
  const baseFrom = units[from];
  const baseTo = units[to];
  if(baseFrom === undefined || baseTo === undefined){ out.innerText='Unit not supported'; return; }
  const baseVal = v * baseFrom; // value in base units
  const converted = baseVal / baseTo;
  out.innerText = `${v} ${from} = ${converted.toFixed(6).replace(/\.?0+$/,'')} ${to}`;
  pushHistory(`Unit Converter - ${capitalize(key)}`, `${v}${from}->${to}`, converted.toFixed(6));
}
function switchUTab(k){
  activeUTab = k;
  document.querySelectorAll('.u-tab').forEach(t=> t.classList.toggle('active', t.dataset.key===k));
  // animate panel fade
  const content = document.getElementById('uContent');
  content.style.opacity=0;
  setTimeout(()=>{ renderUContent(); content.style.opacity=1; }, 160);
}
function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
switchUTab('length'); // initial render with length

/* ===============================
   Everyday Tools: date, BMI (updated)
   =============================== */
function useToday(){
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('date_to').value = today;
}
function clearDate(){ document.getElementById('date_from').value=''; document.getElementById('date_to').value=''; document.getElementById('date_result').innerText='Result'; }
function calcDateDiff(){
  const f = document.getElementById('date_from').value;
  const t = document.getElementById('date_to').value;
  const out = document.getElementById('date_result');
  if(!f || !t){ out.innerText='Choose both dates'; return; }
  const d1 = new Date(f);
  const d2 = new Date(t);
  if(d2 < d1){ out.innerText='Second date should be after first'; return; }
  let years = d2.getFullYear() - d1.getFullYear();
  let months = d2.getMonth() - d1.getMonth();
  let days = d2.getDate() - d1.getDate();
  if(days < 0){ months -= 1; const prevMonth = new Date(d2.getFullYear(), d2.getMonth(), 0).getDate(); days += prevMonth; }
  if(months < 0){ years -= 1; months += 12; }
  out.innerHTML = `${years} years, ${months} months, ${days} days`;
  pushHistory('Date & Age', `${f}->${t}`, `${years}y ${months}m ${days}d`);
}

/* BMI: improved with gender, age, badge and bar chart */
let bmiChart = null;
function clearBMI(){ document.getElementById('bmi_weight').value=''; document.getElementById('bmi_height').value=''; document.getElementById('bmi_age').value=''; document.getElementById('bmi_gender').value='male'; document.getElementById('bmi_result').innerText='Result'; document.getElementById('bmiBadge').innerHTML=''; if(bmiChart){ bmiChart.destroy(); bmiChart=null; } }
function calcBMI(){
  const w = parseFloat(document.getElementById('bmi_weight').value);
  const hcm = parseFloat(document.getElementById('bmi_height').value);
  const age = parseInt(document.getElementById('bmi_age').value);
  const gender = document.getElementById('bmi_gender').value;
  const out = document.getElementById('bmi_result');
  if(isNaN(w) || isNaN(hcm) || hcm<=0 || isNaN(age)){ out.innerText='Enter valid weight, height and age'; return; }
  const h = hcm/100;
  const bmi = w / (h*h);
  // WHO adult thresholds
  let category = '';
  if(bmi < 18.5) category = 'Underweight';
  else if(bmi < 25) category = 'Normal';
  else if(bmi < 30) category = 'Overweight';
  else category = 'Obese';

  // Badge
  const badgeEl = document.getElementById('bmiBadge');
  badgeEl.innerHTML = '';
  const badge = document.createElement('span');
  badge.className = 'bmi-badge ' + (category==='Underweight'?'bmi-under':category==='Normal'?'bmi-normal':category==='Overweight'?'bmi-over':'bmi-obese');
  badge.innerText = `${category} — BMI ${bmi.toFixed(2)}`;
  badgeEl.appendChild(badge);

  // Age group label
  let ageGroup = 'Adult';
  if(age < 18) ageGroup = 'Child';
  else if(age >= 65) ageGroup = 'Senior';

  out.innerHTML = `Age: ${age} (${ageGroup}), Gender: ${capitalize(gender)}<br>BMI: <b>${bmi.toFixed(2)}</b> — <em>${category}</em>`;

  // Build bar chart: four ranges (Underweight, Normal, Overweight, Obese)
  const labels = ['Underweight','Normal','Overweight','Obese'];
  const ranges = [
    {min:0, max:18.5, color:'#3b82f6'},
    {min:18.5, max:25, color:'#10b981'},
    {min:25, max:30, color:'#f59e0b'},
    {min:30, max:45, color:'#ef4444'}
  ];
  const dataVals = ranges.map(r => r.max - r.min);

  // destroy old chart
  if(bmiChart) bmiChart.destroy();

  // Create stacked bar representing ranges; user's BMI shown as vertical line (plugin)
  const ctx = document.getElementById('bmiChart').getContext('2d');
  bmiChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['BMI Ranges'],
      datasets: ranges.map((r, idx) => ({
        label: labels[idx],
        data: [r.max - r.min],
        backgroundColor: r.color,
        stack: 'a',
        borderWidth: 0
      }))
    },
    options: {
      indexAxis: 'x',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, display: false },
        y: {
          stacked: true,
          min: 0,
          max: 45,
          ticks: { stepSize: 5 },
          title: { display: true, text: 'BMI' }
        }
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { enabled: true }
      },
      onResize: function(){ /* responsive adjustments if needed */ }
    },
    plugins: [{
      id: 'bmiMarker',
      afterDraw(chart) {
        const yScale = chart.scales.y;
        const xScale = chart.scales.x;
        const ctx2 = chart.ctx;
        const bmiVal = bmi;
        // find pixel for bmi on y axis
        const yPixel = yScale.getPixelForValue(bmiVal);
        // draw vertical line across chart area
        ctx2.save();
        ctx2.beginPath();
        ctx2.moveTo(chart.chartArea.left, yPixel);
        ctx2.lineTo(chart.chartArea.right, yPixel);
        ctx2.lineWidth = 2;
        ctx2.strokeStyle = (getComputedStyle(document.body).backgroundColor === 'rgb(7, 18, 38)') ? '#ffffff' : '#000000';
        ctx2.setLineDash([6,4]);
        ctx2.stroke();
        // marker label
        ctx2.fillStyle = (getComputedStyle(document.body).backgroundColor === 'rgb(7, 18, 38)') ? '#ffffff' : '#000000';
        ctx2.font = '12px sans-serif';
        const txt = `You: ${bmi.toFixed(2)}`;
        ctx2.fillText(txt, chart.chartArea.right - ctx2.measureText(txt).width - 6, yPixel - 6);
        ctx2.restore();
      }
    }]
  });

  // Save to history
  const historyEntry = `Age: ${age}, ${capitalize(gender)}, ${w}kg/${hcm}cm → ${bmi.toFixed(2)} (${category})`;
  pushHistory('BMI', historyEntry, `${bmi.toFixed(2)} (${category})`);
}

/* ===============================
   Scroll-to-top FAB
   =============================== */
const scrollBtn = document.getElementById('scrollTopBtn');
window.addEventListener('scroll', ()=> {
  if(window.scrollY > 200) scrollBtn.classList.add('show'); else scrollBtn.classList.remove('show');
});
scrollBtn.addEventListener('click', ()=> window.scrollTo({top:0,behavior:'smooth'}));