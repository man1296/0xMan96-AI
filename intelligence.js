/* 0xMan96 AI: privacy-first online learning for agent routing.
   This is an explainable Naive Bayes classifier trained only from explicit feedback.
   It is not a foundation model and does not send training data to a third party. */
(()=>{"use strict";
const KEY="0xman96-learning-v1",MAX=500;
const STOP=new Set("yang dan atau dengan untuk dari pada ini itu the and or with for from this that into your about task agent please bantu to dalam saya kamu adalah".split(" "));
const tokenize=s=>(String(s||"").toLowerCase().match(/[\\p{L}\\p{N}]{2,}/gu)||[]).filter(t=>!STOP.has(t)).slice(0,120);
const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||"{}");return {samples:Array.isArray(x.samples)?x.samples.slice(-MAX):[]}}catch{return {samples:[]}}};
const write=x=>{try{localStorage.setItem(KEY,JSON.stringify(x))}catch{}};
function learn(text,role,rating=1){if(!role||!String(text||"").trim())return false;const db=read();db.samples.push({tokens:tokenize(text),role:String(role).slice(0,80),rating:rating<0?-1:1,at:Date.now()});db.samples=db.samples.slice(-MAX);write(db);return true}
function suggest(text,agents){const db=read(),tokens=tokenize(text),eligible=(agents||[]).filter(a=>a&&a.role&&a.role!=="custom");if(db.samples.length<6||!tokens.length||!eligible.length)return null;
 const labels=[...new Set(db.samples.filter(s=>s.rating>0).map(s=>s.role))];if(!labels.length)return null;
 const vocab=new Set(db.samples.flatMap(s=>s.tokens)),scores=[];
 for(const role of labels){const rows=db.samples.filter(s=>s.role===role),positive=rows.filter(s=>s.rating>0),negative=rows.filter(s=>s.rating<0);if(positive.length<3)continue;
  let score=Math.log((positive.length+1)/(db.samples.length+labels.length));
  for(const token of tokens){let yes=0,no=0;for(const s of positive)yes+=s.tokens.includes(token)?1:0;for(const s of negative)no+=s.tokens.includes(token)?1:0;score+=Math.log((yes+1)/(positive.length+vocab.size+1))-0.35*Math.log((no+1)/(negative.length+vocab.size+1));}
  scores.push({role,score,support:positive.length});
 }
 scores.sort((a,b)=>b.score-a.score);if(!scores.length)return null;
 const probs=scores.map(s=>Math.exp(Math.max(-30,s.score-scores[0].score))),sum=probs.reduce((a,b)=>a+b,0),confidence=probs[0]/sum;
 if(confidence<0.58)return null;const agent=eligible.find(a=>a.role===scores[0].role);return agent?{agent,confidence,support:scores[0].support}:null;
}
function stats(){const s=read().samples;return {samples:s.length,labels:[...new Set(s.map(x=>x.role))].length,storage:"this browser only",model:"Multinomial Naive Bayes",minimumSamplesPerAgent:3}}
window.ZeroXIntelligence=Object.freeze({learn,suggest,stats,clear(){localStorage.removeItem(KEY)}});
})();