// Hamster P0 Q版大眼鼠 — the revised golden (Syrian) hamster: black glossy eyes, golden back, white muzzle and
// chest, dark cheek flashes, Y mouth, no teeth. Port of docs/prototypes/shared.js p0HamV2.
(function (P) {
  var C = P.common, ST = C.ST, L = C.L0;
  var G = '#F2A54E', GD = '#DD8A34', W = '#FFF8EE', WS = '#F1E4D2', FL = '#B9773C';
  var BODY = 'M118,64 C150,64 170,84 172,108 L179,114 L171,118 L177,125 L168,128 C166,150 150,170 118,172 C86,170 70,150 68,128 L59,125 L65,118 L57,114 L64,108 C66,84 86,64 118,64 Z';

  function ear(cx, r, st) {
    return `<g transform="rotate(${r} ${cx} 72)"><ellipse cx="${cx}" cy="72" rx="12.5" ry="13" fill="${GD}" ${st}/><ellipse cx="${cx}" cy="73.5" rx="7.6" ry="8.2" fill="#FFB3BE"/><ellipse cx="${cx - 1.5}" cy="71" rx="3" ry="3.6" fill="#fff" opacity=".45"/></g>`;
  }

  P.register({
    id: 'hamster:p0', kind: 'hamster', skin: 'p0', name: 'Q版大眼鼠', room: 'sticker', wrap: null,
    build: function (uid) {
      var st = ST(3);
      return {
        crop: '52 52 132 118',
        seed: true,
        defs: `<clipPath id="${uid}-bc"><path d="${BODY}"/></clipPath>`,
        layers: {
          back: '',
          pre: `<g class="head">${ear(86, -20, st)}${ear(150, 20, st)}
    <path d="${BODY}" fill="${G}"/>
    <g clip-path="url(#${uid}-bc)">
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
    <!--EYES-->
    <path d="M114.8,109.4 q3.2,-1.6 6.4,0 q-.8,3 -3.2,3.8 q-2.4,-.8 -3.2,-3.8z" fill="#FF8090" ${ST(1.4)}/>
    <!--MOUTH-->
    <path d="M108,113 Q94,108 80,107 M108,116 Q93,116 78,119 M128,113 Q142,108 156,107 M128,116 Q143,116 158,119" fill="none" ${ST(1.5)} opacity=".85"/>
    <path d="M100,130 L112,137 M136,130 L124,137" stroke="#4DA3FF" stroke-width="3" stroke-linecap="round"/>${C.badge(110, 135.5)}</g>`,
          front: `<g class="pawL"><ellipse cx="104" cy="150" rx="8.5" ry="6.5" fill="#FFB8C3" ${st}/><path d="M100.5,147.5 v3 M104,147 v3.2 M107.5,147.5 v3" ${ST(1.6)}/></g><g class="pawR"><ellipse cx="132" cy="150" rx="8.5" ry="6.5" fill="#FFB8C3" ${st}/><path d="M128.5,147.5 v3 M132,147 v3.2 M135.5,147.5 v3" ${ST(1.6)}/></g>`,
          post: ''
        },
        face: {
          eyes: [[100, 100], [136, 100]], eyeR: 7.6, eyeStyle: 'ham', ink: L, arc: [7, 3.4],
          mouth: [118, 113.4], mouthStyle: 'y', mouthSize: [5.4, 3.8], mouthSW: 2
        }
      };
    }
  });
})(QJZ.pets);
