const LAB0 = { L: 43.55, a: 2.23, b: 9.62 };

const pigments = [
  { key:"white", name:"钛白（Titanium white）" },
  { key:"black", name:"氧化铁黑（Iron oxide black）" },
  { key:"yellow", name:"氧化铁黄（Iron oxide yellow）" },
  { key:"blue", name:"氧化铁蓝（Iron oxide blue）" },
  { key:"red", name:"氧化铁红（Iron oxide red）" },
  { key:"green", name:"氧化铁绿（Iron oxide green）" },
];

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
    return `<div class="muted">未找到可行解（可能目标颜色超出该系数模型可达范围或需放宽约束）。</div>`;
  }

  let html = `
    <table class="pigment-table">
      <thead>
        <tr><th>颜料</th><th class="right">掺量（%）</th></tr>
      </thead>
      <tbody>
  `;
  for(const r of rows){
    html += `<tr><td>${r.p.name}</td><td class="right mono">${fmt(r.v * 100, 1)}</td></tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function renderMain(sol, target){
  const used = sol.D.filter(v=>v>1e-8).length;

  const kv = `
    <div class="kvs">
      <div class="kv">
        <div class="k">目标混凝土（输入）</div>
        <div class="v">L* ${fmt(target[0])} / a* ${fmt(target[1])} / b* ${fmt(target[2])}</div>
      </div>
      <div class="kv">
        <div class="k">预测修补色（输出）</div>
        <div class="v">L* ${fmt(sol.pred[0])} / a* ${fmt(sol.pred[1])} / b* ${fmt(sol.pred[2])}</div>
      </div>
      <div class="kv">
        <div class="k">使用颜料种数</div>
        <div class="v">${used} 种（≤ ${MAX_PIGMENTS}）</div>
      </div>
      <div class="kv">
        <div class="k">色差 ΔE*ab(76)</div>
        <div class="v">${fmt(sol.dE, 3)}</div>
      </div>
    </div>
  `;

  return `
    ${kv}
    <div style="margin-top:10px;">
      <div class="small muted">推荐掺量（仅列出非零项）</div>
      ${buildPigmentRows(sol.D)}
    </div>
  `;
}

/** 复制：掺量显示为百分比，保留1位小数 */
function buildCopyText(best, target){
  const usedRows = pigments.map((p,i)=>({name:p.name, v:best.D[i]})).filter(x=>x.v>1e-8);
  let lines = [];
  lines.push(`MPC基准色：L* ${LAB0.L} / a* ${LAB0.a} / b* ${LAB0.b}`);
  lines.push(`目标混凝土：L* ${fmt(target[0])} / a* ${fmt(target[1])} / b* ${fmt(target[2])}`);
  lines.push(`推荐方案：ΔE*ab(76) = ${fmt(best.dE,3)}`);
  lines.push(`预测修补色：L* ${fmt(best.pred[0])} / a* ${fmt(best.pred[1])} / b* ${fmt(best.pred[2])}`);
  lines.push(`掺量（%）：`);
  if(usedRows.length===0) lines.push(`  （无）`);
  usedRows.forEach(r => lines.push(`  - ${r.name}: ${fmt(r.v * 100, 1)} %`));
  return lines.join("\n");
}

$("btnCalc").addEventListener("click", ()=>{
  const Lt = parseFloat($("Lt").value);
  const at = parseFloat($("at").value);
  const bt = parseFloat($("bt").value);

  if(!isFinite(Lt) || !isFinite(at) || !isFinite(bt)){
    toast("请完整输入目标混凝土的 L*、a*、b*（数值）。");
    return;
  }

  $("badgeStatus").textContent = "计算中…";

  const sols = solveForTarget(Lt, at, bt);

  if(sols.length === 0){
    $("badgeStatus").textContent = "无可行解";
    $("mainContent").innerHTML = `<div class="muted">未找到满足约束（n≤3、0≤D&lt;12%）的可行解。</div>`;
    window.__last = null;
    toast("未找到可行解。可尝试调整目标或约束/系数。");
    return;
  }

  const best = sols[0];
  const target = [Lt, at, bt];

  $("badgeStatus").textContent = `已完成 · ΔE ${fmt(best.dE,3)}`;
  $("mainContent").innerHTML = renderMain(best, target);

  window.__last = { best, target };
  toast("计算完成：已输出推荐掺量。");
});

$("btnReset").addEventListener("click", ()=>{
  $("Lt").value = "";
  $("at").value = "";
  $("bt").value = "";
  $("badgeStatus").textContent = "等待输入";
  $("mainContent").innerHTML = `<div class="muted">请输入目标混凝土 L*、a*、b* 后点击“计算”。</div>`;
  window.__last = null;
  toast("已清空。");
});

$("btnCopy").addEventListener("click", async ()=>{
  if(!window.__last){
    toast("暂无可复制的结果，请先计算。");
    return;
  }
  const { best, target } = window.__last;
  const text = buildCopyText(best, target);

  try{
    await navigator.clipboard.writeText(text);
    toast("已复制结果到剪贴板。");
  }catch(e){
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    toast("已复制结果到剪贴板。");
  }
});
