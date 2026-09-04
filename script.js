const AMOUNTS = [
  0.01,1,5,10,25,50,75,100,200,300,400,500,750,
  1000,5000,10000,25000,50000,75000,100000,200000,300000,400000,500000,750000,1000000
];

const ROUND_OPEN_COUNTS = [6,5,4,3,2,1,1,1,1];
const OFFER_RANGES = [
  [0.50,0.60],[0.60,0.70],[0.68,0.78],[0.75,0.85],[0.80,0.90],
  [0.85,0.95],[0.90,1.00],[0.94,1.04],[0.98,1.10]
];

const el = id => document.getElementById(id);

let state = {};

function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function hashString(str){
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h,16777619);
  }
  return h >>> 0;
}

function seededShuffle(arr, seed){
  const out = [...arr];
  const rand = mulberry32(hashString(seed));
  for(let i=out.length-1;i>0;i--){
    const j = Math.floor(rand()*(i+1));
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}

function randomSeed(){
  return Math.floor(100000 + Math.random()*900000).toString();
}

function dailySeed(){
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

function money(v){
  if(v < 1) return `¥${v.toFixed(2)}`;
  return `¥${Math.round(v).toLocaleString('zh-CN')}`;
}

function compactMoney(v){
  if(v >= 10000 && Number.isInteger(v/10000)) return `¥${v/10000}万`;
  return money(v);
}

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  el(id).classList.add('active');
}

function parseParams(){
  const p = new URLSearchParams(location.search);
  return {
    seed: p.get('seed'),
    challenge: p.get('challenge'),
    score: p.get('score')
  };
}

function initHome(){
  const params = parseParams();
  const seed = params.seed || randomSeed();
  el('seedPreview').textContent = seed;
  el('startBtn').dataset.seed = seed;

  if(params.challenge === '1'){
    el('challengeBanner').classList.remove('hidden');
    el('challengeBanner').textContent = params.score
      ? `好友在这局拿到了 ${money(Number(params.score))}。你能超过吗？`
      : `好友向你发起了同局挑战。`;
  }
}

function startGame(seed, investor){
  const shuffled = seededShuffle(AMOUNTS, seed);
  state = {
    seed,
    investor,
    cases: shuffled.map((amount,i)=>({no:i+1,amount,status:'closed'})),
    ownedNo:null,
    round:0,
    openedThisRound:0,
    offers:[],
    acceptedOffer:null,
    acceptedRound:null,
    simulating:false,
    finalPrize:null,
    currentOffer:null,
    currentEV:null,
    currentRatio:null
  };
  showScreen('gameScreen');
  renderMoneyBoard();
  renderCases();
  updateHeader();
  el('yourCaseLabel').textContent='尚未选择';
  el('yourCaseVisual').textContent='?';
  el('yourCaseVisual').classList.add('empty');
}

function remainingCases(){
  return state.cases.filter(c=>c.status==='closed' || c.status==='owned');
}
function remainingAmounts(){
  return remainingCases().map(c=>c.amount);
}

function renderMoneyBoard(){
  const remaining = new Set(remainingAmounts().map(String));
  el('moneyBoard').innerHTML = AMOUNTS.map((a,idx)=>{
    const gone = !remaining.has(String(a));
    return `<div class="money-chip ${idx>=13?'high':''} ${gone?'gone':''}">${compactMoney(a)}</div>`;
  }).join('');
}

function renderCases(){
  el('casesGrid').innerHTML = state.cases.map(c=>{
    let cls='case-btn';
    if(c.status==='opened') cls+=' opened';
    if(c.status==='owned') cls+=' owned';
    if(state.simulating) cls+=' sim-mode';
    return `<button class="${cls}" data-no="${c.no}">${String(c.no).padStart(2,'0')}</button>`;
  }).join('');
  document.querySelectorAll('.case-btn').forEach(btn=>{
    btn.addEventListener('click',()=>caseClicked(Number(btn.dataset.no)));
  });
}

function updateHeader(){
  if(!state.ownedNo){
    el('roundLabel').textContent='选择你的箱子';
    el('instruction').textContent='它会一直陪你到最后';
    return;
  }
  if(state.simulating){
    el('roundLabel').textContent='成交后模拟';
    el('instruction').textContent='看看如果你继续玩，会发生什么';
    return;
  }
  const need = ROUND_OPEN_COUNTS[state.round] || 0;
  const left = Math.max(0, need-state.openedThisRound);
  el('roundLabel').textContent=`ROUND ${state.round+1}`;
  el('instruction').textContent=`还需打开 ${left} 个箱子`;
}

async function caseClicked(no){
  const c = state.cases.find(x=>x.no===no);
  if(!c || c.status!=='closed') return;

  if(!state.ownedNo){
    state.ownedNo=no;
    c.status='owned';
    el('yourCaseLabel').textContent=`CASE ${String(no).padStart(2,'0')}`;
    el('yourCaseVisual').textContent=String(no).padStart(2,'0');
    el('yourCaseVisual').classList.remove('empty');
    renderCases();
    updateHeader();
    return;
  }

  c.status='opened';
  renderCases();
  await revealCase(c);
  renderMoneyBoard();

  if(state.simulating){
    await continueSimulationFlow();
    return;
  }

  state.openedThisRound++;
  const need = ROUND_OPEN_COUNTS[state.round];
  updateHeader();

  if(state.openedThisRound >= need){
    setTimeout(openBankerCall, 350);
  }
}

function revealCase(c){
  return new Promise(resolve=>{
    el('revealCaseNo').textContent=`CASE ${String(c.no).padStart(2,'0')}`;
    el('revealAmount').textContent=money(c.amount);
    el('caseReveal').classList.remove('hidden');
    setTimeout(()=>{
      el('caseReveal').classList.add('hidden');
      resolve();
    }, 1050);
  });
}

function calcEV(){
  const vals=remainingAmounts();
  return vals.reduce((a,b)=>a+b,0)/vals.length;
}

function riskMetric(vals){
  const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
  const variance=vals.reduce((s,x)=>s+(x-mean)**2,0)/vals.length;
  return mean ? Math.sqrt(variance)/mean : 0;
}

function bankerQuote(){
  const vals=remainingAmounts();
  const ev=calcEV();
  const [lo,hi]=OFFER_RANGES[Math.min(state.round,OFFER_RANGES.length-1)];

  const rand=mulberry32(hashString(`${state.seed}|offer|${state.round}|${vals.slice().sort((a,b)=>a-b).join(',')}`));
  let factor=lo+(hi-lo)*rand();

  // Banker A: 大奖越集中、越到后期，越愿意多给一点钱把玩家买走。
  const max=Math.max(...vals);
  const topAlive = [1000000,750000,500000].filter(x=>vals.includes(x)).length;
  const risk=riskMetric(vals);
  const late=Math.min(1,state.round/8);
  const fearBonus = late * (topAlive/3) * Math.min(0.07, risk*0.015);
  factor += fearBonus;

  let raw=ev*factor;
  const quoted=humanizeOffer(raw);
  return {offer:quoted,ev,factor:quoted/ev,risk,max};
}

function humanizeOffer(v){
  let step;
  if(v < 1000) step = 10;
  else if(v < 10000) step = 50;
  else if(v < 50000) step = 500;
  else if(v < 200000) step = 1000;
  else if(v < 500000) step = 2500;
  else step = 5000;

  let q=Math.round(v/step)*step;

  // 避免所有报价都太整，部分轮次偏移半个粒度
  const rand=mulberry32(hashString(`${state.seed}|rounding|${state.round}|${Math.round(v)}`));
  if(rand()>0.58 && step>=500) q += step/2;

  return Math.max(step,q);
}

function bankerLine(offerData){
  const vals=remainingAmounts();
  const topAlive=vals.includes(1000000);
  const justLostBig = state.cases.some(c=>c.status==='opened' && c.amount>=500000);
  const options=[];
  if(state.round===0) options.push('“第一轮而已，别太快高兴。”');
  if(topAlive && state.round>=4) options.push('“那个最大的数字还没有消失。”');
  if(offerData.factor>=1) options.push('“这次，我已经给得很认真了。”');
  if(offerData.risk>1.4) options.push('“现在的局面，很容易一刀天堂，一刀地狱。”');
  if(justLostBig) options.push('“这一下，很贵。”');
  options.push('“让我看看，你会不会继续。”','“这个数字，应该足够让你犹豫一下。”');
  const rand=mulberry32(hashString(`${state.seed}|line|${state.round}|${offerData.offer}`));
  return options[Math.floor(rand()*options.length)];
}

function openBankerCall(){
  el('bankerCalling').classList.remove('hidden');
  el('bankerOfferView').classList.add('hidden');
  el('bankerOverlay').classList.remove('hidden');
}

function showOffer(){
  const data=bankerQuote();
  state.currentOffer=data.offer;
  state.currentEV=data.ev;
  state.currentRatio=data.factor;
  state.offers.push({
    round:state.round+1,
    offer:data.offer,
    ev:data.ev,
    ratio:data.factor,
    accepted:false
  });

  el('bankerCalling').classList.add('hidden');
  el('bankerOfferView').classList.remove('hidden');
  el('bankerLine').textContent=bankerLine(data);

  animateOffer(data.offer);

  if(state.investor){
    el('investorPanel').classList.remove('hidden');
    el('evAmount').textContent=money(data.ev);
    el('offerRatio').textContent=`${(data.factor*100).toFixed(1)}%`;
    el('riskLabel').textContent=data.risk>1.5?'很高':data.risk>0.9?'高':data.risk>0.5?'中等':'较低';
  }else{
    el('investorPanel').classList.add('hidden');
  }
}

function animateOffer(target){
  const node=el('offerAmount');
  const start=performance.now();
  const dur=950;
  function frame(now){
    const p=Math.min(1,(now-start)/dur);
    const eased=1-Math.pow(1-p,3);
    node.textContent=money(target*eased);
    if(p<1) requestAnimationFrame(frame);
    else node.textContent=money(target);
  }
  requestAnimationFrame(frame);
}

function noDeal(){
  el('bankerOverlay').classList.add('hidden');
  state.round++;
  state.openedThisRound=0;

  if(state.round>=ROUND_OPEN_COUNTS.length){
    finishNoDeal();
    return;
  }
  updateHeader();
}

function acceptDeal(){
  state.acceptedOffer=state.currentOffer;
  state.acceptedRound=state.round+1;
  state.offers[state.offers.length-1].accepted=true;
  el('bankerOverlay').classList.add('hidden');
  el('postDealOverlay').classList.remove('hidden');
}

function startPostDealSimulation(){
  el('postDealOverlay').classList.add('hidden');
  state.simulating=true;
  updateHeader();
  renderCases();
}

async function continueSimulationFlow(){
  const closed=state.cases.filter(c=>c.status==='closed');
  if(closed.length<=1){
    revealOwnedAndFinish();
    return;
  }

  // 成交后的模拟：继续按原轮次开箱数量推进；为了让玩家手动选择，
  // 每开一个箱子后判断这一“假轮次”是否应生成假报价。
  state.openedThisRound++;
  const need=ROUND_OPEN_COUNTS[Math.min(state.round,ROUND_OPEN_COUNTS.length-1)] || 1;

  if(state.openedThisRound>=need){
    const fake=bankerQuote();
    state.offers.push({round:state.round+1,offer:fake.offer,ev:fake.ev,ratio:fake.factor,accepted:false,postDeal:true});
    await showFakeOffer(fake);
    state.round=Math.min(state.round+1,ROUND_OPEN_COUNTS.length-1);
    state.openedThisRound=0;
  }
  updateHeader();
}

function showFakeOffer(data){
  return new Promise(resolve=>{
    el('bankerCalling').classList.add('hidden');
    el('bankerOfferView').classList.remove('hidden');
    el('bankerOverlay').classList.remove('hidden');
    el('bankerLine').textContent='“如果你刚才没有成交，我现在会给你……”';
    el('dealBtn').classList.add('hidden');
    el('noDealBtn').classList.add('hidden');
    el('investorPanel').classList.toggle('hidden',!state.investor);
    if(state.investor){
      el('evAmount').textContent=money(data.ev);
      el('offerRatio').textContent=`${(data.factor*100).toFixed(1)}%`;
      el('riskLabel').textContent=data.risk>1.5?'很高':data.risk>0.9?'高':data.risk>0.5?'中等':'较低';
    }
    animateOffer(data.offer);
    setTimeout(()=>{
      el('bankerOverlay').classList.add('hidden');
      el('dealBtn').classList.remove('hidden');
      el('noDealBtn').classList.remove('hidden');
      resolve();
    },1800);
  });
}

function finishNoDeal(){
  const owned=state.cases.find(c=>c.status==='owned');
  state.finalPrize=owned.amount;
  revealOwnedAndFinish();
}

async function revealOwnedAndFinish(){
  const owned=state.cases.find(c=>c.status==='owned');
  if(!owned) return;
  state.finalPrize=owned.amount;
  el('revealCaseNo').textContent=`YOUR CASE ${String(owned.no).padStart(2,'0')}`;
  el('revealAmount').textContent=money(owned.amount);
  el('caseReveal').classList.remove('hidden');
  setTimeout(()=>{
    el('caseReveal').classList.add('hidden');
    showResult();
  },1600);
}

function bestOffer(){
  return state.offers.reduce((m,x)=>Math.max(m,x.offer),0);
}

function classify(){
  const won=state.acceptedOffer ?? state.finalPrize;
  const box=state.finalPrize;
  const maxOffer=bestOffer();

  if(state.acceptedOffer!==null){
    if(state.acceptedOffer >= box*2 && state.acceptedOffer>=maxOffer*0.85) return ['完美成交','你把一个不值钱的箱子，卖出了漂亮的价格。'];
    if(box > state.acceptedOffer*2) return ['银行家赢了','你安全落袋，但自己的箱子更值钱。'];
    return ['理性收手','你选择把不确定性换成了确定的钱。'];
  }else{
    if(box>=500000) return ['钻石手','你一路拒绝银行家，最后真的把大奖带走了。'];
    if(maxOffer>=box*10) return ['高位接盘侠','你拒绝过一个很难再见到的数字。'];
    return ['赌到底','你没有卖掉自己的箱子。'];
  }
}

function showResult(){
  showScreen('resultScreen');
  const won=state.acceptedOffer ?? state.finalPrize;
  const [title,quote]=classify();
  el('resultHeadline').textContent=money(won);
  el('resultQuote').innerHTML=`<strong>${title}</strong><br>${quote}`;

  const maxOffer=bestOffer();
  const acceptedText=state.acceptedOffer!==null ? money(state.acceptedOffer) : 'NO DEAL';
  el('resultStats').innerHTML=`
    <div class="stat-box"><span>你的箱子</span><strong>${money(state.finalPrize)}</strong></div>
    <div class="stat-box"><span>最高报价</span><strong>${money(maxOffer)}</strong></div>
    <div class="stat-box"><span>最终选择</span><strong>${acceptedText}</strong></div>
    <div class="stat-box"><span>本局种子</span><strong>${state.seed}</strong></div>
  `;

  if(state.investor){
    const acceptedRec=state.offers.find(x=>x.accepted);
    const line=acceptedRec
      ? `成交时，银行家报价相当于剩余平均价值的 ${(acceptedRec.ratio*100).toFixed(1)}%。`
      : `你坚持到最后，没有接受任何银行家报价。`;
    el('investorSummary').textContent=line;
    el('investorSummary').classList.remove('hidden');
  }else{
    el('investorSummary').classList.add('hidden');
  }
}

function shareChallenge(){
  const won=state.acceptedOffer ?? state.finalPrize;
  const url=new URL(location.href);
  url.search='';
  url.searchParams.set('seed',state.seed);
  url.searchParams.set('challenge','1');
  url.searchParams.set('score',Math.round(won));

  if(navigator.share){
    navigator.share({
      title:'一掷千金 · 同局挑战',
      text:`我这局拿到了 ${money(won)}，你能超过吗？`,
      url:url.toString()
    }).catch(()=>{});
  }else{
    navigator.clipboard?.writeText(url.toString());
    alert('同局挑战链接已复制');
  }
}

el('startBtn').addEventListener('click',()=>startGame(el('startBtn').dataset.seed,el('investorToggle').checked));
el('dailyBtn').addEventListener('click',()=>startGame(dailySeed(),el('investorToggle').checked));
el('answerBtn').addEventListener('click',showOffer);
el('noDealBtn').addEventListener('click',noDeal);
el('dealBtn').addEventListener('click',acceptDeal);
el('continueSimBtn').addEventListener('click',startPostDealSimulation);
el('challengeBtn').addEventListener('click',shareChallenge);
el('replayBtn').addEventListener('click',()=>{history.replaceState({},'',location.pathname);showScreen('homeScreen');initHome();});
el('homeBtn').addEventListener('click',()=>{showScreen('homeScreen');initHome();});

initHome();
