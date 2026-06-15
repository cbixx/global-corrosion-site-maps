function getToolLanguage() {
  const htmlLang = document.documentElement.lang.toLowerCase();
  return htmlLang.startsWith("zh") ? "zh" : "en";
}

const TOOL_LANG = getToolLanguage();
const TEXT = window.COLOR_REPAIR_I18N[TOOL_LANG];

function t(path) {
  return path.split(".").reduce((obj, key) => obj && obj[key], TEXT) || path;
}

function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = t(element.dataset.i18n);
  });
}

const LAB0 = { L: 43.55, a: 2.23, b: 9.62 };

const pigments = [
  { key: "white" },
  { key: "black" },
  { key: "yellow" },
  { key: "blue" },
  { key: "red" },
  { key: "green" },
];

function pigmentName(pigment) {
  return t(`pigments.${pigment.key}`);
}

// K: 3x6（行：L,a,b；列按 pigments 顺序）
// 注意：此处 K 对应“D 为质量分数”的建模情形
const K = [
  [ 161.1424,   -512.7577,    36.8668,   -61.6920,   -51.2298,  -37.5820 ], // L
  [ -10.0440,   -135.8994,    45.4251,  -116.1710,   179.1869, -115.5277 ], // a
  [ -25.3530,   -406.9844,   149.7900,  -188.4256,    38.9160,  -26.9142 ], // b
];

const D_MIN = 0.0;
const D_MAX = 0.12;       // 12% -> 0.12（质量分数）
const MAX_PIGMENTS = 3;

function dot(a,b){ let s=0; for(let i=0;i<a.length;i++) s += a[i]*b[i]; return s; }
function matVec(M,v){ return M.map(row => dot(row,v)); }
function vecSub(a,b){ return a.map((x,i)=>x-b[i]); }
function norm2(v){ return dot(v,v); }
function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }

/** 解小规模线性方程 A x = b（A: nxn, n<=3） */
function solveLinear(A, b){
  const n = A.length;
  const M = A.map(r => r.slice());
  const x = b.slice();

  for(let i=0;i<n;i++){
    let piv = i;
    for(let r=i+1;r<n;r++){
      if(Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
    }
    if(Math.abs(M[piv][i]) < 1e-12) return null;

    if(piv !== i){
      [M[i], M[piv]] = [M[piv], M[i]];
      [x[i], x[piv]] = [x[piv], x[i]];
    }

    const div = M[i][i];
    for(let c=i;c<n;c++) M[i][c] /= div;
    x[i] /= div;

    for(let r=0;r<n;r++){
      if(r===i) continue;
      const factor = M[r][i];
      for(let c=i;c<n;c++) M[r][c] -= factor * M[i][c];
      x[r] -= factor * x[i];
    }
  }
  return x;
}

/** 最小二乘：min ||A d - y||^2，A:3xm(m<=3)，正规方程 */
function leastSquares(A3xm, y3){
  const m = A3xm[0].length;
  const ATA = Array.from({length:m}, ()=>Array(m).fill(0));
  const ATy = Array(m).fill(0);

  for(let i=0;i<m;i++){
    for(let j=0;j<m;j++){
      let s=0;
      for(let r=0;r<3;r++) s += A3xm[r][i]*A3xm[r][j];
      ATA[i][j] = s;
    }
    let sy=0;
    for(let r=0;r<3;r++) sy += A3xm[r][i]*y3[r];
    ATy[i] = sy;
  }
  return solveLinear(ATA, ATy);
}

/** 盒约束最小二乘：0..0.12（质量分数），m<=3，枚举边界 */
function boxConstrainedLS(A3xm, y3, lo=D_MIN, hi=D_MAX){
  const m = A3xm[0].length;
  const states = ["free", "lo", "hi"];
  let best = null;

  const total = Math.pow(3,m);
  for(let mask=0; mask<total; mask++){
    const st = [];
    let tmp = mask;
    for(let i=0;i<m;i++){
      st.push(states[tmp % 3]);
      tmp = Math.floor(tmp/3);
    }

    const freeIdx = [];
    const fixed = Array(m).fill(null);
    for(let i=0;i<m;i++){
      if(st[i]==="free") freeIdx.push(i);
      else fixed[i] = (st[i]==="lo") ? lo : hi;
    }

    let yAdj = y3.slice();
    for(let i=0;i<m;i++){
      if(fixed[i] !== null){
        for(let r=0;r<3;r++){
          yAdj[r] -= A3xm[r][i] * fixed[i];
        }
      }
    }

    let d = Array(m).fill(0);
    for(let i=0;i<m;i++) if(fixed[i] !== null) d[i] = fixed[i];

    if(freeIdx.length === 0){
      const pred = matVec(A3xm, d);
      const res = vecSub(pred, y3);
      const sse = norm2(res);
      if(best === null || sse < best.sse) best = { d, sse };
      continue;
    }

    const k = freeIdx.length;
    const A_free = [[],[],[]];
    for(let r=0;r<3;r++){
      for(let j=0;j<k;j++){
        A_free[r].push(A3xm[r][freeIdx[j]]);
      }
    }

    const d_free = leastSquares(A_free, yAdj);
    if(d_free === null) continue;

    let ok = true;
    for(let j=0;j<k;j++){
      const val = d_free[j];
      if(val < lo - 1e-9 || val > hi + 1e-9){ ok=false; break; }
    }
    if(!ok) continue;

    for(let j=0;j<k;j++) d[freeIdx[j]] = d_free[j];
    d = d.map(v => clamp(v, lo, hi));

    const pred = matVec(A3xm, d);
    const res = vecSub(pred, y3);
    const sse = norm2(res);
    if(best === null || sse < best.sse) best = { d, sse };
  }
  return best;
}

/** ΔE*ab(76) */
function deltaE76(Lab1, Lab2){
  const dL = Lab1[0]-Lab2[0];
  const da = Lab1[1]-Lab2[1];
  const db = Lab1[2]-Lab2[2];
  return Math.sqrt(dL*dL + da*da + db*db);
}

/** 组合枚举 */
function combinations(arr, k){
  const res=[];
  function backtrack(start, path){
    if(path.length===k){ res.push(path.slice()); return; }
    for(let i=start;i<arr.length;i++){
      path.push(arr[i]);
      backtrack(i+1, path);
      path.pop();
    }
  }
  backtrack(0, []);
  return res;
}

/** 求解：枚举 1/2/3 颜料组合，取ΔE最小 */
function solveForTarget(Lt, at, bt){
  const delta = [Lt - LAB0.L, at - LAB0.a, bt - LAB0.b];

  const allIdx = pigments.map((_,i)=>i);
  const allCombos = []
    .concat(combinations(allIdx,1))
    .concat(combinations(allIdx,2))
    .concat(combinations(allIdx,3));

  const solutions = [];

  for(const combo of allCombos){
    const m = combo.length;

    const A = [[],[],[]];
    for(let r=0;r<3;r++){
      for(let j=0;j<m;j++){
        A[r].push(K[r][combo[j]]);
      }
    }

    const best = boxConstrainedLS(A, delta, D_MIN, D_MAX);
    if(!best) continue;

    const Dfull = Array(6).fill(0);
    for(let j=0;j<m;j++){
      Dfull[combo[j]] = best.d[j];
    }

    const used = Dfull.filter(v => v > 1e-8).length;
    if(used > MAX_PIGMENTS) continue;
    if(Dfull.some(v => v < -1e-8 || v > D_MAX + 1e-8)) continue;

    const dX = matVec(K, Dfull);
    const pred = [LAB0.L + dX[0], LAB0.a + dX[1], LAB0.b + dX[2]];

    const dE = deltaE76(pred, [Lt, at, bt]);
    solutions.push({ D: Dfull, pred, dE, sse: best.sse });
  }

  solutions.sort((x,y)=> x.dE - y.dE || x.sse - y.sse);
  return solutions;
}

/** UI */
const $ = (id)=>document.getElementById(id);
applyStaticTranslations();

$("badgeStatus").textContent = t("status.waiting");
$("mainContent").innerHTML = `<div class="muted">${t("messages.initial")}</div>`;

$("Lt").placeholder = t("inputs.LPlaceholder");
$("at").placeholder = t("inputs.aPlaceholder");
$("bt").placeholder = t("inputs.bPlaceholder");
const toast = (msg)=>{
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 3600);
};

function fmt(n, digits=2){
  if(!isFinite(n)) return "—";
  return Number(n).toFixed(digits);
}

/** 表格输出：显示为百分比，保留1位小数 */
function buildPigmentRows(D){
  const rows = pigments.map((p,i)=>({p, v:D[i]}))
    .filter(x=>x.v>1e-8)
    .sort((a,b)=>b.v-a.v);

  if(rows.length===0){
    return `<div class="muted">${t("result.none")}</div>`;
  }

  let html = `
    <table class="pigment-table">
      <thead>
        <tr><th>${t("result.pigmentHeader")}</th><th class="right">${t("result.dosageHeader")}</th></tr>
      </thead>
      <tbody>
  `;
  for(const r of rows){
    html += `<tr><td>${pigmentName(r.p)}</td><td class="right mono">${fmt(r.v * 100, 1)}</td></tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function renderMain(sol, target){
  const used = sol.D.filter(v=>v>1e-8).length;

  const kv = `
    <div class="kvs">
      <div class="kv">
        <div class="k">${t("result.target")}</div>
        <div class="v">L* ${fmt(target[0])} / a* ${fmt(target[1])} / b* ${fmt(target[2])}</div>
      </div>
      <div class="kv">
        <div class="k">${t("result.predicted")}</div>
        <div class="v">L* ${fmt(sol.pred[0])} / a* ${fmt(sol.pred[1])} / b* ${fmt(sol.pred[2])}</div>
      </div>
      <div class="kv">
        <div class="k">${t("result.pigmentCount")}</div>
        <div class="v">${used} ${t("result.species")} (≤ ${MAX_PIGMENTS})</div>
      </div>
      <div class="kv">
        <div class="k">${t("result.deltaE")}</div>
        <div class="v">${fmt(sol.dE, 3)}</div>
      </div>
    </div>
  `;

  return `
    ${kv}
    <div style="margin-top:10px;">
      <div class="small muted">${t("result.dosageTitle")}</div>
      ${buildPigmentRows(sol.D)}
    </div>
  `;
}

/** 复制：掺量显示为百分比，保留1位小数 */
function buildCopyText(best, target){
  const usedRows = pigments
    .map((p,i)=>({name: pigmentName(p), v:best.D[i]}))
    .filter(x=>x.v>1e-8);

  let lines = [];
  lines.push(`${t("result.baseline")}: L* ${LAB0.L} / a* ${LAB0.a} / b* ${LAB0.b}`);
  lines.push(`${t("result.targetLine")}: L* ${fmt(target[0])} / a* ${fmt(target[1])} / b* ${fmt(target[2])}`);
  lines.push(`${t("result.recommendation")}: ΔE*ab(76) = ${fmt(best.dE,3)}`);
  lines.push(`${t("result.predictedLine")}: L* ${fmt(best.pred[0])} / a* ${fmt(best.pred[1])} / b* ${fmt(best.pred[2])}`);
  lines.push(`${t("result.dosageLine")}:`);

  if(usedRows.length===0) lines.push(`  (${t("result.noneShort")})`);

  usedRows.forEach(r => lines.push(`  - ${r.name}: ${fmt(r.v * 100, 1)} %`));
  return lines.join("\n");
}

$("btnCalc").addEventListener("click", ()=>{
  const Lt = parseFloat($("Lt").value);
  const at = parseFloat($("at").value);
  const bt = parseFloat($("bt").value);

  if(!isFinite(Lt) || !isFinite(at) || !isFinite(bt)){
    toast(t("messages.missingLab"));
    return;
  }

  $("badgeStatus").textContent = t("status.calculating");

  const sols = solveForTarget(Lt, at, bt);

  if(sols.length === 0){
    $("badgeStatus").textContent = t("status.noSolution");
    $("mainContent").innerHTML = `<div class="muted">${t("messages.noSolution")}</div>`;
    window.__last = null;
    toast(t("messages.noSolutionToast"));
    return;
  }

  const best = sols[0];
  const target = [Lt, at, bt];

  $("badgeStatus").textContent = `${t("status.completed")} · ΔE ${fmt(best.dE, 3)}`;
  $("mainContent").innerHTML = renderMain(best, target);

  window.__last = { best, target };
  toast(t("messages.completed"));
});

$("btnReset").addEventListener("click", ()=>{
  $("Lt").value = "";
  $("at").value = "";
  $("bt").value = "";
  $("badgeStatus").textContent = t("status.waiting");
  $("mainContent").innerHTML = `<div class="muted">${t("messages.initial")}</div>`;
  window.__last = null;
  toast(t("messages.cleared"));
});

$("btnCopy").addEventListener("click", async ()=>{
  if(!window.__last){
    toast(t("messages.nothingToCopy"));
    return;
  }
  const { best, target } = window.__last;
  const text = buildCopyText(best, target);

  try{
    await navigator.clipboard.writeText(text);
    toast(t("messages.copied"));
  }catch(e){
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    toast(t("messages.copied"));
  }
});
