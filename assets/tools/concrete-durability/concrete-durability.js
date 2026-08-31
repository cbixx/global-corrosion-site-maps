const ids = [
  'projectName','memberName','builtYear','detectYear','targetLife','gamma0','region','cover','fcu','diameter','temperature','humidity',
  'xc','carbonNeedCornerCorrection','generalMemberEnv','general_m','k_manual','useAppendixB','CO2_percent','KCO2_manual','KCO2_autoType','isCornerZone','isCastingFace','stressState','flyAshPercent','appendixB_envMultiplier',
  'Cs_meas','Cx_meas','x_depth','C0','ch_grade','ch_zoneType','ch_memberType','ch_isCornerBar','ch_D_manual','ch_ignoreTimeDependence','ch_D0_fromMeasured','ch_D0_fromWC','ch_wb','ch_Fb','ch_Sb','ch_freezeAmp','ch_t1_manual','ch_Cs_manual','ch_Ccr_manual','ch_beta1_env',
  'alphaFT','dFT','dFTmax','freeze_memberClass','freeze_corrosionRoute','freeze_m_general','freeze_k_mult'
];
const defaultValues = {};
ids.forEach(id => {
  const el = document.getElementById(id);
  defaultValues[id] = el.type === 'checkbox' ? el.checked : el.value;
});
let lastResultText = '';

document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click',()=>switchTab(btn.dataset.tab));
});
function switchTab(tab){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active', p.id === 'tab-'+tab));
}
function n(id){
  const v = parseFloat(document.getElementById(id).value);
  return Number.isFinite(v) ? v : 0;
}
function s(id){return document.getElementById(id).value;}
function b(id){return document.getElementById(id).checked;}
function collectInputs(){
  return {
    basic:{projectName:s('projectName'),memberName:s('memberName'),builtYear:n('builtYear'),detectYear:n('detectYear'),targetLife:n('targetLife'),gamma0:n('gamma0'),region:s('region')},
    common:{cover:n('cover'),fcu:n('fcu'),diameter:n('diameter'),temperature:n('temperature'),humidity:n('humidity')},
    inspect:{xc:n('xc'),carbonNeedCornerCorrection:b('carbonNeedCornerCorrection'),Cs_meas:n('Cs_meas'),Cx_meas:n('Cx_meas'),x_depth:n('x_depth'),C0:n('C0'),alphaFT:n('alphaFT'),dFT:n('dFT'),dFTmax:n('dFTmax')},
    general:{memberEnv:s('generalMemberEnv'),m:n('general_m'),k_manual:n('k_manual'),useAppendixB:b('useAppendixB'),CO2_percent:n('CO2_percent'),KCO2_manual:n('KCO2_manual'),KCO2_autoType:s('KCO2_autoType'),isCornerZone:b('isCornerZone'),isCastingFace:b('isCastingFace'),stressState:s('stressState'),flyAshPercent:n('flyAshPercent'),appendixB_envMultiplier:n('appendixB_envMultiplier')},
    chloride:{grade:s('ch_grade'),zoneType:s('ch_zoneType'),memberType:s('ch_memberType'),isCornerBar:b('ch_isCornerBar'),D_manual:n('ch_D_manual'),ignoreTimeDependence:b('ch_ignoreTimeDependence'),D0_fromMeasured:b('ch_D0_fromMeasured'),D0_fromWC:b('ch_D0_fromWC'),waterBinder:n('ch_wb'),flyAshPct:n('ch_Fb'),slagPct:n('ch_Sb'),freezeAmp:n('ch_freezeAmp'),t1_manual:n('ch_t1_manual'),Cs_manual:n('ch_Cs_manual'),Ccr_manual:n('ch_Ccr_manual'),beta1_env:s('ch_beta1_env')},
    freeze:{memberClass:s('freeze_memberClass'),corrosionRoute:s('freeze_corrosionRoute'),m_generalFreeze:n('freeze_m_general'),k_freezeMultiplier:n('freeze_k_mult')},
    result:{}
  };
}

function validateInputs(data){
  if(!data.basic.projectName.trim()) throw new Error('工程名称不能为空。');
  if(data.basic.builtYear <= 1900 || data.basic.detectYear < data.basic.builtYear) throw new Error('建成年份/检测年份填写不合理。');
  if(data.basic.targetLife <= 0) throw new Error('整体使用年限必须大于0。');
  if(getRemainingTargetLife(data) <= 0) throw new Error('剩余目标使用年限 te = 整体使用年限 - 建成至检测时间，计算结果必须大于0。请检查整体使用年限、建成年份和检测年份。');
  if(data.common.cover <= 0 || data.common.fcu <= 0 || data.common.diameter <= 0) throw new Error('保护层厚度、混凝土强度、钢筋直径必须大于0。');
}
function getServiceAge(data){return data.basic.detectYear - data.basic.builtYear;}
function getRemainingTargetLife(data){return data.basic.targetLife - getServiceAge(data);}
function updateRemainingLifeDisplay(){
  const el=document.getElementById('remainingLifeDisplay');
  if(!el) return;
  const data=collectInputs();
  const t0=getServiceAge(data), te=getRemainingTargetLife(data);
  el.value = Number.isFinite(te) ? `${te.toFixed(3)}  （${data.basic.targetLife} - ${t0}）` : '';
}
['builtYear','detectYear','targetLife'].forEach(id=>{const el=document.getElementById(id); if(el) el.addEventListener('input', updateRemainingLifeDisplay);});
function gradeToNum(g){g=String(g).toLowerCase();return g==='a'?1:(g==='b'?2:3);}
function numToGrade(num){return num===1?'a':(num===2?'b':'c');}
function xiToGrade(xi){return xi>=1.8?'a':(xi>=1.0?'b':'c');}
function segmentIndex(arr, q){
  if(arr.length < 2) throw new Error('插值表至少需要两个点。');
  if(q <= arr[0]) return 0;
  if(q >= arr[arr.length-1]) return arr.length-2;
  for(let i=0;i<arr.length-1;i++){
    if(q>=arr[i] && q<=arr[i+1]) return i;
  }
  return arr.length-2;
}
function interp1_clip(x,v,xq){
  // 一维读表：线性插值；超出表格范围时，使用相邻两点线性外推，不截断。
  const i=segmentIndex(x,xq);
  const t=(xq-x[i])/(x[i+1]-x[i]);
  return v[i]+t*(v[i+1]-v[i]);
}
function interp2_clip(x,y,M,xq,yq){
  // 二维读表：双线性插值；超出表格范围时，使用边界相邻两点线性外推，不截断。
  const ix=segmentIndex(x,xq), iy=segmentIndex(y,yq);
  const x1=x[ix], x2=x[ix+1], y1=y[iy], y2=y[iy+1];
  const q11=M[iy][ix], q21=M[iy][ix+1], q12=M[iy+1][ix], q22=M[iy+1][ix+1];
  const tx=(xq-x1)/(x2-x1), ty=(yq-y1)/(y2-y1);
  return q11*(1-tx)*(1-ty)+q21*tx*(1-ty)+q12*(1-tx)*ty+q22*tx*ty;
}
function erf(x){
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const t=1/(1+p*x);
  const y=1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return sign*y;
}
function erfinv(x){
  if(x<=-1) return -Infinity;
  if(x>=1) return Infinity;
  if(x===0) return 0;
  const a=0.147;
  const sign=x<0?-1:1;
  const ln=Math.log(1-x*x);
  const first=2/(Math.PI*a)+ln/2;
  let y=sign*Math.sqrt(Math.sqrt(first*first-ln/a)-first);
  for(let i=0;i<3;i++){
    const err=erf(y)-x;
    y = y - err / ((2/Math.sqrt(Math.PI))*Math.exp(-y*y));
  }
  return y;
}
function fzeroBisection(f,lb,ub){
  let fl=f(lb), fu=f(ub);
  if(fl*fu>0) return null;
  for(let i=0;i<120;i++){
    const mid=(lb+ub)/2, fm=f(mid);
    if(Math.abs(fm)<1e-10 || Math.abs(ub-lb)<1e-8) return mid;
    if(fl*fm<=0){ub=mid;fu=fm;}else{lb=mid;fl=fm;}
  }
  return (lb+ub)/2;
}
function clone(obj){return JSON.parse(JSON.stringify(obj));}

function runAssessment(data){
  validateInputs(data);
  const result={projectName:data.basic.projectName, memberName:data.basic.memberName, t0:getServiceAge(data), totalLife:data.basic.targetLife, te:getRemainingTargetLife(data)};
  const modules=[], gradesNum=[];
  const hasGeneral = data.general.k_manual>0 || data.inspect.xc>0 || data.general.useAppendixB;
  const hasChloride = data.chloride.D_manual>0 || data.chloride.D0_fromMeasured || data.chloride.D0_fromWC || data.chloride.Cs_manual>0 || data.inspect.Cs_meas>0 || data.chloride.Ccr_manual>0;
  const hasFreeze = data.inspect.alphaFT>0 || data.inspect.dFT>0 || data.inspect.dFTmax>0;
  if(hasGeneral){const rg=calcGeneralModule(data, data.general.appendixB_envMultiplier);result.general=rg;modules.push('一般环境');gradesNum.push(gradeToNum(rg.worstGrade));}
  if(hasChloride){const rc=calcChlorideModule(data);result.chloride=rc;modules.push('氯盐环境');gradesNum.push(gradeToNum(rc.worstGrade));}
  if(hasFreeze){const rf=calcFreezeModule(data);result.freeze=rf;modules.push('冻融环境');gradesNum.push(gradeToNum(rf.worstGrade));}
  if(gradesNum.length===0) throw new Error('未检测到可参与计算的模块参数。请至少在“一般环境”“氯盐环境”或“冻融环境”页填写一组有效参数。');
  result.overallGrade=numToGrade(Math.max(...gradesNum));
  result.modules=modules;
  return result;
}

function calcGeneralModule(data, extraKMultiplier){
  const t0=getServiceAge(data), c=data.common.cover, fcu=data.common.fcu, d=data.common.diameter, T=data.common.temperature, RH=data.common.humidity;
  const m=data.general.m, gamma0=data.basic.gamma0, te=getRemainingTargetLife(data), memberEnv=data.general.memberEnv;
  let k, kSource;
  if(data.general.k_manual>0){k=data.general.k_manual;kSource='直接输入 k';}
  else if(data.inspect.xc>0){let xc=data.inspect.xc;if(data.inspect.carbonNeedCornerCorrection) xc=1.4*xc;k=xc/Math.sqrt(t0);kSource='按 5.2.3 实测反算 k';}
  else if(data.general.useAppendixB){k=calc_k_by_AppendixB(data)*extraKMultiplier;kSource='按附录B计算 k';}
  else throw new Error('一般环境模块：缺少碳化系数 k。请直接输入 k，或输入实测碳化深度，或勾选附录B。');

  const Kk=interp1_clip([1,2,3,4.5,6,7.5,9],[2.27,1.54,1.20,0.94,0.80,0.71,0.64],k);
  const Kc=interp1_clip([5,10,15,20,25,30,40],[0.54,0.75,1.00,1.29,1.62,1.96,2.67],c);
  const Km=interp1_clip([1,1.5,2,2.5,3,3.5,4.5],[1.51,1.24,1.06,0.94,0.85,0.78,0.68],m);
  const ti=15.2*Kk*Kc*Km;
  const xi_i=(ti-t0)/(gamma0*te), grade_i=xiToGrade(xi_i);

  const tr=get_tr_general(memberEnv);
  const Hc=getTable_Hc(memberEnv,c), Hf=getTable_Hf(memberEnv,fcu), Hd=getTable_Hd(memberEnv,d), HT=getTable_HT(memberEnv,T), HRH=getTable_HRH(memberEnv,RH), Hm=getTable_Hm(memberEnv,m);
  const tc=Hc*Hf*Hd*HT*HRH*Hm*tr;
  const tcr=ti+tc, xi_cr=(tcr-t0)/(gamma0*te), grade_cr=xiToGrade(xi_cr);

  const td0=get_td0_general(memberEnv);
  const Fc=getTable_Fc(memberEnv,c), Ff=getTable_Ff(memberEnv,fcu), Fd=getTable_Fd(memberEnv,d), FT=getTable_FT(memberEnv,T), FRH=getTable_FRH(memberEnv,RH), Fm=getTable_Fm(memberEnv,m);
  const tcl=Fc*Ff*Fd*FT*FRH*Fm*td0;
  const td=ti+tcl, xi_d=(td-t0)/(gamma0*te), grade_d=xiToGrade(xi_d);
  const worst=Math.max(gradeToNum(grade_i),gradeToNum(grade_cr),gradeToNum(grade_d));
  return {moduleName:'一般环境', k,kSource,Kk,Kc,Km,tr,Hc,Hf,Hd,HT,HRH,Hm,tc,td0,Fc,Ff,Fd,FT,FRH,Fm,tcl,ti,tcr,td,xi_i,xi_cr,xi_d,grade_i,grade_cr,grade_d,worstGrade:numToGrade(worst)};
}
function calc_k_by_AppendixB(data){
  const T=data.common.temperature, RHraw=data.common.humidity/100, fcu=data.common.fcu, CCO2=data.general.CO2_percent, fly=data.general.flyAshPercent;
  let KCO2;
  if(data.general.KCO2_manual>0) KCO2=data.general.KCO2_manual;
  else {KCO2=getKCO2_mid_by_type(data.general.KCO2_autoType); if(CCO2>0) KCO2=Math.sqrt(CCO2/0.03);}
  const Kkl=data.general.isCornerZone?1.4:1.0;
  const Kt=data.general.isCastingFace?1.2:1.0;
  const Ks=data.general.stressState==='受拉'?1.1:1.0;
  const KF=interp1_clip([0,10,20,30,40,50],[1.0,1.01,1.07,1.25,1.65,2.35],fly);
  const RH=Math.min(Math.max(RHraw,0.40),0.99);
  const term=58/fcu-0.76;
  if(term<=0) throw new Error('附录B计算 k 时，(58/f_cu,e - 0.76) <= 0，请检查强度取值。');
  return 3*KCO2*Kkl*Kt*Ks*KF*Math.pow(T,0.25)*Math.pow(RH,1.5)*(1-RH)*term;
}
function getKCO2_mid_by_type(tp){
  switch(tp){
    case '工业建筑室外-城镇':return (1.1+1.2)/2;
    case '工业建筑室外-大中城市市区':return (1.2+1.4)/2;
    case '民用建筑室内-人群稀少':return (1.1+1.4)/2;
    case '民用建筑室内-一般':return (1.5+1.8)/2;
    case '民用建筑室内-较密集':return (1.8+2.1)/2;
    case '民用建筑室内-密集':return (2.1+2.4)/2;
    default:return 1.0;
  }
}

function calcChlorideModule(data){
  const t0=getServiceAge(data), c=data.common.cover, fcu=data.common.fcu, gamma0=data.basic.gamma0, te=getRemainingTargetLife(data), region=data.basic.region, C0=data.inspect.C0;
  const D=get_D_chloride(data,t0), t1=get_t1_value(data), Cs=get_Cs_value(data), Ccr=get_Ccr_value(data);
  if(Cs<=0 || Ccr<=0) throw new Error('氯盐环境模块：C_s 或 C_cr 无法确定。');
  let ratio=(Ccr-C0)/Math.max((Cs-C0), Number.EPSILON);
  ratio=Math.min(Math.max(ratio,0.001),0.999);
  const eta=erfinv(1-ratio);
  const K=2*Math.sqrt(D)*eta;
  let ti, xi_i;
  if(data.inspect.C0>Ccr){ti=0;xi_i=Ccr/(gamma0*data.inspect.C0);} 
  else {
    if(data.chloride.ignoreTimeDependence){ti=Math.pow(c/K,2)*1e-6+0.2*t1;}
    else {const [D0,a]=get_D0_and_a(data,t0); ti=solve_ti_time_dependent(c,D0,a,t0,t1,ratio);}
    xi_i=(ti-t0)/(gamma0*te);
  }
  const grade_i=xiToGrade(xi_i);
  const beta1=get_beta1_value(data.chloride.beta1_env,fcu);
  const beta2=data.chloride.isCornerBar?1.2:1.3;
  let tc0=get_tc0_chloride(region,data.chloride.memberType,c,fcu);
  const tc0_raw=tc0;
  let tc0NearSeaFactor=1.0;
  if(data.chloride.zoneType==='近海大气环境') {tc0NearSeaFactor=Math.sqrt(10/Cs); tc0=tc0*tc0NearSeaFactor;}
  const tc=beta1*beta2*tc0;
  const tcr=ti+tc, xi_cr=(tcr-t0)/(gamma0*te), grade_cr=xiToGrade(xi_cr);
  const worst=Math.max(gradeToNum(grade_i),gradeToNum(grade_cr));
  return {moduleName:'氯盐环境',D,t1,Cs,Ccr,K,beta1,beta2,tc0_raw,tc0NearSeaFactor,tc0,tc,ti,tcr,xi_i,xi_cr,grade_i,grade_cr,worstGrade:numToGrade(worst)};
}
function get_D_chloride(data,t0){
  if(data.chloride.D_manual>0) return data.chloride.D_manual;
  const [D0,a]=get_D0_and_a(data,t0);
  if(data.chloride.ignoreTimeDependence || no_need_time_dependence(data)) return D0;
  return D0*Math.pow(t0/Math.max(t0,1),a);
}
function get_D0_and_a(data,t0){
  const a=0.2+0.4*(data.chloride.flyAshPct/50+data.chloride.slagPct/70);
  let D0;
  if(data.chloride.D0_fromMeasured){
    const x=data.inspect.x_depth, Cxt=data.inspect.Cx_meas, Cs=get_Cs_value(data);
    if(x<=0 || Cxt<=0 || Cs<=0) throw new Error('要按实测反推 D0，请填写 x、C(x,t0)、C_s。');
    const eta=erfinv(1-Cxt/Cs);
    if(Math.abs(eta)<1e-8) throw new Error('实测数据导致 erf^{-1}(1-C/Cs) 接近0，无法反推 D0。');
    D0=(x*x*1e-6)/(4*t0*eta*eta);
  } else if(data.chloride.D0_fromWC){
    const wb=data.chloride.waterBinder, T=data.common.temperature;
    D0=(7.08*wb-1.846)*(0.0447*T-0.052)*1e-3;
    if(D0<=0) throw new Error('按经验式计算 D0 <= 0，请检查水胶比/温度。');
  } else throw new Error('氯盐环境模块：请直接输入 D，或勾选“由实测反推 D0”，或勾选“由经验式计算 D0”。');
  return [D0*data.chloride.freezeAmp,a];
}
function no_need_time_dependence(data){return getServiceAge(data)>=10 || data.chloride.waterBinder>=0.55;}
function solve_ti_time_dependent(c,D0,a,t0,t1,ratio){
  const eta=erfinv(1-ratio);
  const A=(c*c)*1e-6/(4*D0*eta*eta*Math.pow(t0,a));
  const f=tt=>tt-A*Math.pow(tt,a)-0.2*t1;
  const lb=Math.max(0.01,0.2*t1+1e-3), ub=1e4;
  const root=fzeroBisection(f,lb,ub);
  if(root===null){const K=2*Math.sqrt(D0)*eta; return Math.pow(c/K,2)*1e-6+0.2*t1;}
  return root;
}
function get_t1_value(data){
  if(data.chloride.t1_manual>0) return data.chloride.t1_manual;
  switch(data.chloride.grade){case 'III-A':return 25;case 'III-B':return 17.5;case 'III-C':return 12.5;case 'III-D':return 10;case 'III-E':return 5;case 'III-F':return 0;default:throw new Error('未知环境等级。');}
}
function get_Cs_value(data){
  if(data.chloride.Cs_manual>0) return data.chloride.Cs_manual;
  if(data.inspect.Cs_meas>0) return data.inspect.Cs_meas;
  switch(data.chloride.grade){case 'III-F':return 17.0;case 'III-E':return 11.5;case 'III-D':return 5.87;case 'III-C':return 3.83;case 'III-B':return 2.57;case 'III-A':return 1.28;default:return 0;}
}
function get_Ccr_value(data){
  if(data.chloride.Ccr_manual>0) return data.chloride.Ccr_manual;
  const fcu=data.common.fcu, zone=data.chloride.zoneType, grade=data.chloride.grade;
  if(zone==='除冰盐环境') return 1.70;
  if(['III-A','III-B','III-C','III-D','III-E'].includes(grade)) return 2.10;
  return interp1_clip([30,35,40],[1.30,1.50,1.70],fcu);
}
function get_beta1_value(beta1Env,fcu){
  const x=[25,30,35,40];
  const y=beta1Env==='近海大气环境'?[1.25,1.15,1.10,1.05]:[1.35,1.25,1.15,1.10];
  return interp1_clip(x,y,fcu);
}
function get_tc0_chloride(region,memberType,c,fcu){
  const covers=[20,30,40,50,60,70], fList=[25,30,35,40];
  const south_beam=[[1.6,2.1,2.5,3.1,3.5,3.9],[1.8,2.4,2.9,3.4,3.9,4.4],[2.0,2.6,3.1,3.5,4.1,4.6],[2.3,2.9,3.4,4.0,4.4,4.9]];
  const south_wall=[[2.0,2.7,3.6,4.5,5.5,6.6],[2.3,3.1,4.0,5.0,6.1,7.2],[2.6,3.4,4.3,5.4,6.5,7.7],[2.9,3.8,4.9,5.9,7.1,8.2]];
  const north_beam=[[2.8,3.6,4.4,5.2,6.0,6.8],[3.1,4.0,4.9,5.8,6.6,7.4],[3.4,4.4,5.3,6.2,7.0,7.7],[3.9,4.9,5.8,6.7,7.5,8.4]];
  const north_wall=[[3.4,4.7,6.1,7.7,9.5,11.0],[3.9,5.3,6.8,8.5,10.4,12.3],[4.4,5.8,7.4,9.2,11.1,13.1],[5.0,6.6,8.3,10.1,12.1,14.3]];
  let mat=region==='南方'?(memberType==='墙板'?south_wall:south_beam):(memberType==='墙板'?north_wall:north_beam);
  return interp2_clip(covers,fList,mat,c,fcu);
}

function calcFreezeModule(data){
  const c=data.common.cover, alpha=data.inspect.alphaFT, dft=data.inspect.dFT, dftm=data.inspect.dFTmax;
  const [grade_spall,spallingExplain]=get_freeze_spalling_grade(data.freeze.memberClass,alpha,dft,dftm,c);
  const s2=clone(data);
  let grade_corrosion, corrosionExplain, corrosionDetail;
  if(data.freeze.corrosionRoute==='一般冻融环境'){
    s2.general.m=data.freeze.m_generalFreeze;
    const rg=calcGeneralModule(s2,data.freeze.k_freezeMultiplier);
    grade_corrosion=rg.worstGrade; corrosionExplain='按 7.3.1 调用第5章（一般环境）进行钢筋开始锈蚀与保护层开裂评定。'; corrosionDetail=rg;
  } else {
    s2.chloride.zoneType=data.freeze.corrosionRoute==='寒冷地区海洋环境'?'海洋环境':'除冰盐环境';
    const rc=calcChlorideModule(s2);
    grade_corrosion=rc.worstGrade; corrosionExplain='按 7.3.2/7.3.3 调用第6章（氯盐环境）进行钢筋开始锈蚀与保护层开裂评定。'; corrosionDetail=rc;
  }
  const worst=Math.max(gradeToNum(grade_spall),gradeToNum(grade_corrosion));
  return {moduleName:'冻融环境',grade_spall,grade_corrosion,spallingExplain,corrosionExplain,corrosionDetail,worstGrade:numToGrade(worst)};
}
function get_freeze_spalling_grade(memberClass,alpha,dft,dftmax,c){
  const r1=alpha, r2=100*dft/c, r3=100*dftmax/c;
  let grade, explain;
  if(memberClass==='一般构件'){
    if(r1<1 && r2<10 && r3<15) grade='a';
    else if((r1>=1 && r1<=5)||(r2>=10 && r2<=50)||(r3>=15 && r3<=75)) grade='b';
    else grade='c';
    explain=`一般构件：α_FT=${fmt(r1,2)}%，d_FT/c=${fmt(r2,2)}%，d_FT,max/c=${fmt(r3,2)}%。`;
  } else {
    if(r1<1 && r2<10 && r3<10) grade='a';
    else if((r1>=1 && r1<5) && (r2<10) && (r3<10)) grade='b';
    else grade='c';
    explain=`薄壁构件：α_FT=${fmt(r1,2)}%，d_FT/c=${fmt(r2,2)}%，d_FT,max/c=${fmt(r3,2)}%。`;
  }
  return [grade,explain];
}

function parseMemberEnv(memberEnv){return {indoor:memberEnv.includes('室内'), wall:memberEnv.includes('墙板')};}
function get_tr_general(memberEnv){switch(memberEnv){case '室外-梁柱':return 1.9;case '室外-墙板':return 4.9;case '室内-梁柱':return 3.8;case '室内-墙板':return 11.0;default:return 1.9;}}
function get_td0_general(memberEnv){switch(memberEnv){case '室外-梁柱':return 7.04;case '室外-墙板':return 8.09;case '室内-梁柱':return 8.84;case '室内-墙板':return 14.48;default:return 7.04;}}
function getTable_Hc(memberEnv,c){const x=[5,10,15,20,25,30,40],p=parseMemberEnv(memberEnv);let y;if(!p.indoor&&!p.wall)y=[0.38,0.68,1.00,1.34,1.70,2.09,2.93];if(!p.indoor&&p.wall)y=[0.33,0.62,1.00,1.48,2.07,2.79,4.62];if(p.indoor&&!p.wall)y=[0.37,0.68,1.00,1.35,1.73,2.13,3.02];if(p.indoor&&p.wall)y=[0.31,0.61,1.00,1.51,2.14,2.92,4.91];return interp1_clip(x,y,c);}
function getTable_Hf(memberEnv,fcu){const x=[10,15,20,25,30,35,40],p=parseMemberEnv(memberEnv);let y;if(!p.indoor&&!p.wall)y=[0.21,0.47,0.86,1.39,2.08,2.94,3.99];if(!p.indoor&&p.wall)y=[0.17,0.41,0.76,1.26,1.92,2.76,3.79];if(p.indoor&&!p.wall)y=[0.21,0.48,0.89,1.44,2.15,3.04,4.13];if(p.indoor&&p.wall)y=[0.17,0.41,0.77,1.27,1.94,2.79,3.83];return interp1_clip(x,y,fcu);}
function getTable_Hd(memberEnv,d){const x=[4,8,12,16,20,25,28,32],p=parseMemberEnv(memberEnv);let y;if(!p.indoor&&!p.wall)y=[2.43,1.66,1.40,1.27,1.19,1.13,1.10,1.05];if(!p.indoor&&p.wall)y=[4.65,2.11,1.50,1.25,1.12,1.02,0.99,0.97];if(p.indoor&&!p.wall)y=[2.23,1.52,1.29,1.17,1.10,1.04,1.02,0.99];if(p.indoor&&p.wall)y=[4.10,1.87,1.34,1.11,1.00,0.92,0.88,0.85];return interp1_clip(x,y,d);}
function getTable_HT(memberEnv,T){const x=[4,8,12,16,20,24,28],p=parseMemberEnv(memberEnv);let y;if(!p.indoor&&!p.wall)y=[1.50,1.42,1.34,1.27,1.20,1.15,1.09];if(!p.indoor&&p.wall)y=[1.39,1.31,1.24,1.17,1.11,1.06,1.01];if(p.indoor&&!p.wall)y=[1.39,1.31,1.24,1.17,1.11,1.06,1.01];if(p.indoor&&p.wall)y=[1.25,1.19,1.11,1.05,1.00,0.95,0.91];return interp1_clip(x,y,T);}
function getTable_HRH(memberEnv,RH){const x=[55,60,65,70,75,80,85],p=parseMemberEnv(memberEnv);let y;if(!p.indoor&&!p.wall)y=[2.40,1.83,1.51,1.30,1.15,1.041,1.041];if(!p.indoor&&p.wall)y=[2.23,1.70,1.40,1.21,1.07,0.97,0.97];if(p.indoor&&!p.wall)y=[3.04,1.91,1.46,1.21,1.04,0.92,0.92];if(p.indoor&&p.wall)y=[2.75,1.73,1.32,1.09,0.94,0.83,0.83];return interp1_clip(x,y,RH);}
function getTable_Hm(memberEnv,m){const x=[1.0,1.5,2.0,2.5,3.0,3.5,4.5],p=parseMemberEnv(memberEnv);let y;if(!p.indoor&&!p.wall)y=[3.74,2.49,1.87,1.50,1.25,1.07,0.83];if(!p.indoor&&p.wall)y=[3.50,2.33,1.75,1.40,1.17,1.00,0.78];if(p.indoor&&!p.wall)y=[3.40,2.27,1.70,1.36,1.13,0.97,0.76];if(p.indoor&&p.wall)y=[3.09,2.06,1.55,1.24,1.03,0.88,0.69];return interp1_clip(x,y,m);}
function getTable_Fc(memberEnv,c){const x=[5,10,15,20,25,30,40],p=parseMemberEnv(memberEnv);let y;if(!p.indoor&&!p.wall)y=[0.57,0.87,1.00,1.17,1.36,1.54,1.91];if(!p.indoor&&p.wall)y=[0.58,0.77,1.00,1.24,1.49,1.76,2.35];if(p.indoor&&!p.wall)y=[0.59,0.78,1.00,1.23,1.48,1.69,2.13];if(p.indoor&&p.wall)y=[0.47,0.74,1.00,1.26,1.53,1.82,2.45];return interp1_clip(x,y,c);}
function getTable_Ff(memberEnv,fcu){const x=[10,15,20,25,30,35,40],p=parseMemberEnv(memberEnv);let y;if(!p.indoor&&!p.wall)y=[0.29,0.60,0.92,1.25,1.64,2.16,2.78];if(!p.indoor&&p.wall)y=[0.31,0.59,0.89,1.29,1.81,2.46,3.24];if(p.indoor&&!p.wall)y=[0.34,0.62,0.93,1.33,1.85,2.49,3.24];if(p.indoor&&p.wall)y=[0.31,0.56,0.89,1.35,1.94,2.66,3.52];return interp1_clip(x,y,fcu);}
function getTable_Fd(memberEnv,d){const x=[4,8,12,16,20,25,28,32],p=parseMemberEnv(memberEnv);let y;if(!p.indoor&&!p.wall)y=[0.86,1.11,1.33,1.29,1.26,1.23,1.22,1.21];if(!p.indoor&&p.wall)y=[0.91,1.44,1.47,1.36,1.30,1.26,1.24,1.22];if(p.indoor&&!p.wall)y=[0.94,1.14,1.32,1.27,1.24,1.21,1.20,1.19];if(p.indoor&&p.wall)y=[0.92,1.40,1.41,1.29,1.23,1.19,1.17,1.15];return interp1_clip(x,y,d);}
function getTable_FT(memberEnv,T){const x=[4,8,12,16,20,24,28],p=parseMemberEnv(memberEnv);let y;if(!p.indoor&&!p.wall)y=[1.39,1.33,1.27,1.22,1.18,1.13,1.10];if(!p.indoor&&p.wall)y=[1.48,1.41,1.34,1.27,1.22,1.16,1.12];if(p.indoor&&!p.wall)y=[1.42,1.34,1.28,1.22,1.16,1.12,1.07];if(p.indoor&&p.wall)y=[1.43,1.35,1.28,1.22,1.16,1.11,1.06];return interp1_clip(x,y,T);}
function getTable_FRH(memberEnv,RH){const x=[55,60,65,70,75,80,85],p=parseMemberEnv(memberEnv);let y;if(!p.indoor&&!p.wall)y=[2.07,1.64,1.40,1.24,1.13,1.06,1.06];if(!p.indoor&&p.wall)y=[2.30,1.79,1.50,1.31,1.18,1.08,1.08];if(p.indoor&&!p.wall)y=[2.95,1.91,1.49,1.26,1.11,1.00,1.00];if(p.indoor&&p.wall)y=[3.08,1.96,1.51,1.26,1.10,0.98,0.98];return interp1_clip(x,y,RH);}
function getTable_Fm(memberEnv,m){const x=[1.0,1.5,2.0,2.5,3.0,3.5,4.5],p=parseMemberEnv(memberEnv);let y;if(!p.indoor&&!p.wall)y=[3.10,2.14,1.67,1.38,1.20,1.06,0.88];if(!p.indoor&&p.wall)y=[3.53,2.39,1.82,1.49,1.26,1.10,0.89];if(p.indoor&&!p.wall)y=[3.27,2.23,1.71,1.40,1.19,1.05,0.85];if(p.indoor&&p.wall)y=[3.43,2.30,1.75,1.41,1.19,1.03,0.82];return interp1_clip(x,y,m);}

function fmt(v,d=3){return Number.isFinite(v)?Number(v).toFixed(d):String(v);}
function gradeSpan(g){return `<span class="grade grade-${String(g).toLowerCase()}">${String(g).toUpperCase()}</span>`;}
function line(t){return `<div class="result-line">${t}</div>`;}
function card(title,content){return `<div class="result-card"><h3>${title}</h3>${content}</div>`;}
function renderResult(r){
  let html=`<div class="success">计算完成。综合评定等级（按最不利模块） = ${gradeSpan(r.overallGrade)}</div>`;
  html+=card('基本信息', line(`工程名称：${escapeHtml(r.projectName)}`)+line(`构件名称：${escapeHtml(r.memberName)}`)+line(`建成至检测时间 t₀ = ${fmt(r.t0,0)} a`)+line(`整体使用年限 T_total = ${fmt(r.totalLife,0)} a`)+line(`剩余目标使用年限 tₑ = ${fmt(r.te,3)} a`)+line(`参与评定模块：${r.modules.join('、')}`));
  if(r.general){const g=r.general;html+=card('一般环境（第5章）', line(`k = ${fmt(g.k,6)} mm/√a（${g.kSource}）`)+line(`钢筋开始锈蚀 tᵢ = ${fmt(g.ti)} a；ξ = ${fmt(g.xi_i)}；等级 = ${gradeSpan(g.grade_i)}`)+line(`保护层锈胀开裂 tcr = ${fmt(g.tcr)} a；ξ = ${fmt(g.xi_cr)}；等级 = ${gradeSpan(g.grade_cr)}`)+line(`裂缝宽度限值 td = ${fmt(g.td)} a；ξ = ${fmt(g.xi_d)}；等级 = ${gradeSpan(g.grade_d)}`)+line(`中间系数：Kk=${fmt(g.Kk,4)}，Kc=${fmt(g.Kc,4)}，Km=${fmt(g.Km,4)}`)+line(`锈胀开裂系数：tr=${fmt(g.tr,4)}，Hc=${fmt(g.Hc,4)}，Hf=${fmt(g.Hf,4)}，Hd=${fmt(g.Hd,4)}，HT=${fmt(g.HT,4)}，HRH=${fmt(g.HRH,4)}，Hm=${fmt(g.Hm,4)}，tc=${fmt(g.tc,4)} a`)+line(`裂缝宽度系数：td0=${fmt(g.td0,4)}，Fc=${fmt(g.Fc,4)}，Ff=${fmt(g.Ff,4)}，Fd=${fmt(g.Fd,4)}，FT=${fmt(g.FT,4)}，FRH=${fmt(g.FRH,4)}，Fm=${fmt(g.Fm,4)}，tcl=${fmt(g.tcl,4)} a`)+line(`模块最不利等级 = ${gradeSpan(g.worstGrade)}`));}
  if(r.chloride){const c=r.chloride;html+=card('氯盐环境（第6章）', line(`D = ${fmt(c.D,6)} m²/a`)+line(`t₁ = ${fmt(c.t1)} a；C_s = ${fmt(c.Cs)} kg/m³；C_cr = ${fmt(c.Ccr)} kg/m³`)+line(`K = ${fmt(c.K,6)} m/√a`)+line(`钢筋开始锈蚀 tᵢ = ${fmt(c.ti)} a；ξ = ${fmt(c.xi_i)}；等级 = ${gradeSpan(c.grade_i)}`)+line(`保护层锈胀开裂 tcr = ${fmt(c.tcr)} a；ξ = ${fmt(c.xi_cr)}；等级 = ${gradeSpan(c.grade_cr)}`)+line(`中间系数：β1=${fmt(c.beta1,4)}，β2=${fmt(c.beta2,4)}，tc0原始=${fmt(c.tc0_raw,4)} a，近海修正=${fmt(c.tc0NearSeaFactor,4)}，tc0=${fmt(c.tc0,4)} a，tc=${fmt(c.tc,4)} a`)+line(`模块最不利等级 = ${gradeSpan(c.worstGrade)}`));}
  if(r.freeze){const f=r.freeze;html+=card('冻融环境（第7章）', line(`表面剥落等级 = ${gradeSpan(f.grade_spall)}；${f.spallingExplain}`)+line(`钢筋锈蚀相关等级 = ${gradeSpan(f.grade_corrosion)}；${f.corrosionExplain}`)+line(`模块最不利等级 = ${gradeSpan(f.worstGrade)}`));}
  html+=card('说明', line('1) 构件耐久性等级按最不利极限状态确定。')+line('2) 局部环境系数 m、冻融放大系数等需结合现场调查合理取值。')+line('3) 本网页为单机版计算工具，可直接保存并在浏览器中打开。'));
  return html;
}
function formatResultText(r){
  const lines=[];
  lines.push('========== GB/T 51355-2019 耐久性评定结果 ==========');
  lines.push(`工程名称：${r.projectName}`); lines.push(`构件名称：${r.memberName}`); lines.push(`建成至检测时间 t0 = ${fmt(r.t0,0)} a`); lines.push(`整体使用年限 T_total = ${fmt(r.totalLife,0)} a`); lines.push(`剩余目标使用年限 te = ${fmt(r.te,3)} a`); lines.push(`综合评定等级（按最不利模块） = ${r.overallGrade}`); lines.push(' ');
  if(r.general){const g=r.general;lines.push('--- 一般环境（第5章） ---');lines.push(`k = ${fmt(g.k,6)} mm/sqrt(a)（${g.kSource}）`);lines.push(`钢筋开始锈蚀 t_i = ${fmt(g.ti)} a；ξ = ${fmt(g.xi_i)}；等级 = ${g.grade_i}`);lines.push(`保护层锈胀开裂 t_cr = ${fmt(g.tcr)} a；ξ = ${fmt(g.xi_cr)}；等级 = ${g.grade_cr}`);lines.push(`裂缝宽度限值 t_d = ${fmt(g.td)} a；ξ = ${fmt(g.xi_d)}；等级 = ${g.grade_d}`);lines.push(`中间系数：Kk=${fmt(g.Kk,4)}，Kc=${fmt(g.Kc,4)}，Km=${fmt(g.Km,4)}`);lines.push(`锈胀开裂系数：tr=${fmt(g.tr,4)}，Hc=${fmt(g.Hc,4)}，Hf=${fmt(g.Hf,4)}，Hd=${fmt(g.Hd,4)}，HT=${fmt(g.HT,4)}，HRH=${fmt(g.HRH,4)}，Hm=${fmt(g.Hm,4)}，tc=${fmt(g.tc,4)} a`);lines.push(`裂缝宽度系数：td0=${fmt(g.td0,4)}，Fc=${fmt(g.Fc,4)}，Ff=${fmt(g.Ff,4)}，Fd=${fmt(g.Fd,4)}，FT=${fmt(g.FT,4)}，FRH=${fmt(g.FRH,4)}，Fm=${fmt(g.Fm,4)}，tcl=${fmt(g.tcl,4)} a`);lines.push(`模块最不利等级 = ${g.worstGrade}`);lines.push(' ');}
  if(r.chloride){const c=r.chloride;lines.push('--- 氯盐环境（第6章） ---');lines.push(`D = ${fmt(c.D,6)} m^2/a`);lines.push(`t1 = ${fmt(c.t1)} a；C_s = ${fmt(c.Cs)} kg/m^3；C_cr = ${fmt(c.Ccr)} kg/m^3`);lines.push(`K = ${fmt(c.K,6)} m/sqrt(a)`);lines.push(`钢筋开始锈蚀 t_i = ${fmt(c.ti)} a；ξ = ${fmt(c.xi_i)}；等级 = ${c.grade_i}`);lines.push(`保护层锈胀开裂 t_cr = ${fmt(c.tcr)} a；ξ = ${fmt(c.xi_cr)}；等级 = ${c.grade_cr}`);lines.push(`中间系数：β1=${fmt(c.beta1,4)}，β2=${fmt(c.beta2,4)}，tc0原始=${fmt(c.tc0_raw,4)} a，近海修正=${fmt(c.tc0NearSeaFactor,4)}，tc0=${fmt(c.tc0,4)} a，tc=${fmt(c.tc,4)} a`);lines.push(`模块最不利等级 = ${c.worstGrade}`);lines.push(' ');}
  if(r.freeze){const f=r.freeze;lines.push('--- 冻融环境（第7章） ---');lines.push(`表面剥落等级 = ${f.grade_spall}；${f.spallingExplain}`);lines.push(`钢筋锈蚀相关等级 = ${f.grade_corrosion}；${f.corrosionExplain}`);lines.push(`模块最不利等级 = ${f.worstGrade}`);lines.push(' ');}
  lines.push('说明：'); lines.push('1) 构件耐久性等级按最不利极限状态确定。'); lines.push('2) 局部环境系数 m、冻融放大系数等需结合现场调查合理取值。'); lines.push('3) 本网页为单机版计算工具，可直接保存并在浏览器中打开。');
  return lines.join('\n');
}
function escapeHtml(str){return String(str).replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}

function setStatus(html){document.getElementById('status').innerHTML=html;}
function saveCurrent(){
  const pack={};
  ids.forEach(id=>{const el=document.getElementById(id);pack[id]=el.type==='checkbox'?el.checked:el.value;});
  localStorage.setItem('GBT51355_web_inputs', JSON.stringify(pack));
  setStatus('<div class="success">当前输入已保存到本机浏览器。</div>');
}
function loadSaved(){
  const raw=localStorage.getItem('GBT51355_web_inputs');
  if(!raw) return;
  try{const pack=JSON.parse(raw);Object.entries(pack).forEach(([id,val])=>{const el=document.getElementById(id);if(!el)return;if(el.type==='checkbox')el.checked=!!val;else el.value=val;});}catch(e){}
  updateRemainingLifeDisplay();
}
function resetDefaults(){
  ids.forEach(id=>{const el=document.getElementById(id);if(el.type==='checkbox')el.checked=!!defaultValues[id];else el.value=defaultValues[id];});
  localStorage.removeItem('GBT51355_web_inputs');
  updateRemainingLifeDisplay();
  document.getElementById('resultBox').innerHTML='已恢复默认值。';
  setStatus(''); switchTab('basic');
}
function calculate(){
  try{
    const data=collectInputs();
    const r=runAssessment(data);
    document.getElementById('resultBox').innerHTML=renderResult(r);
    lastResultText=formatResultText(r);
    setStatus('');
    switchTab('result');
  }catch(err){
    document.getElementById('resultBox').innerHTML=`<div class="error">${escapeHtml(err.message)}</div>`;
    lastResultText='';
    switchTab('result');
  }
}
function exportTxt(){
  if(!lastResultText){calculate(); if(!lastResultText) return;}
  const blob=new Blob([lastResultText],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  const isZh =
    document.documentElement.lang
      .toLowerCase()
      .startsWith('zh');

    a.download =
      isZh
        ? 'GBT51355_耐久性评定结果.txt'
        : 'GBT51355_Durability_Assessment_Result.txt';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
document.getElementById('saveBtn').addEventListener('click',saveCurrent);
document.getElementById('calcBtn').addEventListener('click',calculate);
document.getElementById('exportBtn').addEventListener('click',exportTxt);
document.getElementById('resetBtn').addEventListener('click',resetDefaults);
loadSaved();
updateRemainingLifeDisplay();