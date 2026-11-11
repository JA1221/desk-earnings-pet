/* ==================================================================
   薪跳 design prototypes — shared pet renderers, room, odometer, interaction
   ================================================================== */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let UID=0;
const L0='#3D2C24';

/* ---------------- geometry utils ---------------- */
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const f1=n=>Math.round(n*10)/10;
const ptsPath=pts=>'M'+pts.map(p=>f1(p[0])+','+f1(p[1])).join(' L')+' Z';
function smoothPath(pts){const n=pts.length;let d=`M${f1(pts[0][0])},${f1(pts[0][1])}`;for(let i=0;i<n;i++){const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];d+=` C${f1(p1[0]+(p2[0]-p0[0])/6)},${f1(p1[1]+(p2[1]-p0[1])/6)} ${f1(p2[0]-(p3[0]-p1[0])/6)},${f1(p2[1]-(p3[1]-p1[1])/6)} ${f1(p2[0])},${f1(p2[1])}`}return d+' Z'}
const sample=(f,n)=>Array.from({length:n},(_,i)=>{const t=-Math.PI/2+i/n*Math.PI*2;return[...f(t),t]});
const ell=(cx,cy,rx,ry)=>t=>[cx+rx*Math.cos(t),cy+ry*Math.sin(t)];
/* soft cloud-like fluff outline (round scallops) */
function puffy(f,c,n,amp,R){
  const pts=sample(f,n);let d=`M${f1(pts[0][0])},${f1(pts[0][1])}`;
  pts.forEach(([x,y],i)=>{const[nx,ny]=pts[(i+1)%n];const mx=(x+nx)/2,my=(y+ny)/2,dx=mx-c[0],dy=my-c[1],dd=Math.hypot(dx,dy)||1,a=amp*(.75+R()*.5);
    d+=` Q${f1(mx+dx/dd*a*1.9)},${f1(my+dy/dd*a*1.9)} ${f1(nx)},${f1(ny)}`});
  return d+' Z';
}
/* fluffy tufted outline */
function fluffy(f,c,n,amp,R){
  const pts=sample(f,n);let d='';
  pts.forEach(([x,y],i)=>{const[nx,ny]=pts[(i+1)%n];const dx=(x+nx)/2-c[0],dy=(y+ny)/2-c[1],dd=Math.hypot(dx,dy)||1,ux=dx/dd,uy=dy/dd,a=amp*(.7+R()*.6);
    const tx=(x+nx)/2+ux*a+(nx-x)*.3, ty=(y+ny)/2+uy*a+(ny-y)*.3;
    if(i===0)d+=`M${f1(x)},${f1(y)}`;
    d+=` Q${f1(x+ux*a*.95)},${f1(y+uy*a*.95)} ${f1(tx)},${f1(ty)} Q${f1(tx-ux*a*.25)},${f1(ty-uy*a*.25)} ${f1(nx)},${f1(ny)}`});
  return d+' Z';
}
const ST=(w=3,c=L0)=>`stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const star4=(x,y,r)=>`M${x},${y-r} Q${x},${y} ${x+r},${y} Q${x},${y} ${x},${y+r} Q${x},${y} ${x-r},${y} Q${x},${y} ${x},${y-r} Z`;

/* ---------------- per-svg defs ---------------- */
function commonDefs(id){return `
 <radialGradient id="${id}-geye" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#55423A"/><stop offset=".55" stop-color="#22160F"/><stop offset="1" stop-color="#120B08"/></radialGradient>
 <linearGradient id="${id}-aeye" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A1D18"/><stop offset=".5" stop-color="#2A1D18"/><stop offset="1" stop-color="#8A5530"/></linearGradient>
 <linearGradient id="${id}-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A6E2F8"/><stop offset="1" stop-color="#2F80C8"/></linearGradient>
 <linearGradient id="${id}-amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7CC5A"/><stop offset="1" stop-color="#DB8B25"/></linearGradient>
 <filter id="${id}-felt" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="d"/><feColorMatrix in="n" type="matrix" values="0 0 0 .24 .78 0 0 0 .24 .78 0 0 0 .24 .78 0 0 0 0 1" result="g"/><feComposite in="g" in2="d" operator="in" result="gm"/><feBlend in="d" in2="gm" mode="multiply"/></filter>
 <filter id="${id}-crayon" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".5" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="9" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -3.4 3.1" result="m"/><feComposite in="d" in2="m" operator="in"/></filter>
 <filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="6" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -3.4 3.2" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
 <filter id="${id}-wobble" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" xChannelSelector="R" yChannelSelector="G"/></filter>
 <filter id="${id}-paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 .42 0 0 0 0 .34 0 0 0 0 .26 0 0 0 -1.5 .95"/></filter>
 <filter id="${id}-pencil2" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.04 1.1" numOctaves="2" seed="5" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -4 3.1" result="m"/><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="d"/><feComposite in="d" in2="m" operator="in"/></filter>
 <filter id="${id}-wash" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="3" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="1" result="b"/><feColorMatrix in="b" type="matrix" values=".72 0 0 0 .28 0 .72 0 0 .28 0 0 .72 0 .28 0 0 0 .92 0" result="l"/><feOffset in="l" dx="2" dy="1.5"/></filter>
 <filter id="${id}-inkf" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="d"/><feMorphology in="d" operator="dilate" radius=".35"/></filter>
 <filter id="${id}-gouache" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="12" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" seed="13" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 .3 .74 0 0 0 .3 .74 0 0 0 .3 .74 0 0 0 0 1" result="gg"/><feComposite in="gg" in2="d" operator="in" result="gm"/><feBlend in="d" in2="gm" mode="multiply"/></filter>`}
/* global paper-cut shadow filter (referenced from CSS) */
(document.body?(f=>f()):(f=>document.addEventListener('DOMContentLoaded',f)))(()=>document.body.insertAdjacentHTML('afterbegin','<svg width="0" height="0" style="position:absolute"><filter id="pcs" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".08" numOctaves="1" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" xChannelSelector="R" yChannelSelector="G" result="d"/><feDropShadow in="d" dx="1.2" dy="1.8" stdDeviation=".5" flood-color="#3D2C24" flood-opacity=".32"/></filter></svg>'));

/* ---------------- shared face parts ---------------- */
const happyArc=(cx,cy,w,L=L0,sw=3.4)=>`<path d="M${cx-w},${cy+2} q${w},${-w*1.25} ${w*2},0" fill="none" stroke="${L}" stroke-width="${sw}" stroke-linecap="round"/>`;
const blushLines=(x,y,c='#E2506E')=>`<path d="M${x-4},${y-2} l-2,4 M${x+.5},${y-2} l-2,4 M${x+5},${y-2} l-2,4" stroke="${c}" stroke-width="1.5" stroke-linecap="round" opacity=".75"/>`;
const glossy=(cx,cy,r,id,ring='')=>`<g class="blink"><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-geye)" ${ring}/><ellipse cx="${cx+r*.32}" cy="${cy-r*.36}" rx="${r*.38}" ry="${r*.33}" fill="#fff"/><circle cx="${cx-r*.4}" cy="${cy+r*.42}" r="${r*.16}" fill="#fff" opacity=".85"/></g>`;
const animeEye=(cx,cy,id,s=1)=>`<g class="blink"><ellipse cx="${cx}" cy="${cy}" rx="${9*s}" ry="${10.5*s}" fill="url(#${id}-aeye)"/><ellipse cx="${cx+2.8*s}" cy="${cy-4*s}" rx="${3.8*s}" ry="${3.4*s}" fill="#fff"/><circle cx="${cx-3.4*s}" cy="${cy+4.4*s}" r="${1.7*s}" fill="#fff"/><path d="${star4(cx+4.4*s,cy+2.8*s,1.9*s)}" fill="#fff"/></g>`;
const kawaiiEye=(cx,cy,id)=>`<g class="blink"><ellipse cx="${cx}" cy="${cy}" rx="9.8" ry="12" fill="url(#${id}-aeye)"/><ellipse cx="${cx+3}" cy="${cy-4.6}" rx="4.2" ry="3.8" fill="#fff"/><circle cx="${cx-3.6}" cy="${cy+4.8}" r="2" fill="#fff"/><circle cx="${cx+3.8}" cy="${cy+5.6}" r="1.1" fill="#fff"/><path d="${star4(cx-4.4,cy-5.4,2)}" fill="#fff"/><path d="M${cx-6},${cy+8} q6,3 12,0" stroke="#fff" stroke-width="1.2" fill="none" opacity=".5" stroke-linecap="round"/></g>`;
const kawaiiBlush=(x,y)=>`<circle cx="${x}" cy="${y}" r="8.5" fill="#FF9FB0" opacity=".85"/><circle cx="${x-3}" cy="${y-2}" r="1.1" fill="#fff"/><circle cx="${x+1}" cy="${y-3}" r="1.1" fill="#fff"/><circle cx="${x+3.5}" cy="${y}" r="1.1" fill="#fff"/>`;
const handPink=(cx,cls,w=2.6)=>`<g class="${cls}"><ellipse cx="${cx}" cy="150" rx="8.5" ry="6.5" fill="#FFB8C3" ${ST(w)}/><path d="M${cx-3.5},147.5 v3 M${cx},147 v3.2 M${cx+3.5},147.5 v3" ${ST(1.6)}/></g>`;
const badge=(x,y)=>`<rect x="${x}" y="${y}" width="16" height="11.5" rx="2" fill="#fff" stroke="${L0}" stroke-width="2"/><rect x="${x+2.5}" y="${y+2.5}" width="5" height="6.5" rx="1" fill="#FFB25B"/><path d="M${x+10},${y+4} h3.5 M${x+10},${y+7} h3.5" stroke="#A9B4C2" stroke-width="1.4" stroke-linecap="round"/>`;
const SEED=L=>`<g transform="rotate(25 186 151)"><ellipse cx="186" cy="151" rx="6" ry="3.4" fill="#3A3A3A" stroke="${L}" stroke-width="1.6"/><path d="M181.5,150 h9 M182,152 h8" stroke="#fff" stroke-width="1" opacity=".85"/></g>`;

/* ================== P0 Q版大眼 ================== */
const qEye=(cx,cy,s,iris)=>`<g class="blink"><ellipse cx="${cx}" cy="${cy}" rx="${8.5*s}" ry="${10.5*s}" fill="#2E2220"/><ellipse cx="${cx}" cy="${cy+3.8*s}" rx="${6*s}" ry="${5.4*s}" fill="${iris}" opacity=".92"/><ellipse cx="${cx+2.6*s}" cy="${cy-4.2*s}" rx="${3.6*s}" ry="${3.2*s}" fill="#fff"/><circle cx="${cx-3.2*s}" cy="${cy+4.6*s}" r="${1.6*s}" fill="#fff"/><circle cx="${cx+4.2*s}" cy="${cy+2.4*s}" r="${.9*s}" fill="#fff" opacity=".9"/></g>`;
function p0Cat(id){
  const P={body:'#FFB25B',shade:'#F59A42',stripe:'#E57A2E',belly:'#FFF3DF',ear:'#FFA3B5',iris:'#C97A2B',nose:'#FF6F86',socks:'#FFF3DF',blush:'#FF8FA3'},L=L0,st=ST(3);
  const HEAD="M118,46 C146,46 166,60 171,82 C173,92 172,98 170,102 L177,106 L169,110 L175,116 L165,118 C158,128 142,132 118,132 C94,132 78,128 71,118 L61,116 L67,110 L59,106 L66,102 C64,98 63,92 65,82 C70,60 90,46 118,46 Z";
  const TORSO="M80,172 C76,140 88,114 118,112 C148,114 160,140 156,172 Z", TAIL="M86,150 C56,154 42,128 56,106";
  const arm=m=>{const cx=m?99:137;return `<g class="paw${m?'L':'R'}"><path d="${m?'M88,134 C84,140 85,146 89,151 L109,151 C109,146 108,140 105,134 Z':'M148,134 C152,140 151,146 147,151 L127,151 C127,146 128,140 131,134 Z'}" fill="${P.body}"/><path d="${m?'M88,134 C84,140 85,146 89,151':'M148,134 C152,140 151,146 147,151'}" fill="none" ${st}/><path d="${m?'M107,141 C108.5,144 109,148 109,151':'M129,141 C127.5,144 127,148 127,151'}" fill="none" ${st}/><ellipse cx="${cx}" cy="151" rx="12" ry="7.5" fill="${P.socks}" ${st}/><path d="M${cx-4},148.5 v3.5 M${cx+4},148.5 v3.5" ${ST(2)}/></g>`};
  return {crop:'52 18 132 122',
   defs:`<clipPath id="${id}-hc"><path d="${HEAD}"/></clipPath><clipPath id="${id}-tc"><path d="${TORSO}"/></clipPath>`,
   back:`<g class="tail"><path d="${TAIL}" fill="none" stroke="${L}" stroke-width="19" stroke-linecap="round"/><path d="${TAIL}" fill="none" stroke="${P.body}" stroke-width="13" stroke-linecap="round"/><path d="M68.8,142.8 L64.6,153 M59.2,134.9 L49.8,140.7 M56.1,122.9 L45.1,122.5" stroke="${P.stripe}" stroke-width="3.6" stroke-linecap="round"/></g>
     <path d="${TORSO}" fill="${P.body}"/><g clip-path="url(#${id}-tc)"><ellipse cx="156" cy="150" rx="22" ry="40" fill="${P.shade}"/></g><path d="${TORSO}" fill="none" ${st}/>
     <path d="M104,134 l4,-5 l3.5,4.5 l3.5,-5 l3,5 l3,-5 l3.5,5 l3.5,-4.5 l4,5 C136,146 132,160 118,162 C104,160 100,146 104,134 Z" fill="${P.belly}"/>
     <path d="M104,124 L113,136 M132,124 L123,136" stroke="#4DA3FF" stroke-width="3.2" stroke-linecap="round"/>${badge(110,134.5)}`,
   front:arm(true)+arm(false),
   post:`<g class="head"><path d="M70,78 L64,36 Q63,25 73,29 L106,54 Z" fill="${P.body}" ${st}/><path d="M166,78 L172,36 Q173,25 163,29 L130,54 Z" fill="${P.body}" ${st}/>
     <path d="M75,66 L71,40 L94,55 Z" fill="${P.ear}"/><path d="M161,66 L165,40 L142,55 Z" fill="${P.ear}"/>
     <path d="M75,58 l6,-2.5 M76,64 l7,-1.5 M161,58 l-6,-2.5 M160,64 l-7,-1.5" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/>
     <path d="${HEAD}" fill="${P.body}"/><g clip-path="url(#${id}-hc)"><path d="M56,108 C86,128 150,128 182,100 L182,140 L56,140 Z" fill="${P.shade}"/></g><path d="${HEAD}" fill="none" ${st}/>
     <path d="M118,51 v9 M107,53 q2.5,5 2,9 M129,53 q-2.5,5 -2,9" stroke="${P.stripe}" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M66,86 h8 M65,93 h7 M170,86 h-8 M171,93 h-7" stroke="${P.stripe}" stroke-width="3.5" stroke-linecap="round"/>
     <path d="M82,66 C88,58 98,53 108,52" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"/>
     <ellipse cx="110" cy="108" rx="10.5" ry="7.5" fill="${P.belly}"/><ellipse cx="126" cy="108" rx="10.5" ry="7.5" fill="${P.belly}"/>
     <ellipse cx="81" cy="108" rx="9" ry="5" fill="${P.blush}" opacity=".75"/><ellipse cx="155" cy="108" rx="9" ry="5" fill="${P.blush}" opacity=".75"/>${blushLines(81,108)}${blushLines(155,108)}
     <g class="look"><g class="eyes-open">${qEye(97,91,1,P.iris)}${qEye(139,91,1,P.iris)}</g><g class="eyes-happy">${happyArc(97,92,8,L,3.6)}${happyArc(139,92,8,L,3.6)}</g></g>
     <path d="M113.5,100 h9 q-1,4 -4.5,5 q-3.5,-1 -4.5,-5 z" fill="${P.nose}" ${ST(1.6)}/>
     <path d="M109,107 q4.5,5.5 9,0 q4.5,5.5 9,0" fill="none" ${ST(2.4)}/>
     <path d="M74,100 Q64,97 54,97 M74,105 Q64,105 53,107 M75,110 Q66,112 57,116 M162,100 Q172,97 182,97 M162,105 Q172,105 183,107 M161,110 Q170,112 179,116" fill="none" ${ST(2)}/></g>`};
}
function p0Ham(id){
  const P={body:'#F7B25E',shade:'#EC9A41',stripe:'#DD8A35',belly:'#FFF7EA',bellyShade:'#F3E3CC',ear:'#FFA3B5',paw:'#FFC1CC',iris:'#8A5A2B',nose:'#FF6F86',blush:'#FF8FA3'},L=L0,st=ST(3);
  const BODY="M118,66 C150,66 170,86 172,110 L179,116 L171,120 L177,127 L168,130 C166,152 150,170 118,172 C86,170 70,152 68,130 L59,127 L65,120 L57,116 L64,110 C66,86 86,66 118,66 Z";
  return {crop:'52 54 132 116',seed:true,defs:`<clipPath id="${id}-bc"><path d="${BODY}"/></clipPath>`,
   pre:`<g class="head"><g transform="rotate(-18 84 78)"><ellipse cx="84" cy="78" rx="13" ry="12" fill="${P.body}" ${st}/><ellipse cx="84" cy="79" rx="7.5" ry="6.5" fill="${P.ear}"/></g><g transform="rotate(18 152 78)"><ellipse cx="152" cy="78" rx="13" ry="12" fill="${P.body}" ${st}/><ellipse cx="152" cy="79" rx="7.5" ry="6.5" fill="${P.ear}"/></g>
    <path d="${BODY}" fill="${P.body}"/><g clip-path="url(#${id}-bc)"><path d="M160,80 C186,112 182,152 136,178 L198,198 L198,70 Z" fill="${P.shade}"/><path d="M50,130 C62,114 82,110 98,120 C108,112 128,112 138,120 C154,110 174,114 186,130 L186,190 L50,190 Z" fill="${P.belly}"/><ellipse cx="168" cy="152" rx="20" ry="30" fill="${P.bellyShade}"/></g><path d="${BODY}" fill="none" ${st}/>
    <path d="M118,71 v9 M109.5,73 l1.5,6 M126.5,73 l-1.5,6" stroke="${P.stripe}" stroke-width="3.5" stroke-linecap="round"/><path d="M84,88 C90,78 100,73 110,72" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"/>
    <ellipse cx="86" cy="128" rx="9" ry="5.5" fill="${P.blush}" opacity=".75"/><ellipse cx="150" cy="128" rx="9" ry="5.5" fill="${P.blush}" opacity=".75"/>${blushLines(86,128)}${blushLines(150,128)}
    <g class="look"><g class="eyes-open">${qEye(100,104,.82,P.iris)}${qEye(136,104,.82,P.iris)}</g><g class="eyes-happy">${happyArc(100,105,7,L,3.4)}${happyArc(136,105,7,L,3.4)}</g></g>
    <path d="M114.8,114.5 h6.4 q-.6,3.2 -3.2,4 q-2.6,-.8 -3.2,-4 z" fill="${P.nose}" ${ST(1.4)}/><path d="M112,121 q3,4 6,0 q3,4 6,0" fill="none" ${ST(2.2)}/>
    <rect x="115.6" y="123" width="4.8" height="4.8" rx="1" fill="#fff" ${ST(1.4)}/><path d="M118,123.2 v4.4" stroke="${L}" stroke-width="1"/>
    <path d="M80,117 Q71,114 63,114 M80,122 Q71,122 63,124 M156,117 Q165,114 173,114 M156,122 Q165,122 173,124" fill="none" ${ST(1.8)}/>
    <path d="M100,128 L112,135 M136,128 L124,135" stroke="#4DA3FF" stroke-width="3" stroke-linecap="round"/>${badge(110,133.5)}</g>`,
   front:`<g class="pawL"><ellipse cx="104" cy="150" rx="8.5" ry="6.5" fill="${P.paw}" ${st}/><path d="M100.5,147.5 v3 M104,147 v3.2 M107.5,147.5 v3" ${ST(1.6)}/></g><g class="pawR"><ellipse cx="132" cy="150" rx="8.5" ry="6.5" fill="${P.paw}" ${st}/><path d="M128.5,147.5 v3 M132,147 v3.2 M135.5,147.5 v3" ${ST(1.6)}/></g>`};
}

/* P0 hamster v2 — reads as a real golden (Syrian) hamster: black glossy eyes, golden back, white muzzle/chest, dark cheek flashes, no teeth */
const hamEye=(cx,cy,id,s=1)=>`<g class="blink"><ellipse cx="${cx}" cy="${cy}" rx="${7.6*s}" ry="${8.6*s}" fill="url(#${id}-geye)"/><ellipse cx="${cx+2.4*s}" cy="${cy-3.2*s}" rx="${3.1*s}" ry="${2.8*s}" fill="#fff"/><circle cx="${cx-2.8*s}" cy="${cy+3.6*s}" r="${1.4*s}" fill="#fff"/><path d="${star4(cx+3.6*s,cy+2.4*s,1.5*s)}" fill="#fff" opacity=".9"/></g>`;
function p0HamV2(id){
  const L=L0,st=ST(3),G='#F2A54E',GD='#DD8A34',W='#FFF8EE',WS='#F1E4D2',FL='#B9773C';
  const BODY="M118,64 C150,64 170,84 172,108 L179,114 L171,118 L177,125 L168,128 C166,150 150,170 118,172 C86,170 70,150 68,128 L59,125 L65,118 L57,114 L64,108 C66,84 86,64 118,64 Z";
  const ear=(cx,r)=>`<g transform="rotate(${r} ${cx} 72)"><ellipse cx="${cx}" cy="72" rx="12.5" ry="13" fill="${GD}" ${st}/><ellipse cx="${cx}" cy="73.5" rx="7.6" ry="8.2" fill="#FFB3BE"/><ellipse cx="${cx-1.5}" cy="71" rx="3" ry="3.6" fill="#fff" opacity=".45"/></g>`;
  return {crop:'52 52 132 118',seed:true,defs:`<clipPath id="${id}-bc"><path d="${BODY}"/></clipPath>`,
   pre:`<g class="head">${ear(86,-20)}${ear(150,20)}
    <path d="${BODY}" fill="${G}"/>
    <g clip-path="url(#${id}-bc)">
      <ellipse cx="118" cy="66" rx="40" ry="16" fill="${GD}" opacity=".55"/>
      <path d="M160,78 C186,110 182,150 136,178 L198,198 L198,70 Z" fill="${GD}" opacity=".7"/>
      <path d="M72,126 C74,116 80,110 86,108 C84,118 84,128 88,138 C82,138 76,134 72,126 Z" fill="${FL}" opacity=".75"/>
      <path d="M164,126 C162,116 156,110 150,108 C152,118 152,128 148,138 C154,138 160,134 164,126 Z" fill="${FL}" opacity=".75"/>
      <path d="M40,200 L40,150 C56,136 76,134 92,138 C98,124 104,114 118,112 C132,114 138,124 144,138 C160,134 180,136 196,150 L196,200 Z" fill="${W}"/>
      <ellipse cx="118" cy="114" rx="15" ry="10" fill="${W}"/>
      <path d="M58,148 C80,140 100,142 118,146 C136,142 156,140 178,148 L178,156 C156,150 136,152 118,156 C100,152 80,150 58,156 Z" fill="${G}" opacity=".55"/>
      <ellipse cx="166" cy="160" rx="18" ry="26" fill="${WS}"/>
    </g>
    <path d="${BODY}" fill="none" ${st}/>
    <path d="M84,86 C90,76 100,71 110,70" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>
    <ellipse cx="90" cy="121" rx="8" ry="4.6" fill="#FF9FB0" opacity=".75"/><ellipse cx="146" cy="121" rx="8" ry="4.6" fill="#FF9FB0" opacity=".75"/>
    <g class="look"><g class="eyes-open">${hamEye(100,100,id)}${hamEye(136,100,id)}</g><g class="eyes-happy">${happyArc(100,101,7,L,3.4)}${happyArc(136,101,7,L,3.4)}</g></g>
    <path d="M114.8,109.4 q3.2,-1.6 6.4,0 q-.8,3 -3.2,3.8 q-2.4,-.8 -3.2,-3.8z" fill="#FF8090" ${ST(1.4)}/>
    <path d="M118,113.4 v2.6 M118,116 q-2.6,2.8 -5.4,1.2 M118,116 q2.6,2.8 5.4,1.2" fill="none" ${ST(2)}/>
    <path d="M108,113 Q94,108 80,107 M108,116 Q93,116 78,119 M128,113 Q142,108 156,107 M128,116 Q143,116 158,119" fill="none" ${ST(1.5)} opacity=".85"/>
    <path d="M100,130 L112,137 M136,130 L124,137" stroke="#4DA3FF" stroke-width="3" stroke-linecap="round"/>${badge(110,135.5)}</g>`,
   front:`<g class="pawL"><ellipse cx="104" cy="150" rx="8.5" ry="6.5" fill="#FFB8C3" ${st}/><path d="M100.5,147.5 v3 M104,147 v3.2 M107.5,147.5 v3" ${ST(1.6)}/></g><g class="pawR"><ellipse cx="132" cy="150" rx="8.5" ry="6.5" fill="#FFB8C3" ${st}/><path d="M128.5,147.5 v3 M132,147 v3.2 M135.5,147.5 v3" ${ST(1.6)}/></g>`};
}

/* ================== P4 圓滾麻糬 ================== */
const dot=(cx,cy,r,cls='')=>`<g class="blink"><circle class="${cls}" cx="${cx}" cy="${cy}" r="${r}" fill="${L0}"/><circle cx="${cx+r*.35}" cy="${cy-r*.35}" r="${r*.34}" fill="#fff"/></g>`;
function mochiHam(id){
  const st=ST(2.8),B="M56,172 C54,122 80,98 118,98 C156,98 182,122 180,172 Z";
  return {crop:'50 78 136 96',seed:true,defs:`<clipPath id="${id}-b"><path d="${B}"/></clipPath>`,
   pre:`<g class="squish"><circle cx="94" cy="103" r="7.5" fill="#F9C27A" ${st}/><circle cx="94" cy="103.5" r="3.6" fill="#FFA9B6"/><circle cx="142" cy="103" r="7.5" fill="#F9C27A" ${st}/><circle cx="142" cy="103.5" r="3.6" fill="#FFA9B6"/>
    <path d="${B}" fill="#F9C27A"/><g clip-path="url(#${id}-b)"><ellipse cx="118" cy="156" rx="44" ry="28" fill="#FFF4E4"/><ellipse cx="166" cy="140" rx="14" ry="34" fill="#EFAE62" opacity=".6"/></g><path d="${B}" fill="none" ${st}/>
    <path d="M90,110 C96,104 104,101 112,100" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>
    <ellipse cx="97" cy="134" rx="6" ry="3.4" fill="#FFA3B5" opacity=".85"/><ellipse cx="139" cy="134" rx="6" ry="3.4" fill="#FFA3B5" opacity=".85"/>
    <g class="look"><g class="eyes-open">${dot(106,126,3.3)}${dot(130,126,3.3)}</g><g class="eyes-happy">${happyArc(106,127,4,L0,2.4)}${happyArc(130,127,4,L0,2.4)}</g></g>
    <ellipse cx="118" cy="130.5" rx="2" ry="1.4" fill="#FF8090"/><path d="M115,133 q1.5,2 3,0 q1.5,2 3,0" fill="none" ${ST(1.6)}/></g>`,
   front:`<g class="pawL"><ellipse cx="106" cy="150" rx="5.5" ry="4.2" fill="#FFB8C3" ${st}/></g><g class="pawR"><ellipse cx="130" cy="150" rx="5.5" ry="4.2" fill="#FFB8C3" ${st}/></g>`};
}
function mochiCat(id){
  const st=ST(2.8),B="M60,172 C58,116 80,86 118,86 C156,86 178,116 176,172 Z";
  return {crop:'50 58 136 110',defs:`<clipPath id="${id}-b"><path d="${B}"/></clipPath>`,
   pre:`<g class="squish"><g class="tail"><path d="M70,160 C44,160 38,136 50,124" fill="none" stroke="${L0}" stroke-width="15" stroke-linecap="round"/><path d="M70,160 C44,160 38,136 50,124" fill="none" stroke="#FFB868" stroke-width="9.5" stroke-linecap="round"/></g>
    <path d="M74,104 L72,72 Q74,66 80,70 L102,88 Z" fill="#FFB868" ${st}/><path d="M162,104 L164,72 Q162,66 156,70 L134,88 Z" fill="#FFB868" ${st}/><path d="M78,96 L77,78 L94,90 Z" fill="#FFA9B6"/><path d="M158,96 L159,78 L142,90 Z" fill="#FFA9B6"/>
    <path d="${B}" fill="#FFB868"/><g clip-path="url(#${id}-b)"><ellipse cx="118" cy="160" rx="38" ry="26" fill="#FFF6EA"/><ellipse cx="170" cy="134" rx="14" ry="40" fill="#F29A48" opacity=".55"/></g><path d="${B}" fill="none" ${st}/>
    <path d="M108,90 v8 M118,88 v9 M128,90 v8" stroke="#E8893A" stroke-width="3.2" stroke-linecap="round"/>
    <ellipse cx="96" cy="126" rx="6.5" ry="3.6" fill="#FFA3B5" opacity=".85"/><ellipse cx="140" cy="126" rx="6.5" ry="3.6" fill="#FFA3B5" opacity=".85"/>
    <g class="look"><g class="eyes-open">${dot(104,117,3.5)}${dot(132,117,3.5)}</g><g class="eyes-happy">${happyArc(104,118,4.5,L0,2.4)}${happyArc(132,118,4.5,L0,2.4)}</g></g>
    <path d="M116,121.5 h4 l-2,2z" fill="#FF8090" ${ST(1.1)}/><path d="M114,124.5 q2,2.4 4,0 q2,2.4 4,0" fill="none" ${ST(1.7)}/>
    <path d="M86,122 h-10 M86,127 l-9,2 M150,122 h10 M150,127 l9,2" ${ST(1.7)}/></g>`,
   front:`<g class="pawL"><ellipse cx="100" cy="151" rx="8.5" ry="5.5" fill="#FFF6EA" ${st}/></g><g class="pawR"><ellipse cx="136" cy="151" rx="8.5" ry="5.5" fill="#FFF6EA" ${st}/></g>`};
}

/* ================== H1 經典大眼鼠（P0 家族） ================== */
function h1Ham(id){
  const st=ST(3),O='#F4A75A',W='#FFFBF4',OS='#E58F45';
  const HEAD='M68,98 a50,43 0 1,0 100,0 a50,43 0 1,0 -100,0 Z';
  return {crop:'54 40 128 112',seed:true,defs:`<clipPath id="${id}-h"><path d="${HEAD}"/></clipPath><clipPath id="${id}-b"><ellipse cx="118" cy="154" rx="42" ry="26"/></clipPath>`,
   pre:`<g class="head">
     <circle cx="80" cy="64" r="14" fill="${O}" ${st}/><circle cx="80" cy="65.5" r="7.5" fill="#FFA9B6"/><circle cx="156" cy="64" r="14" fill="${O}" ${st}/><circle cx="156" cy="65.5" r="7.5" fill="#FFA9B6"/>
     <ellipse cx="118" cy="154" rx="42" ry="26" fill="${W}"/><g clip-path="url(#${id}-b)"><rect x="70" y="120" width="20" height="60" fill="${O}"/><rect x="146" y="120" width="20" height="60" fill="${O}"/></g><ellipse cx="118" cy="154" rx="42" ry="26" fill="none" ${st}/>
     <path d="${HEAD}" fill="${W}"/>
     <g clip-path="url(#${id}-h)">
       <path d="M40,30 H113 V86 C108,99 98,105 86,107 C70,109 56,103 44,95 Z" fill="${O}"/>
       <path d="M196,30 H123 V86 C128,99 138,105 150,107 C166,109 180,103 192,95 Z" fill="${O}"/>
       <ellipse cx="166" cy="78" rx="18" ry="28" fill="${OS}" opacity=".55"/>
       <path d="M60,126 C90,142 150,140 178,112 L180,150 L60,150 Z" fill="#F1E5D6"/>
     </g>
     <path d="${HEAD}" fill="none" ${st}/>
     <path d="M80,74 C86,64 96,59 106,58" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>
     <ellipse cx="84" cy="116" rx="9.5" ry="5.5" fill="#FF9FB0" opacity=".85"/><ellipse cx="152" cy="116" rx="9.5" ry="5.5" fill="#FF9FB0" opacity=".85"/>${blushLines(84,116)}${blushLines(152,116)}
     <g class="look"><g class="eyes-open">${animeEye(97,95,id)}${animeEye(139,95,id)}</g><g class="eyes-happy">${happyArc(97,96,8.5,L0,3.6)}${happyArc(139,96,8.5,L0,3.6)}</g></g>
     <path d="M114.5,104.5 h7 q-.8,3.4 -3.5,4.2 q-2.7,-.8 -3.5,-4.2z" fill="#FF7F90" ${ST(1.5)}/>
     <path d="M112.5,111 q2.75,3.2 5.5,0 q2.75,3.2 5.5,0" fill="none" ${ST(2.2)}/>
     <rect x="115.8" y="112.6" width="4.4" height="4.2" rx="1" fill="#fff" ${ST(1.3)}/>
     <path d="M72,104 l-12,-3 M72,109.5 l-12,1.5 M164,104 l12,-3 M164,109.5 l12,1.5" ${ST(2)}/>
   </g>`,
   front:handPink(104,'pawL')+handPink(132,'pawR')};
}

/* ================== H2 鼓鼓頰麻糬鼠（P4 家族） ================== */
function h2Ham(id){
  const st=ST(2.8),G='#F7B868',W='#FFF6EA',B="M62,172 C60,126 84,100 118,100 C152,100 176,126 174,172 Z";
  const cheek=cx=>{const bx=cx+(cx<118?3:-3);return `<g class="puff" style="transform-origin:${cx}px 139px;animation-delay:${cx<118?0:-.6}s"><circle cx="${cx}" cy="139" r="20" fill="url(#${id}-ck)" ${st}/><ellipse cx="${bx}" cy="142" rx="8" ry="4.6" fill="#FFA3B5" opacity=".85"/>${blushLines(bx,142)}<path d="M${cx-12},128 q5,-7 12,-7" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" opacity=".85"/></g>`};
  return {crop:'50 88 136 92',seed:true,defs:`<clipPath id="${id}-b"><path d="${B}"/></clipPath><linearGradient id="${id}-ck" x1="0" y1="0" x2="0" y2="1"><stop offset=".42" stop-color="${G}"/><stop offset=".43" stop-color="${W}"/></linearGradient>`,
   pre:`<g class="squish">
    <circle cx="96" cy="105" r="8" fill="${G}" ${st}/><circle cx="96" cy="105.5" r="4" fill="#FFA9B6"/><circle cx="140" cy="105" r="8" fill="${G}" ${st}/><circle cx="140" cy="105.5" r="4" fill="#FFA9B6"/>
    <path d="${B}" fill="${G}"/><g clip-path="url(#${id}-b)"><ellipse cx="118" cy="166" rx="46" ry="30" fill="${W}"/><ellipse cx="168" cy="140" rx="14" ry="34" fill="#EFA552" opacity=".6"/></g><path d="${B}" fill="none" ${st}/>
    <path d="M118,104 v7" stroke="#E0923E" stroke-width="3" stroke-linecap="round"/>
    <path d="M94,112 C100,105 106,102 114,101" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>
    ${cheek(82)}${cheek(154)}
    <g class="look"><g class="eyes-open">${glossy(105,119,4.6,id)}${glossy(131,119,4.6,id)}</g><g class="eyes-happy">${happyArc(105,120,4.8,L0,2.6)}${happyArc(131,120,4.8,L0,2.6)}</g></g>
    <ellipse cx="118" cy="126" rx="2.4" ry="1.7" fill="#FF8090"/><path d="M114.5,129 q1.75,2.2 3.5,0 q1.75,2.2 3.5,0" fill="none" ${ST(1.7)}/>
    <g transform="rotate(-25 126 134)"><ellipse cx="126" cy="134" rx="5.6" ry="3" fill="#3A3A3A" ${ST(1.4)}/><path d="M121.5,133.5 h9 M122,135.2 h8" stroke="#fff" stroke-width=".9" opacity=".85"/></g>
   </g>`,
   front:`<g class="pawL"><ellipse cx="106" cy="150" rx="5.5" ry="4.2" fill="#FFB8C3" ${st}/></g><g class="pawR"><ellipse cx="130" cy="150" rx="5.5" ry="4.2" fill="#FFB8C3" ${st}/></g>`};
}

/* ================== S1 絨毛玩偶 ================== */
const stitch=(d,c='#9B6B45')=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="3.2 2.4" stroke-linecap="round"/>`;
const ringD=(cx,cy,rx,ry)=>`M${cx-rx},${cy} a${rx},${ry} 0 1,0 ${2*rx},0 a${rx},${ry} 0 1,0 ${-2*rx},0`;
const button=(cx,cy,r=6.6)=>`<g class="blink"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#1E1512"/><circle cx="${cx+2.2}" cy="${cy-2.4}" r="${r*.33}" fill="#fff" opacity=".9"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1.2"/></g>`;
function s1Ham(id){
  const Lc='#6B4A35',st=ST(2.4,Lc),base='#EDC08B',dk='#D9A56C',bel='#FFF2DC',pk='#F7A7B4',sc='#9B6B45';
  const pts=sample(t=>[118+53*Math.cos(t)*(1+.03*Math.sin(3*t)),120+51*Math.sin(t)],28).map(p=>[p[0],p[1]]);
  const BD=smoothPath(pts), IN=smoothPath(pts.map(([x,y])=>[118+(x-118)*.91,120+(y-120)*.91]));
  return {crop:'54 54 128 116',seed:true,defs:`<clipPath id="${id}-b"><path d="${BD}"/></clipPath>`,
   pre:`<g class="head">
    <g transform="rotate(-14 84 74)"><ellipse cx="84" cy="74" rx="14" ry="13" fill="${base}" ${st}/><ellipse cx="84" cy="75" rx="8" ry="7" fill="${pk}"/>${stitch('M73,74 a11,10 0 0 1 22,0',sc)}</g>
    <g transform="rotate(14 152 74)"><ellipse cx="152" cy="74" rx="14" ry="13" fill="${base}" ${st}/><ellipse cx="152" cy="75" rx="8" ry="7" fill="${pk}"/>${stitch('M141,74 a11,10 0 0 1 22,0',sc)}</g>
    <path d="${BD}" fill="${base}"/>
    <g clip-path="url(#${id}-b)"><ellipse cx="170" cy="126" rx="20" ry="50" fill="${dk}" opacity=".55"/><ellipse cx="118" cy="148" rx="35" ry="27" fill="${bel}"/></g>
    <path d="${BD}" fill="none" ${st}/>${stitch(IN,sc)}${stitch('M118,73 C117,82 119,90 118,97',sc)}${stitch('M85,148 a33,25 0 0 1 66,0',sc)}
    <circle cx="86" cy="120" r="8" fill="${pk}"/>${stitch(ringD(86,120,6,6),'#D7798C')}<circle cx="150" cy="120" r="8" fill="${pk}"/>${stitch(ringD(150,120,6,6),'#D7798C')}
    <g class="look"><g class="eyes-open">${button(100,104)}${button(136,104)}</g><g class="eyes-happy">${happyArc(100,105,6.5,'#1E1512',3)}${happyArc(136,105,6.5,'#1E1512',3)}</g></g>
    <path d="M114,111.5 h8 l-4,5 z" fill="${pk}" stroke="${sc}" stroke-width="1.2" stroke-linejoin="round"/><path d="M116,112.4 l2,3 M118,112 v3.6 M120,112.4 l-2,3" stroke="#E07F92" stroke-width=".8"/>
    <path d="M118,116.5 v3 M118,119.5 q-3,3 -6,1 M118,119.5 q3,3 6,1" fill="none" stroke="${sc}" stroke-width="1.8" stroke-linecap="round"/>
    ${stitch('M80,112 l-14,-3 M80,116.5 l-14,1 M156,112 l14,-3 M156,116.5 l14,1',sc)}
    <g transform="rotate(-12 64 70)"><path d="M70,74 Q76,78 80,77" fill="none" stroke="${sc}" stroke-width="1"/><rect x="55" y="62" width="17" height="13" rx="2" fill="#fff" stroke="${Lc}" stroke-width="1.6"/><text x="63.5" y="72" font-size="8.5" text-anchor="middle" font-weight="800" fill="#E0613A" font-family="Microsoft JhengHei UI,sans-serif">薪</text></g>
   </g>`,
   front:[104,132].map((cx,i)=>`<g class="paw${i?'R':'L'}"><ellipse cx="${cx}" cy="150" rx="8.5" ry="6.5" fill="${pk}" ${st}/>${stitch(`M${cx-5.5},150.5 a5.5,4 0 0 0 11,0`,'#D7798C')}</g>`).join('')};
}
function s1Cat(id){
  const Lc='#6B4A35',st=ST(2.4,Lc),base='#F2A15F',dk='#D9843F',cr='#FFF2DC',pk='#F7A7B4',sc='#9B5F35';
  const se=(t)=>{const c=Math.cos(t),s=Math.sin(t);return[118+50*Math.sign(c)*Math.abs(c)**.8,92+40*Math.sign(s)*Math.abs(s)**.8]};
  const pts=sample(se,32).map(p=>[p[0],p[1]]),HD=smoothPath(pts),IN=smoothPath(pts.map(([x,y])=>[118+(x-118)*.9,92+(y-92)*.88]));
  const TOR="M82,176 C78,144 90,124 118,122 C146,124 158,144 154,176 Z", TAIL="M86,154 C58,158 46,134 58,114";
  const strip=(x,y,r)=>`<g transform="rotate(${r} ${x} ${y})"><rect x="${x-4.5}" y="${y-7}" width="9" height="14" rx="4.5" fill="${dk}" stroke="${Lc}" stroke-width="1.4"/>${stitch(`M${x-2},${y-4} v8 M${x+2},${y-4} v8`,'#F7C28C')}</g>`;
  return {crop:'50 18 136 124',defs:`<clipPath id="${id}-h"><path d="${HD}"/></clipPath><clipPath id="${id}-t"><path d="${TOR}"/></clipPath>`,
   back:`<g class="tail"><path d="${TAIL}" fill="none" stroke="${Lc}" stroke-width="17.6" stroke-linecap="round"/><path d="${TAIL}" fill="none" stroke="${base}" stroke-width="13" stroke-linecap="round"/><path d="M64,148 l4,-10 M54,134 l9,-5" stroke="${dk}" stroke-width="5" stroke-linecap="round"/>${stitch('M86,150 C60,153 50,132 60,116',sc)}</g>
     <path d="${TOR}" fill="${base}"/><g clip-path="url(#${id}-t)"><ellipse cx="158" cy="152" rx="20" ry="40" fill="${dk}" opacity=".45"/><ellipse cx="118" cy="154" rx="20" ry="22" fill="${cr}"/></g><path d="${TOR}" fill="none" ${st}/>${stitch('M98,154 a20,22 0 0 1 40,0',sc)}`,
   front:[99,137].map((cx,i)=>`<g class="paw${i?'R':'L'}"><ellipse cx="${cx}" cy="151.5" rx="11" ry="7" fill="${cr}" ${st}/>${stitch(`M${cx-7.5},152 a7.5,4.5 0 0 0 15,0`,sc)}</g>`).join(''),
   post:`<g class="head">
     <path d="M74,76 Q66,40 76,32 Q86,30 104,54 Z" fill="${base}" ${st}/><path d="M162,76 Q170,40 160,32 Q150,30 132,54 Z" fill="${base}" ${st}/>
     <path d="M79,66 Q74,44 80,38 Q86,38 99,55 Z" fill="${pk}"/><path d="M157,66 Q162,44 156,38 Q150,38 137,55 Z" fill="${pk}"/>
     <path d="${HD}" fill="${base}"/><g clip-path="url(#${id}-h)"><ellipse cx="160" cy="108" rx="22" ry="34" fill="${dk}" opacity=".4"/></g><path d="${HD}" fill="none" ${st}/>${stitch(IN,sc)}
     ${strip(107,62,-12)}${strip(118,60,0)}${strip(129,62,12)}
     <circle cx="110" cy="108" r="9.5" fill="${cr}"/><circle cx="126" cy="108" r="9.5" fill="${cr}"/>${stitch('M102,112 a8,6 0 0 0 16,0 M118,112 a8,6 0 0 0 16,0',sc)}
     <circle cx="84" cy="104" r="6.5" fill="${pk}"/><circle cx="152" cy="104" r="6.5" fill="${pk}"/>
     <g class="look"><g class="eyes-open">${button(99,91)}${button(137,91)}</g><g class="eyes-happy">${happyArc(99,92,6.5,'#1E1512',3)}${happyArc(137,92,6.5,'#1E1512',3)}</g></g>
     <path d="M114,100 h8 l-4,5 z" fill="${pk}" stroke="${sc}" stroke-width="1.2" stroke-linejoin="round"/><path d="M118,105 v3 M118,108 q-3,3 -6,1 M118,108 q3,3 6,1" fill="none" stroke="${sc}" stroke-width="1.8" stroke-linecap="round"/>
     ${stitch('M100,104 l-16,-4 M100,109 l-16,1 M136,104 l16,-4 M136,109 l16,1',sc)}
   </g>`};
}

/* ================== S2 長毛蓬蓬 ================== */
function s2Ham(id){
  const R=rng(31),st=ST(2.6),base='#F8D3A0',sh='#EDB77A',lt='#FFF4E4';
  const BD=puffy(ell(118,121,49,47),[118,121],26,3.2,R), MZ=puffy(ell(118,141,33,25),[118,141],16,2.4,R);
  let fur='';const R2=rng(5);for(let i=0;i<18;i++){const a=R2()*Math.PI*2,r=.55+R2()*.3,x=118+51*r*Math.cos(a),y=120+49*r*Math.sin(a);if(y<92&&Math.abs(x-118)<26)continue;fur+=`<path d="M${f1(x)},${f1(y)} q${f1(2+R2()*2)},${f1(-3-R2()*2)} ${f1(5+R2()*2)},0" stroke="${R2()<.5?'#E9A866':'#FFE9C8'}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".85"/>`}
  return {crop:'54 56 128 116',seed:true,defs:`<clipPath id="${id}-b"><path d="${BD}"/></clipPath>`,
   pre:`<g class="head">
    <circle cx="88" cy="74" r="9" fill="${base}" ${st}/><circle cx="88" cy="75" r="4.5" fill="#FFA9B6"/><circle cx="148" cy="74" r="9" fill="${base}" ${st}/><circle cx="148" cy="75" r="4.5" fill="#FFA9B6"/>
    <path d="${BD}" fill="${base}"/><g clip-path="url(#${id}-b)"><ellipse cx="170" cy="128" rx="18" ry="46" fill="${sh}" opacity=".7"/><path d="${MZ}" fill="${lt}"/>${fur}</g><path d="${BD}" fill="none" ${st}/>
    <path d="M88,82 C98,72 138,72 148,82 Q148,92 140,89 Q136,96 128,91 Q118,99 108,91 Q100,96 96,89 Q88,92 88,82 Z" fill="${base}"/>
    <path d="M148,82 Q148,92 140,89 Q136,96 128,91 Q118,99 108,91 Q100,96 96,89 Q88,92 88,82" fill="none" ${ST(2.2)}/>
    <path d="M94,78 C100,74 108,72 116,72" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".8"/>
    <ellipse cx="88" cy="121" rx="8" ry="4.5" fill="#FF9FB0" opacity=".7"/><ellipse cx="148" cy="121" rx="8" ry="4.5" fill="#FF9FB0" opacity=".7"/>
    <g class="look"><g class="eyes-open">${glossy(101,104,7,id,`stroke="${L0}" stroke-width="1.6"`)}${glossy(135,104,7,id,`stroke="${L0}" stroke-width="1.6"`)}</g><g class="eyes-happy">${happyArc(101,105,7,L0,3)}${happyArc(135,105,7,L0,3)}</g></g>
    <path d="M114.6,113.5 q3.4,-1.8 6.8,0 q-.8,3.2 -3.4,4 q-2.6,-.8 -3.4,-4z" fill="#FF7F90" ${ST(1.3)}/>
    <path d="M118,117.5 v3 M118,120.5 q-2.6,2.8 -5.6,1.4 M118,120.5 q2.6,2.8 5.6,1.4" fill="none" ${ST(1.8)}/>
    <path d="M108,118 Q92,113 76,111 M108,121 Q91,121 74,123 M128,118 Q144,113 160,111 M128,121 Q145,121 162,123" fill="none" ${ST(1.2)} opacity=".7"/>
   </g>`,
   front:[102,134].map((cx,i)=>`<g class="paw${i?'R':'L'}"><path d="${puffy(ell(cx,141,7,8),[cx,141],9,1.4,rng(i+2))}" fill="${lt}" ${ST(2.2)}/>${[-1.5,-.5,.5,1.5].map(k=>`<ellipse cx="${cx+k*3.2}" cy="152.4" rx="1.7" ry="2.7" fill="#FFB8C3" ${ST(1.3)}/>`).join('')}<ellipse cx="${cx}" cy="149.4" rx="6" ry="4.2" fill="#FFB8C3" ${ST(1.6)}/></g>`).join('')};
}
function s2Cat(id){
  const R=rng(17),st=ST(2.6),W='#FFFDF8',sh='#E7E0EC';
  const HD=puffy(ell(118,92,48,38),[118,92],28,2.6,R), RUFF=puffy(ell(118,134,46,17),[118,134],20,3.4,R), TOR=puffy(ell(118,156,40,32),[118,156],20,2.6,R);
  const tail=(()=>{const f=t=>{const x=13*Math.cos(t),y=27*Math.sin(t),a=-.5;return[62+x*Math.cos(a)-y*Math.sin(a),126+x*Math.sin(a)+y*Math.cos(a)]};return puffy(f,[62,126],16,2.6,R)})();
  const blueEye=(cx,cy)=>`<g class="blink"><circle cx="${cx}" cy="${cy}" r="9" fill="url(#${id}-blue)" ${ST(2)}/><ellipse cx="${cx}" cy="${cy+.6}" rx="4.4" ry="6.4" fill="#16263A"/><ellipse cx="${cx+2.8}" cy="${cy-3.4}" rx="2.8" ry="2.5" fill="#fff"/><circle cx="${cx-2.8}" cy="${cy+3.8}" r="1.2" fill="#fff"/></g>`;
  return {crop:'50 18 136 124',defs:`<clipPath id="${id}-h"><path d="${HD}"/></clipPath>`,
   back:`<g class="tail"><path d="${tail}" fill="${W}" ${st}/><path d="M56,118 q4,-6 10,-6 M58,132 q4,-5 9,-5" stroke="${sh}" stroke-width="2" fill="none" stroke-linecap="round"/></g><path d="${TOR}" fill="${W}" ${st}/>`,
   front:[99,137].map((cx,i)=>`<g class="paw${i?'R':'L'}"><path d="${puffy(ell(cx,151,11,7),[cx,151],12,1.4,rng(9+i))}" fill="${W}" ${st}/><path d="M${cx-4},149 v3 M${cx+4},149 v3" ${ST(1.8)}/></g>`).join(''),
   post:`<g class="head"><path d="${RUFF}" fill="${W}" ${st}/>
     <path d="M76,74 Q70,44 78,36 Q88,36 104,54 Z" fill="${W}" ${st}/><path d="M160,74 Q166,44 158,36 Q148,36 132,54 Z" fill="${W}" ${st}/>
     <path d="M81,66 Q77,48 81,43 Q87,43 99,55 Z" fill="#FFC7B8"/><path d="M155,66 Q159,48 155,43 Q149,43 137,55 Z" fill="#FFC7B8"/>
     <path d="M84,62 l-1,-9 M89,60 l1,-8 M152,62 l1,-9 M147,60 l-1,-8" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
     <path d="${HD}" fill="${W}"/><g clip-path="url(#${id}-h)"><ellipse cx="160" cy="104" rx="22" ry="34" fill="${sh}"/><ellipse cx="118" cy="56" rx="24" ry="8" fill="#FFE3D2" opacity=".7"/></g><path d="${HD}" fill="none" ${st}/>
     <ellipse cx="86" cy="106" rx="7.5" ry="4.2" fill="#FFB3C1" opacity=".8"/><ellipse cx="150" cy="106" rx="7.5" ry="4.2" fill="#FFB3C1" opacity=".8"/>
     <g class="look"><g class="eyes-open">${blueEye(100,92)}${blueEye(136,92)}</g><g class="eyes-happy">${happyArc(100,93,8,L0,3.2)}${happyArc(136,93,8,L0,3.2)}</g></g>
     <path d="M115,101.5 h6 q-.6,3 -3,3.6 q-2.4,-.6 -3,-3.6z" fill="#FF9AAA" ${ST(1.4)}/><path d="M118,105 v2 M118,107 q-2.6,2.8 -5.2,1.2 M118,107 q2.6,2.8 5.2,1.2" fill="none" ${ST(1.8)}/>
     <path d="M104,106 Q88,102 72,101 M104,109 Q88,109 70,112 M132,106 Q148,102 164,101 M132,109 Q148,109 166,112" fill="none" ${ST(1.3)} opacity=".7"/>
   </g>`};
}

/* ================== S3 大頭軟Q ================== */
function s3Ham(id){
  const st=ST(3),G='#F8BC6A',W='#FFF9F0',HD='M60,96 a58,50 0 1,0 116,0 a58,50 0 1,0 -116,0 Z';
  return {crop:'48 22 140 128',seed:true,defs:`<clipPath id="${id}-h"><path d="${HD}"/></clipPath>`,
   pre:`<g class="head">
    <circle cx="74" cy="60" r="13" fill="${G}" ${st}/><circle cx="74" cy="61" r="7" fill="#FFA9B6"/><circle cx="162" cy="60" r="13" fill="${G}" ${st}/><circle cx="162" cy="61" r="7" fill="#FFA9B6"/>
    <g class="ahoge"><path d="M116,47 C112,34 118,26 128,28 C121,31 119,38 122,47 Z" fill="${G}" ${st}/></g>
    <path d="${HD}" fill="${W}"/><g clip-path="url(#${id}-h)"><path d="M50,30 H186 V94 C170,100 152,92 138,98 C130,92 106,92 98,98 C84,92 66,100 50,94 Z" fill="${G}"/><ellipse cx="168" cy="84" rx="16" ry="34" fill="#EFA552" opacity=".55"/><path d="M58,128 C90,148 146,148 178,126 L180,160 L56,160 Z" fill="#F3E8DA"/></g><path d="${HD}" fill="none" ${st}/>
    <path d="M78,72 C86,60 98,54 110,52" fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round" opacity=".85"/>
    ${kawaiiBlush(78,120)}${kawaiiBlush(158,120)}
    <g class="look"><g class="eyes-open">${kawaiiEye(96,104,id)}${kawaiiEye(140,104,id)}</g><g class="eyes-happy">${happyArc(96,106,9,L0,3.6)}${happyArc(140,106,9,L0,3.6)}</g></g>
    <path d="M115,112 h6 l-3,3.4z" fill="#FF7F90" ${ST(1.4)}/>
    <path d="M110.5,118 q7.5,10 15,0 z" fill="#C93A58" ${ST(2.2)}/><ellipse cx="118" cy="123.6" rx="4" ry="2.2" fill="#FF8FA3"/><rect x="114.6" y="118.4" width="3.2" height="3" rx=".8" fill="#fff"/><rect x="118.2" y="118.4" width="3.2" height="3" rx=".8" fill="#fff"/>
   </g>`,
   front:`<g class="pawL"><ellipse cx="106" cy="150" rx="7" ry="5.4" fill="#FFB8C3" ${ST(2.6)}/></g><g class="pawR"><ellipse cx="130" cy="150" rx="7" ry="5.4" fill="#FFB8C3" ${ST(2.6)}/></g>`};
}
const kawaiiEyeAmber=(cx,cy,id)=>`<g class="blink"><ellipse cx="${cx}" cy="${cy}" rx="9.8" ry="12" fill="url(#${id}-amber)" ${ST(1.8)}/><ellipse cx="${cx}" cy="${cy+1}" rx="5" ry="8.4" fill="#1A1020"/><ellipse cx="${cx+3}" cy="${cy-4.6}" rx="3.8" ry="3.4" fill="#fff"/><circle cx="${cx-3.4}" cy="${cy+5}" r="1.8" fill="#fff"/><path d="${star4(cx-4.2,cy-5.4,1.8)}" fill="#fff"/></g>`;
const S3_ORANGE={O:'#FFB45E',stripe:'#E8893A',shade:'#F29A48',muz:'#FFF6EA'};
const S3_CALICO={O:'#FFFDF8',stripe:null,shade:'#EFE4DC',muz:'#FFFFFF',earL:'#FFB45E',earR:'#4E3F3C',tail:'#4E3F3C',
  patch:'<path d="M50,30 L112,30 C110,58 96,72 72,80 C60,76 52,64 50,52 Z" fill="#FFB45E"/><path d="M126,30 L190,30 L190,80 C170,82 150,70 132,56 Z" fill="#4E3F3C"/><ellipse cx="160" cy="70" rx="10" ry="6" fill="#FFB45E"/>'};
const S3_BLACK={O:'#4A4560',stripe:null,shade:'#37324A',muz:'#FFFFFF',whisker:'#FFFFFF',amber:true,earIn:'#FF9EB5',chest:'#FFFFFF'};
function s3Cat(id,pal=S3_ORANGE){
  const st=ST(3),O=pal.O,HD='M60,94 a58,48 0 1,0 116,0 a58,48 0 1,0 -116,0 Z',eyeF=pal.amber?kawaiiEyeAmber:kawaiiEye;
  return {crop:'46 14 144 132',defs:`<clipPath id="${id}-h"><path d="${HD}"/></clipPath>`,
   back:`<g class="tail"><path d="M90,156 C60,160 46,134 60,112" fill="none" stroke="${L0}" stroke-width="18" stroke-linecap="round"/><path d="M90,156 C60,160 46,134 60,112" fill="none" stroke="${pal.tail||O}" stroke-width="12" stroke-linecap="round"/>${pal.stripe?`<path d="M60,116 l9,1" stroke="${pal.stripe}" stroke-width="4" stroke-linecap="round"/>`:''}</g>`,
   front:`<g class="pawL"><ellipse cx="104" cy="150" rx="10" ry="6.5" fill="#FFF6EA" ${st}/></g><g class="pawR"><ellipse cx="132" cy="150" rx="10" ry="6.5" fill="#FFF6EA" ${st}/></g>`,
   post:`<g class="head">
    <path d="M68,80 L62,30 Q63,21 73,25 L106,52 Z" fill="${pal.earL||O}" ${st}/><path d="M168,80 L174,30 Q173,21 163,25 L130,52 Z" fill="${pal.earR||O}" ${st}/><path d="M73,70 L69,37 L94,54 Z" fill="${pal.earIn||'#FFA9B6'}"/><path d="M163,70 L167,37 L142,54 Z" fill="${pal.earIn||'#FFA9B6'}"/>
    <path d="${HD}" fill="${O}"/><g clip-path="url(#${id}-h)">${pal.patch||''}<ellipse cx="118" cy="128" rx="34" ry="20" fill="${pal.muz}"/><ellipse cx="170" cy="96" rx="16" ry="40" fill="${pal.shade}" opacity=".55"/></g><path d="${HD}" fill="none" ${st}/>
    ${pal.stripe?`<path d="M118,48 v10 M106,50 q2,5 1.5,10 M130,50 q-2,5 -1.5,10 M60,92 h9 M61,101 h8 M176,92 h-9 M175,101 h-8" stroke="${pal.stripe}" stroke-width="4" stroke-linecap="round" fill="none"/>`:''}
    <path d="M78,68 C86,58 98,52 110,50" fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round" opacity="${pal.amber?.35:.85}"/>
    ${kawaiiBlush(78,114)}${kawaiiBlush(158,114)}
    <g class="look"><g class="eyes-open">${eyeF(96,98,id)}${eyeF(140,98,id)}</g><g class="eyes-happy">${happyArc(96,100,9,pal.amber?'#fff':L0,3.6)}${happyArc(140,100,9,pal.amber?'#fff':L0,3.6)}</g></g>
    <path d="M114.5,108 h7 l-3.5,3.6z" fill="#FF7F90" ${ST(1.4)}/><path d="M110,114 q4,5 8,0 q4,5 8,0" fill="none" ${ST(2.4)}/><path d="M115,116.4 q3,6 6,0 z" fill="#FF8FA3" ${ST(1.6)}/>
    <path d="M72,108 l-12,-2 M73,114 l-12,2 M164,108 l12,-2 M163,114 l12,2" ${ST(2,pal.whisker||L0)}/>
   </g>`};
}

/* ================== round 4 additions ================== */
/* N2 flat geometric chubby-cheek hamster */
function n2Ham(id){
  const O='#F4A259',D='#E38B3F',C='#FFF1DD',P='#FF9FB0',E='#2B2B3A',B="M60,172 A58,70 0 0 1 176,172 Z";
  const cheek=cx=>`<g class="puff" style="transform-origin:${cx}px 140px;animation-delay:${cx<118?0:-.6}s"><circle cx="${cx}" cy="140" r="20" fill="${C}"/><path d="M${cx-20},140 A20,20 0 0 1 ${cx+20},140 Z" fill="${cx<118?O:D}"/><circle cx="${cx+(cx<118?3:-3)}" cy="147" r="6" fill="${P}" opacity=".9"/></g>`;
  return {crop:'50 92 136 90',seed:true,defs:`<clipPath id="${id}-b"><path d="${B}"/></clipPath>`,
   pre:`<g class="squish"><circle cx="96" cy="108" r="10" fill="${D}"/><circle cx="96" cy="108" r="5" fill="${P}"/><circle cx="140" cy="108" r="10" fill="${D}"/><circle cx="140" cy="108" r="5" fill="${P}"/>
    <path d="${B}" fill="${O}"/><g clip-path="url(#${id}-b)"><rect x="118" y="90" width="70" height="90" fill="${D}" opacity=".45"/><ellipse cx="118" cy="172" rx="40" ry="28" fill="${C}"/></g>
    <path d="M113,103 h10 l-5,10 z" fill="${D}"/>${cheek(82)}${cheek(154)}
    <g class="look"><g class="eyes-open"><g class="blink"><circle cx="106" cy="122" r="4.8" fill="${E}"/><circle cx="107.6" cy="120.4" r="1.6" fill="#fff"/></g><g class="blink"><circle cx="130" cy="122" r="4.8" fill="${E}"/><circle cx="131.6" cy="120.4" r="1.6" fill="#fff"/></g></g><g class="eyes-happy">${happyArc(106,123,5,E,2.6)}${happyArc(130,123,5,E,2.6)}</g></g>
    <path d="M115,128 h6 l-3,3.6 z" fill="#E8607A"/><path d="M114.5,133 q1.75,2.2 3.5,0 q1.75,2.2 3.5,0" fill="none" stroke="${E}" stroke-width="1.6" stroke-linecap="round"/>
    <g transform="rotate(-25 126 137)"><ellipse cx="126" cy="137" rx="5.6" ry="3" fill="#3A3A3A"/><path d="M121.5,136.5 h9 M122,138.2 h8" stroke="#fff" stroke-width=".9" opacity=".85"/></g></g>`,
   front:`<g class="pawL"><circle cx="106" cy="150" r="5.5" fill="#FFB8C3"/></g><g class="pawR"><circle cx="130" cy="150" r="5.5" fill="#FFB8C3"/></g>`};
}
/* N6 gouache standing pear hamster */
function n6Ham(id){
  const B='#E9A867',D='#D88F4C',C='#FBEBD6',P='#F4A0AA',E='#3A2A24';
  const BD="M118,74 C142,74 156,92 158,116 C161,140 160,162 152,178 L84,178 C76,162 75,140 78,116 C80,92 94,74 118,74 Z";
  return {crop:'66 64 104 100',seed:true,defs:`<clipPath id="${id}-b"><path d="${BD}"/></clipPath>`,
   pre:`<g class="head"><circle cx="98" cy="80" r="9" fill="${D}"/><circle cx="98" cy="80" r="4.6" fill="${P}"/><circle cx="138" cy="80" r="9" fill="${D}"/><circle cx="138" cy="80" r="4.6" fill="${P}"/>
     <path d="${BD}" fill="${B}"/><g clip-path="url(#${id}-b)"><ellipse cx="118" cy="78" rx="40" ry="18" fill="${D}" opacity=".6"/><ellipse cx="160" cy="130" rx="12" ry="50" fill="${D}" opacity=".45"/><ellipse cx="118" cy="144" rx="27" ry="36" fill="${C}"/><ellipse cx="118" cy="106" rx="14" ry="9" fill="${C}"/></g>
     <circle cx="101" cy="110" r="6" fill="${P}" opacity=".7"/><circle cx="135" cy="110" r="6" fill="${P}" opacity=".7"/>
     <g class="look"><g class="eyes-open"><g class="blink"><circle cx="107" cy="99" r="3.6" fill="${E}"/><circle cx="108.2" cy="97.8" r="1.2" fill="#fff"/></g><g class="blink"><circle cx="129" cy="99" r="3.6" fill="${E}"/><circle cx="130.2" cy="97.8" r="1.2" fill="#fff"/></g></g><g class="eyes-happy">${happyArc(107,100,4,E,2.2)}${happyArc(129,100,4,E,2.2)}</g></g>
     <ellipse cx="118" cy="105" rx="2.6" ry="1.9" fill="#E07888"/><path class="keep" d="M118,107 v2 M118,109 q-2.2,2.2 -4.4,1 M118,109 q2.2,2.2 4.4,1" fill="none" stroke="${E}" stroke-width="1.3" stroke-linecap="round"/>
     <path class="keep" d="M108,106 l-14,-3 M108,109 l-14,1 M128,106 l14,-3 M128,109 l14,1" stroke="${E}" stroke-width=".9" opacity=".6"/>
     <ellipse cx="105" cy="137" rx="5.5" ry="11" transform="rotate(28 105 137)" fill="${B}"/><ellipse cx="131" cy="137" rx="5.5" ry="11" transform="rotate(-28 131 137)" fill="${B}"/></g>`,
   front:`<g class="pawL"><ellipse cx="101" cy="150" rx="5.5" ry="4.2" fill="${P}"/></g><g class="pawR"><ellipse cx="135" cy="150" rx="5.5" ry="4.2" fill="${P}"/></g>`};
}
/* N7 hamster peeking over a laptop */
function n7Ham(id){
  const st=ST(2.8),G='#F7B868',W='#FFF6EA',B="M70,176 C68,118 88,80 118,80 C148,80 168,118 166,176 Z";
  const petals=[0,45,90,135,180,225,270,315].map(a=>`<ellipse cx="0" cy="-10.5" rx="2.8" ry="4.2" fill="#FFD23F" stroke="${L0}" stroke-width="1.4" transform="rotate(${a})"/>`).join('');
  return {crop:'62 62 112 88',defs:`<clipPath id="${id}-b"><path d="${B}"/></clipPath>`,
   pre:`<g class="head"><circle cx="94" cy="86" r="10" fill="${G}" ${st}/><circle cx="94" cy="87" r="5" fill="#FFA9B6"/><circle cx="142" cy="86" r="10" fill="${G}" ${st}/><circle cx="142" cy="87" r="5" fill="#FFA9B6"/>
     <path d="${B}" fill="${G}"/><g clip-path="url(#${id}-b)"><ellipse cx="118" cy="128" rx="34" ry="22" fill="${W}"/><ellipse cx="164" cy="120" rx="12" ry="40" fill="#EFA552" opacity=".6"/></g><path d="${B}" fill="none" ${st}/>
     <path d="M118,84 v7" stroke="#E0923E" stroke-width="3" stroke-linecap="round"/><path d="M96,96 C100,89 106,86 112,85" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".8"/>
     <g class="look"><g class="eyes-open">${glossy(105,102,4.8,id)}${glossy(131,102,4.8,id)}</g><g class="eyes-happy">${happyArc(105,103,5,L0,2.6)}${happyArc(131,103,5,L0,2.6)}</g></g>
     <ellipse cx="93" cy="109" rx="5.5" ry="3.2" fill="#FFA3B5" opacity=".85"/><ellipse cx="143" cy="109" rx="5.5" ry="3.2" fill="#FFA3B5" opacity=".85"/><ellipse cx="118" cy="108.5" rx="2.2" ry="1.6" fill="#FF8090"/></g>`,
   front:`<path d="M62,117 Q62,111 68,111 H168 Q174,111 174,117 V159 H62 Z" fill="#E9ECF5" ${st}/><path d="M66,155 H170" stroke="#C9CEDD" stroke-width="2"/>
     <g transform="translate(118 134)">${petals}<circle r="7.5" fill="#8A5A2B" ${ST(1.6)}/><circle cx="-2" cy="-2" r="1.2" fill="#C8955A"/><circle cx="2" cy="1" r="1.2" fill="#C8955A"/></g>
     <g class="pawL"><ellipse cx="88" cy="111" rx="6.5" ry="4.6" fill="#FFB8C3" ${st}/></g><g class="pawR"><ellipse cx="148" cy="111" rx="6.5" ry="4.6" fill="#FFB8C3" ${st}/></g>`};
}
/* N8 tiny hamster hopping on the keyboard */
function n8Ham(id){
  const st=ST(2.4),G='#F7B868',W='#FFF6EA';
  return {crop:'72 106 56 52',defs:'',
   post:`<g class="hop"><ellipse cx="100" cy="155.5" rx="12" ry="2.6" fill="#3D2C24" opacity=".15"/>
     <circle cx="89" cy="121" r="5.5" fill="${G}" ${st}/><circle cx="89" cy="121.5" r="2.6" fill="#FFA9B6"/><circle cx="111" cy="121" r="5.5" fill="${G}" ${st}/><circle cx="111" cy="121.5" r="2.6" fill="#FFA9B6"/>
     <path d="M78,150 C76,132 86,118 100,118 C114,118 124,132 122,150 Q122,154 116,154 H84 Q78,154 78,150 Z" fill="${G}" ${st}/>
     <path d="M84,152 C86,141 92,137 100,137 C108,137 114,141 116,152 Z" fill="${W}"/>
     <path d="M86,126 C89,122 93,120 97,120" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>
     <g class="look"><g class="eyes-open">${dot(94,131,2.5)}${dot(106,131,2.5)}</g><g class="eyes-happy">${happyArc(94,132,2.8,L0,2)}${happyArc(106,132,2.8,L0,2)}</g></g>
     <ellipse cx="88" cy="137" rx="3.6" ry="2.2" fill="#FFA3B5"/><ellipse cx="112" cy="137" rx="3.6" ry="2.2" fill="#FFA3B5"/><ellipse cx="100" cy="135.5" rx="1.6" ry="1.2" fill="#FF8090"/>
     <ellipse cx="91" cy="155" rx="5" ry="2.6" fill="#FFB8C3" ${ST(1.6)}/><ellipse cx="109" cy="155" rx="5" ry="2.6" fill="#FFB8C3" ${ST(1.6)}/>
     <g class="pawL"><ellipse cx="89" cy="146" rx="3.4" ry="2.6" fill="#FFB8C3" ${ST(1.4)}/></g><g class="pawR"><ellipse cx="111" cy="146" rx="3.4" ry="2.6" fill="#FFB8C3" ${ST(1.4)}/></g></g>`};
}
/* K6 bread-loaf cat lying on the keyboard */
function k6Cat(id){
  const st=ST(2.8),B='#F6C27A',D='#E3A04F',W='#FFF8EC';
  const LOAF="M84,160 C80,136 96,124 124,124 H152 C172,124 184,136 182,152 C182,160 176,164 168,164 H92 C86,164 84,162 84,160 Z";
  return {crop:'58 80 128 92',defs:`<clipPath id="${id}-l"><path d="${LOAF}"/></clipPath>`,
   post:`<g class="tail"><path d="M180,150 C194,160 178,170 150,167" fill="none" stroke="${L0}" stroke-width="15" stroke-linecap="round"/><path d="M180,150 C194,160 178,170 150,167" fill="none" stroke="${B}" stroke-width="9.5" stroke-linecap="round"/></g>
     <path d="${LOAF}" fill="${B}"/><g clip-path="url(#${id}-l)"><path d="M84,124 H186 V134 C160,140 120,140 84,134 Z" fill="${D}" opacity=".55"/><ellipse cx="150" cy="168" rx="40" ry="12" fill="${D}" opacity=".35"/></g><path d="${LOAF}" fill="none" ${st}/>
     <path d="M128,130 q8,-5 16,0 M148,129 q8,-5 16,0 M166,133 q5,-3 9,1" fill="none" stroke="${D}" stroke-width="4" stroke-linecap="round"/>
     <ellipse cx="126" cy="161" rx="9" ry="5" fill="${W}" ${st}/>
     <g class="pawL"><ellipse cx="108" cy="157" rx="9.5" ry="5.6" fill="${W}" ${st}/><path d="M104.5,155 v3 M111.5,155 v3" ${ST(1.6)}/></g>
     <g class="head" style="transform-origin:90px 140px">
      <path d="M70,110 L64,84 L88,100 Z" fill="${B}" ${st}/><path d="M110,110 L116,84 L92,100 Z" fill="${B}" ${st}/><path d="M71,104 L68,90 L82,100 Z" fill="#FFA9B6"/><path d="M109,104 L112,90 L98,100 Z" fill="#FFA9B6"/>
      <circle cx="90" cy="124" r="26" fill="${B}" ${st}/>
      <path d="M84,101 v6 M90,99.5 v7 M96,101 v6" stroke="${D}" stroke-width="3.2" stroke-linecap="round"/>
      <ellipse cx="90" cy="135" rx="11" ry="7" fill="${W}"/>
      <ellipse cx="75" cy="131" rx="5" ry="3" fill="#FFA3B5"/><ellipse cx="105" cy="131" rx="5" ry="3" fill="#FFA3B5"/>
      <g class="look"><g class="eyes-open">${dot(81,123,3.3)}${dot(99,123,3.3)}</g><g class="eyes-happy">${happyArc(81,124,4,L0,2.4)}${happyArc(99,124,4,L0,2.4)}</g></g>
      <path d="M88,129.5 h4 l-2,2.2z" fill="#FF8090" ${ST(1.1)}/><path d="M86,133 q2,2.4 4,0 q2,2.4 4,0" fill="none" ${ST(1.7)}/>
      <path d="M66,128 h-9 M66,133 l-8,2 M114,128 h9 M114,133 l8,2" ${ST(1.6)}/></g>`};
}

/* ================== S4 扁平幾何（無描邊） ================== */
function s4Ham(id){
  const O='#F2A65A',D='#E08A3E',C='#FFF3E3';
  return {crop:'58 58 120 116',seed:true,defs:`<clipPath id="${id}-b"><circle cx="118" cy="122" r="52"/></clipPath>`,
   pre:`<g class="head"><circle cx="86" cy="76" r="13" fill="${D}"/><circle cx="86" cy="76" r="6.5" fill="#FF9FB0"/><circle cx="150" cy="76" r="13" fill="${D}"/><circle cx="150" cy="76" r="6.5" fill="#FF9FB0"/>
    <circle cx="118" cy="122" r="52" fill="${O}"/><g clip-path="url(#${id}-b)"><rect x="118" y="60" width="60" height="120" fill="${D}" opacity=".35"/><circle cx="118" cy="152" r="38" fill="${C}"/><rect x="118" y="110" width="40" height="80" fill="#F3E2CC" opacity=".6"/></g>
    <path d="M113,72 h10 l-5,12 z" fill="${D}"/><circle cx="118" cy="119" r="13" fill="${C}"/>
    <circle cx="90" cy="122" r="7.5" fill="#FF9FB0" opacity=".9"/><circle cx="146" cy="122" r="7.5" fill="#FF9FB0" opacity=".9"/>
    <g class="look"><g class="eyes-open"><g class="blink"><circle cx="101" cy="106" r="5" fill="#2B2B3A"/><circle cx="102.6" cy="104.4" r="1.6" fill="#fff"/></g><g class="blink"><circle cx="135" cy="106" r="5" fill="#2B2B3A"/><circle cx="136.6" cy="104.4" r="1.6" fill="#fff"/></g></g><g class="eyes-happy">${happyArc(101,107,5,'#2B2B3A',2.6)}${happyArc(135,107,5,'#2B2B3A',2.6)}</g></g>
    <path d="M114.5,114 h7 l-3.5,4 z" fill="#E8607A"/><path d="M114,121 q2,2.4 4,0 q2,2.4 4,0" fill="none" stroke="#2B2B3A" stroke-width="1.6" stroke-linecap="round"/></g>`,
   front:`<g class="pawL"><circle cx="104" cy="150" r="6.5" fill="#FFB8C3"/></g><g class="pawR"><circle cx="132" cy="150" r="6.5" fill="#FFB8C3"/></g>`};
}
function s4Cat(id){
  const O='#F2A65A',D='#E08A3E',C='#FFF3E3';
  return {crop:'56 24 124 120',defs:`<clipPath id="${id}-h"><circle cx="118" cy="92" r="44"/></clipPath><clipPath id="${id}-t"><path d="M78,178 A40,44 0 0 1 158,178 Z"/></clipPath>`,
   back:`<g class="tail"><path d="M88,156 C60,160 48,134 60,112" fill="none" stroke="${D}" stroke-width="12" stroke-linecap="round"/></g><path d="M78,178 A40,44 0 0 1 158,178 Z" fill="${O}"/><g clip-path="url(#${id}-t)"><rect x="118" y="120" width="44" height="60" fill="${D}" opacity=".35"/><circle cx="118" cy="160" r="20" fill="${C}"/></g>`,
   front:`<g class="pawL"><circle cx="102" cy="151" r="8" fill="${C}"/></g><g class="pawR"><circle cx="134" cy="151" r="8" fill="${C}"/></g>`,
   post:`<g class="head"><path d="M78,70 L80,32 L106,52 Z" fill="${O}"/><path d="M158,70 L156,32 L130,52 Z" fill="${D}"/><path d="M83,62 L84,42 L99,54 Z" fill="#FF9FB0"/><path d="M153,62 L152,42 L137,54 Z" fill="#FF9FB0"/>
    <circle cx="118" cy="92" r="44" fill="${O}"/><g clip-path="url(#${id}-h)"><rect x="118" y="40" width="50" height="100" fill="${D}" opacity=".35"/><path d="M108,48 h6 l-3,11 z M116,47 h5 l-2.5,12 z M122,48 h6 l-3,11 z" fill="${D}"/></g>
    <circle cx="110" cy="107" r="9" fill="${C}"/><circle cx="126" cy="107" r="9" fill="${C}"/>
    <circle cx="88" cy="104" r="6.5" fill="#FF9FB0" opacity=".9"/><circle cx="148" cy="104" r="6.5" fill="#FF9FB0" opacity=".9"/>
    <g class="look"><g class="eyes-open"><g class="blink"><circle cx="101" cy="92" r="5.4" fill="#2B2B3A"/><circle cx="102.8" cy="90.2" r="1.7" fill="#fff"/></g><g class="blink"><circle cx="135" cy="92" r="5.4" fill="#2B2B3A"/><circle cx="136.8" cy="90.2" r="1.7" fill="#fff"/></g></g><g class="eyes-happy">${happyArc(101,93,5.5,'#2B2B3A',2.6)}${happyArc(135,93,5.5,'#2B2B3A',2.6)}</g></g>
    <path d="M114.5,100 h7 l-3.5,4 z" fill="#E8607A"/><path d="M113,107 q2.5,2.6 5,0 q2.5,2.6 5,0" fill="none" stroke="#2B2B3A" stroke-width="1.6" stroke-linecap="round"/></g>`};
}

/* ================== S5 蠟筆手繪 ================== */
const scribble=(x,y,c='#FF7F9A')=>`<path d="M${x-8},${y+2} l3,-4 l3,4 l3,-4 l3,4 l3,-4" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
function s5Ham(id){
  const Lc='#4A3A30',st=ST(2.6,Lc),B="M64,174 C60,122 84,78 118,78 C152,78 176,122 172,174 Z";
  return {crop:'56 56 124 112',seed:true,defs:`<clipPath id="${id}-b"><path d="${B}"/></clipPath>`,
   pre:`<g class="head"><circle cx="92" cy="86" r="10" fill="#FFB347" ${st}/><circle cx="92" cy="87" r="5" fill="#FF9FB0"/><circle cx="144" cy="86" r="10" fill="#FFB347" ${st}/><circle cx="144" cy="87" r="5" fill="#FF9FB0"/>
    <path d="${B}" fill="#FFB347"/><g clip-path="url(#${id}-b)"><path d="M40,124 C66,114 90,122 118,118 C146,122 170,114 196,124 V200 H40 Z" fill="#FFF8EE"/><path d="M152,96 l10,-10 M156,104 l12,-12 M158,112 l12,-12" stroke="#E8902E" stroke-width="1.6" stroke-linecap="round"/></g><path d="${B}" fill="none" ${st}/>
    <path d="${star4(66,70,5)}" fill="#FFE066" class="tw" ${ST(1.2,Lc)}/><path d="${star4(172,64,4)}" fill="#FFE066" class="tw" style="animation-delay:-.8s" ${ST(1.2,Lc)}/>
    ${scribble(88,118)}${scribble(150,118)}
    <g class="look"><g class="eyes-open"><g class="blink"><circle cx="102" cy="106" r="4" fill="${Lc}"/><circle cx="103.4" cy="104.6" r="1.4" fill="#fff"/></g><g class="blink"><circle cx="134" cy="106" r="4" fill="${Lc}"/><circle cx="135.4" cy="104.6" r="1.4" fill="#fff"/></g></g><g class="eyes-happy">${happyArc(102,107,4.5,Lc,2.6)}${happyArc(134,107,4.5,Lc,2.6)}</g></g>
    <ellipse cx="118" cy="112" rx="2.6" ry="1.9" fill="#FF7F9A"/><path d="M113.5,115.5 q2.25,2.6 4.5,0 q2.25,2.6 4.5,0" fill="none" ${ST(2,Lc)}/>
    <path d="M86,110 l-12,-2 M86,114 l-12,2 M150,110 l12,-2 M150,114 l12,2" ${ST(1.6,Lc)}/></g>`,
   front:`<g class="pawL"><ellipse cx="104" cy="150" rx="7" ry="5.4" fill="#FF9FB0" ${st}/></g><g class="pawR"><ellipse cx="132" cy="150" rx="7" ry="5.4" fill="#FF9FB0" ${st}/></g>`};
}
function s5Cat(id){
  const Lc='#4A3A30',st=ST(2.6,Lc),O='#FFB347',HD="M70,92 C70,62 90,50 118,50 C146,50 166,62 166,92 C166,118 146,130 118,130 C90,130 70,118 70,92 Z";
  return {crop:'54 20 128 120',defs:`<clipPath id="${id}-h"><path d="${HD}"/></clipPath>`,
   back:`<g class="tail"><path d="M88,156 C60,160 48,134 60,114" fill="none" stroke="${Lc}" stroke-width="17" stroke-linecap="round"/><path d="M88,156 C60,160 48,134 60,114" fill="none" stroke="${O}" stroke-width="11.5" stroke-linecap="round"/></g>
     <path d="M86,176 C84,146 94,128 118,128 C142,128 152,146 150,176 Z" fill="${O}" ${st}/><ellipse cx="118" cy="154" rx="16" ry="18" fill="#FFF8EE"/>`,
   front:`<g class="pawL"><ellipse cx="102" cy="151" rx="10" ry="6.5" fill="#FFF8EE" ${st}/></g><g class="pawR"><ellipse cx="134" cy="151" rx="10" ry="6.5" fill="#FFF8EE" ${st}/></g>`,
   post:`<g class="head"><path d="M76,70 L74,34 L102,54 Z" fill="${O}" ${st}/><path d="M160,70 L162,34 L134,54 Z" fill="${O}" ${st}/><path d="M80,62 L79,42 L96,55 Z" fill="#FF9FB0"/><path d="M156,62 L157,42 L140,55 Z" fill="#FF9FB0"/>
    <path d="${HD}" fill="${O}"/><g clip-path="url(#${id}-h)"><ellipse cx="118" cy="112" rx="16" ry="10" fill="#FFF8EE"/><path d="M150,104 l8,-8 M152,110 l9,-9 M155,115 l8,-8" stroke="#E8902E" stroke-width="1.6" stroke-linecap="round"/></g><path d="${HD}" fill="none" ${st}/>
    <path d="M106,54 l3,9 M118,52 v10 M130,54 l-3,9" stroke="#E07B2E" stroke-width="3" stroke-linecap="round"/>
    <path d="${star4(62,44,5)}" fill="#FFE066" class="tw" ${ST(1.2,Lc)}/><path d="${star4(176,40,4)}" fill="#FFE066" class="tw" style="animation-delay:-.8s" ${ST(1.2,Lc)}/>
    ${scribble(88,106)}${scribble(150,106)}
    <g class="look"><g class="eyes-open"><g class="blink"><circle cx="100" cy="92" r="4.4" fill="${Lc}"/><circle cx="101.5" cy="90.5" r="1.5" fill="#fff"/></g><g class="blink"><circle cx="136" cy="92" r="4.4" fill="${Lc}"/><circle cx="137.5" cy="90.5" r="1.5" fill="#fff"/></g></g><g class="eyes-happy">${happyArc(100,93,5,Lc,2.6)}${happyArc(136,93,5,Lc,2.6)}</g></g>
    <path d="M115.5,103 h5 l-2.5,3 z" fill="#FF7F9A" ${ST(1.2,Lc)}/><path d="M113.5,107 q2.25,2.6 4.5,0 q2.25,2.6 4.5,0" fill="none" ${ST(2,Lc)}/>
    <path d="M72,100 l-12,-2 M72,105 l-12,2 M164,100 l12,-2 M164,105 l12,2" ${ST(1.6,Lc)}/></g>`};
}

/* ================== S6 線條印刷（Riso） ================== */
const INK='#2E3A87';
function s6Ham(id){
  const st=ST(2.2,INK),OR='#FF7A3D',PK='#FF48B0',B="M66,172 C62,124 86,82 118,82 C150,82 174,124 170,172 Z";
  return {crop:'58 66 120 104',seed:true,defs:'',
   pre:`<g class="head"><circle cx="94" cy="88" r="10" fill="${OR}" ${st}/><circle cx="94" cy="89" r="5" fill="${PK}"/><circle cx="142" cy="88" r="10" fill="${OR}" ${st}/><circle cx="142" cy="89" r="5" fill="${PK}"/>
    <path d="${B}" fill="${OR}" ${st}/><ellipse cx="118" cy="150" rx="38" ry="28" fill="#FFF6E6"/><path d="M82,140 C92,126 104,122 118,122 C132,122 144,126 154,140" fill="none" ${ST(1.6,INK)}/>
    <circle cx="90" cy="122" r="8" fill="${PK}"/><circle cx="146" cy="122" r="8" fill="${PK}"/>
    <g class="look"><g class="eyes-open"><g class="blink"><ellipse class="ink" cx="104" cy="110" rx="3.4" ry="4.4" fill="${INK}"/></g><g class="blink"><ellipse class="ink" cx="132" cy="110" rx="3.4" ry="4.4" fill="${INK}"/></g></g><g class="eyes-happy">${happyArc(104,111,4,INK,2.4)}${happyArc(132,111,4,INK,2.4)}</g></g>
    <path class="ink" d="M115.5,116 h5 l-2.5,3 z" fill="${INK}"/><path d="M118,119 v2.6 M118,121.6 q-2.4,2.4 -5,1 M118,121.6 q2.4,2.4 5,1" fill="none" ${ST(1.6,INK)}/>
    <path d="M88,114 l-14,-3 M88,118 l-14,1 M148,114 l14,-3 M148,118 l14,1" ${ST(1.4,INK)}/><path d="M112,90 q6,-4 12,0" fill="none" ${ST(1.6,INK)}/></g>`,
   front:`<g class="pawL"><ellipse cx="104" cy="150" rx="7" ry="5.4" fill="${OR}" ${st}/></g><g class="pawR"><ellipse cx="132" cy="150" rx="7" ry="5.4" fill="${OR}" ${st}/></g>`};
}
function s6Cat(id){
  const st=ST(2.2,INK),OR='#FF7A3D',PK='#FF48B0';
  return {crop:'54 22 128 116',defs:'',
   back:`<g class="tail"><path d="M88,156 C60,160 48,134 60,114" fill="none" stroke="${OR}" stroke-width="11" stroke-linecap="round"/><path d="M88,156 C60,160 48,134 60,114" fill="none" ${ST(1.6,INK)} stroke-dasharray="0"/></g>
     <path d="M84,176 C82,146 92,126 118,126 C144,126 154,146 152,176 Z" fill="${OR}" ${st}/><ellipse cx="118" cy="154" rx="16" ry="18" fill="#FFF6E6"/>`,
   front:`<g class="pawL"><ellipse cx="102" cy="151" rx="10" ry="6.5" fill="#FFF6E6" ${st}/></g><g class="pawR"><ellipse cx="134" cy="151" rx="10" ry="6.5" fill="#FFF6E6" ${st}/></g>`,
   post:`<g class="head"><path d="M76,72 L72,34 L102,54 Z" fill="${OR}" ${st}/><path d="M160,72 L164,34 L134,54 Z" fill="${OR}" ${st}/><path d="M80,64 L78,44 L95,56 Z" fill="${PK}"/><path d="M156,64 L158,44 L141,56 Z" fill="${PK}"/>
    <ellipse cx="118" cy="92" rx="46" ry="38" fill="${OR}" ${st}/><ellipse cx="118" cy="110" rx="15" ry="9" fill="#FFF6E6"/>
    <circle cx="88" cy="104" r="7" fill="${PK}"/><circle cx="148" cy="104" r="7" fill="${PK}"/>
    <path d="M108,58 l2,9 M118,56 v10 M128,58 l-2,9 M73,88 h9 M74,96 h8 M163,88 h-9 M162,96 h-8" ${ST(2,INK)}/>
    <g class="look"><g class="eyes-open"><g class="blink"><ellipse class="ink" cx="100" cy="92" rx="3.4" ry="4.6" fill="${INK}"/></g><g class="blink"><ellipse class="ink" cx="136" cy="92" rx="3.4" ry="4.6" fill="${INK}"/></g></g><g class="eyes-happy">${happyArc(100,93,4.5,INK,2.4)}${happyArc(136,93,4.5,INK,2.4)}</g></g>
    <path class="ink" d="M115.5,103 h5 l-2.5,3 z" fill="${INK}"/><path d="M118,106 v2 M118,108 q-2.6,2.6 -5.2,1 M118,108 q2.6,2.6 5.2,1" fill="none" ${ST(1.6,INK)}/>
    <path d="M100,106 l-16,-4 M100,110 l-16,1 M136,106 l16,-4 M136,110 l16,1" ${ST(1.4,INK)}/></g>`};
}

/* ================== style registry ================== */
const STYLES={
  p0:{name:'P0 Q版大眼',cat:p0Cat,hamster:p0HamV2,room:'sticker'},
  p0old:{name:'P0 舊版',cat:p0Cat,hamster:p0Ham,room:'sticker'},
  p4:{name:'P4 圓滾麻糬',cat:mochiCat,hamster:mochiHam,room:'sticker'},
  h1:{name:'H1 經典大眼鼠',cat:p0Cat,hamster:h1Ham,room:'sticker'},
  h2:{name:'H2 鼓鼓頰鼠',cat:mochiCat,hamster:h2Ham,room:'sticker'},
  s1:{name:'S1 絨毛玩偶',cat:s1Cat,hamster:s1Ham,room:'sticker',wrap:'felt'},
  s2:{name:'S2 長毛蓬蓬',cat:s2Cat,hamster:s2Ham,room:'sticker'},
  s3:{name:'S3 大頭軟Q',cat:s3Cat,hamster:s3Ham,room:'sticker'},
  s4:{name:'S4 扁平幾何',cat:s4Cat,hamster:s4Ham,room:'flat'},
  s5:{name:'S5 蠟筆手繪',cat:s5Cat,hamster:s5Ham,room:'crayon',wrap:'crayon'},
  s6:{name:'S6 線條印刷',cat:s6Cat,hamster:s6Ham,room:'riso',wrap:'riso'},
  n1:{name:'N1 蠟筆鼓鼓頰',cat:s5Cat,hamster:h2Ham,room:'crayon',wrap:'crayon'},
  n2:{name:'N2 幾何鼓鼓頰',cat:s4Cat,hamster:n2Ham,room:'flat'},
  n3:{name:'N3 剪紙',cat:s4Cat,hamster:s4Ham,room:'paper',wrap:'paper'},
  n4:{name:'N4 色鉛筆',cat:s5Cat,hamster:s5Ham,room:'pencil',wrap:'pencil'},
  n5:{name:'N5 水墨',cat:s5Cat,hamster:h2Ham,room:'ink',wrap:'ink'},
  n6:{name:'N6 水粉站立',cat:s4Cat,hamster:n6Ham,room:'gouache',wrap:'gouache'},
  n7:{name:'N7 筆電探頭',cat:k6Cat,hamster:n7Ham,room:'sticker'},
  n8:{name:'N8 鍵盤迷你鼠',cat:k6Cat,hamster:n8Ham,room:'sticker'},
  k1:{name:'K1 蠟筆大頭貓',cat:s3Cat,hamster:s5Ham,room:'crayon',wrap:'crayon'},
  k2:{name:'K2 大頭三花',cat:id=>s3Cat(id,S3_CALICO),hamster:s3Ham,room:'sticker'},
  k3:{name:'K3 大頭灰黑貓',cat:id=>s3Cat(id,S3_BLACK),hamster:s3Ham,room:'sticker'},
  k4:{name:'K4 色鉛筆貓',cat:s5Cat,hamster:s5Ham,room:'pencil',wrap:'pencil'},
  k5:{name:'K5 水墨貓',cat:s5Cat,hamster:h2Ham,room:'ink',wrap:'ink'},
  k6:{name:'K6 吐司貓',cat:k6Cat,hamster:n8Ham,room:'sticker'},
  k7:{name:'K7 剪紙貓',cat:s4Cat,hamster:s4Ham,room:'paper',wrap:'paper'}
};

/* ================== room ================== */
const cloudP=(y,s,delay,L,sw)=>`<g class="cloud" style="animation-delay:${delay}s"><path transform="translate(0,${y}) scale(${s})" d="M-12,6 Q-12,0 -6,0 Q-5,-7 2,-7 Q9,-7 10,-1 Q15,-1 15,4 Q15,8 11,8 L-9,8 Q-12,8 -12,6 Z" fill="#fff" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/></g>`;
const KEYS=()=>{let k='';for(let r=0;r<2;r++)for(let i=0;i<11;i++)k+=`<rect x="${75+i*8.2-r*1.5}" y="${149.5+r*4.4}" width="6" height="2.8" rx="1.2" fill="#CFC8E8"/>`;return k};
const pencilWrap=(id,m,cx=150,cy=100)=>`<g transform="rotate(-35 ${cx} ${cy})"><g filter="url(#${id}-pencil2)"><g transform="rotate(35 ${cx} ${cy})">${m}</g></g></g>`;
const inkWrap=(id,m)=>`<g class="wash" filter="url(#${id}-wash)">${m}</g><g class="inkline" filter="url(#${id}-inkf)">${m}</g>`;
function RW(mode,id,m){
  if(mode==='flat')return `<g class="flat">${m}</g>`;
  if(mode==='paper')return `<g filter="url(#${id}-gouache)"><g class="flat papercut">${m}</g></g>`;
  if(mode==='gouache')return `<g class="flat" filter="url(#${id}-gouache)">${m}</g>`;
  if(mode==='pencil')return pencilWrap(id,m);
  if(mode==='ink')return inkWrap(id,m);
  if(mode==='crayon')return `<g filter="url(#${id}-wobble)">${m}</g>`;
  if(mode==='riso')return `<g class="riso-fill" transform="translate(2.2 1.8)" filter="url(#${id}-grain)">${m}</g><g class="riso-line">${m}</g>`;
  return m;
}
function roomLine(mode){return mode==='crayon'?['#4A3A30',2.4]:mode==='riso'?[INK,2]:mode==='pencil'?['#5A4A40',2]:mode==='ink'?['#2B2420',2.2]:[L0,3]}
function room(id,mode){
  const [L,sw]=roomLine(mode), st=ST(sw,L), s2=`stroke="${L}" stroke-width="${Math.max(1.6,sw-.8)}"`;
  let lines='';const cc=['#FFD166','#7EE3A5','#FF8FA3','#9AD0FF'];
  for(let k=0;k<2;k++)for(let i=0;i<12;i++){const y=90+i*7+k*84,ind=[0,6,12,6,0,6,12,18,6,0,6,12][i],w=[30,42,22,36,48,26,18,30,40,24,34,20][i];lines+=`<rect x="${200+ind}" y="${y}" width="${Math.min(w,66-ind)}" height="3.2" rx="1.6" fill="${cc[(i+k)%4]}"/>`}
  const wall=mode==='riso'?'#FFF2DF':mode==='crayon'?'#FFF1DE':'#FFE6C7';
  return {L,sw,
   defs:`<pattern id="${id}-wp" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="1.8" fill="#FFD4A3"/></pattern><clipPath id="${id}-sky"><rect x="21" y="23" width="56" height="42" rx="5"/></clipPath><clipPath id="${id}-scr"><rect x="195" y="85" width="78" height="48" rx="5"/></clipPath>`,
   before:`<rect width="300" height="200" fill="${wall}"/>`+RW(mode,id,`<rect width="300" height="200" fill="url(#${id}-wp)" opacity="${mode==='sticker'?1:.5}"/>
    <rect x="14" y="16" width="70" height="56" rx="10" fill="#fff" ${st}/><rect x="21" y="23" width="56" height="42" rx="5" fill="#A8DCFF" ${s2}/>
    <g clip-path="url(#${id}-sky)"><circle cx="64" cy="34" r="7" fill="#FFD93D" ${s2}/>${cloudP(40,1,0,L,2)}${cloudP(55,.8,-9,L,2)}</g>
    <rect x="47" y="23" width="4" height="42" fill="#fff" ${s2}/><rect x="21" y="42" width="56" height="4" fill="#fff" ${s2}/>
    <g class="leaves"><ellipse cx="14" cy="116" rx="6" ry="15" transform="rotate(-24 14 116)" fill="#7CCB7E" ${st}/><ellipse cx="29" cy="114" rx="6" ry="16" transform="rotate(22 29 114)" fill="#7CCB7E" ${st}/><ellipse cx="21" cy="108" rx="6.5" ry="19" fill="#7CCB7E" ${st}/></g>
    <path d="M10,138 h24 l-3,17 h-18 z" fill="#E07A5F" ${st}/><rect x="7" y="132" width="30" height="8" rx="3.5" fill="#E07A5F" ${st}/>
    <rect x="228" y="138" width="10" height="13" fill="#7FB7E8" ${st}/><rect x="212" y="149" width="42" height="7" rx="3.5" fill="#7FB7E8" ${st}/>
    <rect x="188" y="78" width="92" height="62" rx="10" fill="#7FB7E8" ${st}/><rect x="195" y="85" width="78" height="48" rx="5" fill="#2C3E66" ${s2}/>
    <g clip-path="url(#${id}-scr)"><g class="code">${lines}</g></g>
    <g transform="rotate(-9 199 76)"><rect x="187" y="65" width="26" height="22" rx="2" fill="#FFE066" ${s2}/><text x="200" y="80" font-size="8.5" text-anchor="middle" font-weight="800" font-family="Fredoka,sans-serif" fill="${L}">GO!</text></g>
    <path class="steam keep" d="M264,126 q-4,-6 0,-12 q4,-6 0,-12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path class="steam keep" style="animation-delay:-1.3s" d="M273,126 q-4,-6 0,-12 q4,-6 0,-12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <path d="M278,137 q9,0 9,6.5 q0,6.5 -9,6.5" fill="none" stroke="${L}" stroke-width="${sw+4}"/><path class="keep" d="M278,137 q9,0 9,6.5 q0,6.5 -9,6.5" fill="none" stroke="#FF8FA3" stroke-width="3.5"/>
    <rect x="256" y="130" width="23" height="25" rx="5" fill="#FF8FA3" ${st}/><path d="M267.5,147 c-4,-3 -6,-5 -6,-7 a3,3 0 0 1 6,-1 a3,3 0 0 1 6,1 c0,2 -2,4 -6,7z" fill="#fff"/>`),
   desk:RW(mode,id,`<rect x="-4" y="160" width="308" height="90" fill="#C98A5E" ${st}/><rect x="-4" y="152" width="308" height="11" rx="4" fill="#E8AE80" ${st}/><path d="M72,146 H164 L171,159 H65 Z" fill="#F7F4FF" ${st}/>${KEYS()}`),
   paper:(mode==='crayon'||mode==='riso')?`<rect x="-10" y="-10" width="320" height="260" filter="url(#${id}-paper)" opacity=".2" style="mix-blend-mode:multiply" pointer-events="none"/>`:''};
}
function PW(ps,id,layer){
  if(!layer)return '';
  const w=STYLES[ps].wrap;
  if(w==='felt')return `<g filter="url(#${id}-felt)">${layer}</g>`;
  if(w==='crayon')return `<g filter="url(#${id}-crayon)">${layer}</g>`;
  if(w==='riso')return `<g class="riso-fill" transform="translate(2.2 1.8)" filter="url(#${id}-grain)">${layer}</g><g class="riso-line">${layer}</g>`;
  if(w==='paper')return `<g filter="url(#${id}-gouache)"><g class="papercut">${layer}</g></g>`;
  if(w==='gouache')return `<g class="flat" filter="url(#${id}-gouache)">${layer}</g>`;
  if(w==='pencil')return pencilWrap(id,layer,118,120);
  if(w==='ink')return inkWrap(id,layer);
  return layer;
}
function sceneSVG(ps,kind,vb='0 0 300 200'){
  const id='s'+(UID++),S=STYLES[ps],p=S[kind](id),r=room(id,S.room);
  return `<svg class="pet-svg" viewBox="${vb}" preserveAspectRatio="xMidYMid slice"><defs>${commonDefs(id)}${r.defs}${p.defs||''}</defs>${r.before}${PW(ps,id,p.back)}${PW(ps,id,p.pre)}${r.desk}${p.seed?PW(ps,id,SEED(r.L)):''}${PW(ps,id,p.front)}${PW(ps,id,p.post)}${r.paper}</svg>`;
}
function petOnlySVG(ps,kind){
  const id='s'+(UID++),S=STYLES[ps],p=S[kind](id),[L,sw]=roomLine(S.room);
  const desk=RW(S.room,id,`<rect x="44" y="152" width="148" height="18" rx="9" fill="#E8AE80" ${ST(sw,L)}/><path d="M72,146 H164 L171,159 H65 Z" fill="#F7F4FF" ${ST(sw,L)}/>${KEYS()}`);
  return `<svg class="pet-svg" viewBox="38 18 160 154"><defs>${commonDefs(id)}${p.defs||''}</defs>${PW(ps,id,p.back)}${PW(ps,id,p.pre)}${desk}${p.seed?PW(ps,id,SEED(L)):''}${PW(ps,id,p.front)}${PW(ps,id,p.post)}</svg>`;
}
function avatarSVG(ps,kind){
  const id='s'+(UID++),S=STYLES[ps],p=S[kind](id);
  return `<svg class="pet-svg" viewBox="${p.crop}" style="width:100%;height:100%"><defs>${commonDefs(id)}${p.defs||''}</defs>${PW(ps,id,p.back)}${PW(ps,id,p.pre)}${PW(ps,id,p.post)}</svg>`;
}

/* ================== odometer ================== */
class Odo{
  constructor(el){this.el=el;this.str=''}
  set(str){
    if(str.replace(/\d/g,'0')!==this.str.replace(/\d/g,'0')){
      this.el.innerHTML='';this.cols=[];
      for(const ch of str){if(/\d/.test(ch)){const d=document.createElement('span');d.className='d';const s=document.createElement('span');s.className='s';s.innerHTML=[...'0123456789'].map(n=>`<b>${n}</b>`).join('');d.appendChild(s);this.el.appendChild(d);this.cols.push(s)}else{const c=document.createElement('span');c.className='c';c.textContent=ch;this.el.appendChild(c);this.cols.push(null)}}
    }
    [...str].forEach((ch,i)=>{const s=this.cols[i];if(s)s.style.setProperty('--n',ch)});this.str=str;
  }
}

/* ================== interaction ================== */
const LINES={cat:['喵！今天也要努力賺罐罐！','鍵盤敲得好順手～','再撐一下就下班了喵！','這個 bug…是誰寫的喵？','錢錢一直跳，好有動力！'],
  hamster:['吱！瓜子錢又多一點了','臉頰塞滿了…是錢錢！','滾輪轉起來，工作衝起來！','再一下下就下班了吱～','今天也是努力的一天！']};
const PET_LINES={cat:'呼嚕呼嚕～好舒服 ♡',hamster:'吱吱～再摸一下嘛 ♡'};
const FEED_LINES={cat:'好吃！是小魚乾喵！',hamster:'瓜子！最愛瓜子了吱！'};
const stages=[];
function stage(el,kindFn,render,opts={}){
  const s={el,kindFn,render,opts};
  s.mount=()=>{el.innerHTML=render()+'<div class="fx">'+(opts.bubble===false?'':'<div class="bubble"></div>')+'</div>';s.svg=$('svg',el);s.fx=$('.fx',el);s.bubble=$('.bubble',el);s.svg.style.setProperty('--bd',(-Math.random()*4.6).toFixed(2)+'s')};
  el.onclick=e=>poke(s,e);s.mount();stages.push(s);return s;
}
function unstage(s){const i=stages.indexOf(s);if(i>=0)stages.splice(i,1)}
function say(s,text){
  const t=s.opts.sayEl||s.bubble;if(!t)return;
  clearInterval(s.tw);clearTimeout(s.hide);t.textContent='';
  if(!s.opts.sayEl)t.classList.add('show');
  let i=0;s.tw=setInterval(()=>{t.textContent=text.slice(0,++i);if(i>=text.length)clearInterval(s.tw)},55);
  if(!s.opts.sayEl)s.hide=setTimeout(()=>t.classList.remove('show'),4200);
}
function happy(s,ms=1600){s.svg.classList.add('happy');clearTimeout(s.happyT);s.happyT=setTimeout(()=>s.svg.classList.remove('happy'),ms)}
function hearts(s,x,y,n=7){
  for(let k=0;k<n;k++){
    const h=document.createElement('span');h.className='heart';h.textContent='♥';
    h.style.left=(x+Math.random()*40-20)+'px';h.style.top=y+'px';s.fx.appendChild(h);
    const dx=Math.random()*70-35,dy=-50-Math.random()*45,sc=.7+Math.random()*.8;
    h.animate([{transform:'translate(-50%,-50%) scale(0)',opacity:1},{transform:`translate(calc(-50% + ${dx*.4}px),calc(-50% + ${dy*.4}px)) scale(${sc})`,opacity:1,offset:.3},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(${sc*.8})`,opacity:0}],{duration:1100+Math.random()*400,easing:'cubic-bezier(.2,.7,.3,1)'}).onfinish=()=>h.remove();
  }
}
function poke(s,e){const r=s.el.getBoundingClientRect();happy(s);say(s,PET_LINES[s.kindFn()]);hearts(s,e.clientX-r.left,e.clientY-r.top)}
function feed(s){
  const r=s.el.getBoundingClientRect(),f=document.createElement('span');f.className='snack';f.textContent=s.kindFn()==='cat'?'🐟':'🌻';s.fx.appendChild(f);
  f.animate([{left:'95%',top:'-10%',transform:'rotate(0)'},{left:'45%',top:'38%',transform:'rotate(540deg) scale(.6)'}],{duration:800,easing:'cubic-bezier(.3,.1,.5,1)'}).onfinish=()=>{f.remove();happy(s,2000);say(s,FEED_LINES[s.kindFn()]);hearts(s,r.width*.45,r.height*.4,5)};
}
function tapFx(s){
  if(!s.fx||!s.svg||s.svg.classList.contains('happy')||s.opts.noTap)return;
  const t=document.createElement('span');t.className='tap';t.textContent=['✦','♪','✧'][Math.random()*3|0];t.style.color=['#FF8A3D','#4DA3FF','#FF5C7C','#1E9E5A'][Math.random()*4|0];
  t.style.left=(s.opts.tapX??28)+Math.random()*26+'%';t.style.top=(s.opts.tapY??70)+'%';s.fx.appendChild(t);
  t.animate([{transform:'translateY(0) scale(.6)',opacity:0},{opacity:1,offset:.2},{transform:`translate(${Math.random()*16-8}px,-28px) scale(1)`,opacity:0}],{duration:900,easing:'ease-out'}).onfinish=()=>t.remove();
}

/* ================== demo clock loop ================== */
const PER_SEC=50000/22/8/3600, FULL=8*3600;
const ITEMS=[{n:'珍奶',p:65,i:'🧋'},{n:'便當',p:100,i:'🍱'},{n:'拿鐵',p:120,i:'☕'}];
const pad=n=>String(Math.floor(n)).padStart(2,'0'), hms=s=>`${pad(s/3600)}:${pad(s%3600/60)}:${pad(s%60)}`, hm=s=>`${pad(s/3600)}:${pad(s%3600/60)}`;
const fmt=(n,d=2)=>n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const WD='日一二三四五六';
function startLoop(opts={}){
  const odos=$$('[data-odo]').map(el=>new Odo(el));
  const t0=performance.now(),base=new Date();base.setHours(14,32,7,0);const start=new Date(base);start.setHours(9,12,0,0);
  let lastSec=-1,lastTick=0,itemIdx=0,lineIdx=0;
  function frame(t){
    if(t-lastTick>110){
      lastTick=t;
      const now=new Date(base.getTime()+(t-t0)),worked=(now-start)/1000-3600,earned=worked*PER_SEC,pct=worked/FULL,sec=Math.floor(now/1000);
      odos.forEach(o=>o.el.isConnected&&o.set(fmt(earned)));
      if(sec!==lastSec){
        if(sec%4===0)itemIdx=(itemIdx+1)%3;
        const it=ITEMS[itemIdx],set=(sel,v)=>$$(sel).forEach(e=>e.textContent=v);
        set('[data-date]',`${now.getFullYear()}/${pad(now.getMonth()+1)}/${pad(now.getDate())}（${WD[now.getDay()]}）`);
        set('[data-clock]',hms(now.getHours()*3600+now.getMinutes()*60+now.getSeconds()));
        set('[data-hm]',`${pad(now.getHours())}:${pad(now.getMinutes())}`);
        set('[data-pct]',(pct*100).toFixed(1)+'%');set('[data-pct0]',Math.floor(pct*100)+'%');set('[data-remain]',hms(FULL-worked));set('[data-remain-hm]',hm(FULL-worked));set('[data-worked]',hms(worked));
        set('[data-item-label]',`可以買${it.n}`);set('[data-item]',`${it.i} ×${(earned/it.p).toFixed(1)}`);set('[data-month]',fmt(28412+earned,0));
        $$('[data-fill]').forEach(e=>e.style.width=(pct*100)+'%');$$('[data-fillh]').forEach(e=>e.style.height=(pct*100)+'%');$$('[data-ring]').forEach(e=>e.style.setProperty('--p',(pct*100).toFixed(1)));
        $$('[data-plus]').forEach(box=>{const p=document.createElement('span');p.className='plus';p.textContent='+0.08';p.style.right=(14+Math.random()*24)+'px';p.style.top='-4px';box.appendChild(p);
          p.animate([{transform:'translateY(6px)',opacity:0},{opacity:1,offset:.25},{transform:'translateY(-18px)',opacity:0}],{duration:1200,easing:'ease-out'}).onfinish=()=>p.remove()});
        if(sec%7===0){lineIdx=(lineIdx+1)%5;stages.forEach((s,i)=>setTimeout(()=>say(s,LINES[s.kindFn()][lineIdx]),i*90))}
        opts.onSecond&&opts.onSecond({now,worked,earned,pct});
      }
      stages.forEach(s=>{if(Math.random()<.4)tapFx(s)});
      lastSec=sec;
    }
    requestAnimationFrame(frame);
  }
  stages.forEach(s=>say(s,LINES[s.kindFn()][0]));
  requestAnimationFrame(frame);
  return {refreshOdos(){odos.splice(0,odos.length,...$$('[data-odo]').map(el=>new Odo(el)))}};
}
