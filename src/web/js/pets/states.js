window.QJZ = window.QJZ || {};
QJZ.pets = QJZ.pets || {};
// The pet states (spec §5.1). Each state picks a body pose, default eyes and mouth, an arm pose and props;
// compose puts .st-<name> on the root <svg> and pets.css animates the state from there.
//   pose:  'desk' (sitting behind the desk, the Task 9 art), 'lie' (asleep on the desk), 'dangle' (held up)
//   arms:  'type' | 'rest' | 'up' | 'hold' | 'scratch' | 'wave', 1.1 'hello' | 'cup' | 'glass'   (see rig.js); a held
//          prop forces 'hold' unless the arms hold it themselves (rig.GRIP)
//   alt:   a second frame {eyes, mouth, arms} that pets.css swaps in for part of the loop (.eyes-alt,
//          .mouth-b, .pose-b); dropped when the caller passes its own expression / mouth
// label / group are the Chinese names used on the review page.
// NAMES: the 18 1.0 states in review order. The 1.1 poses (QJZ.pets.NEW_POSES, spec §5.8) are got by name too, but
// a skin shows them only once it declares them (QJZ.pets.poseFor; the poses review page previews them).
//   wave     jumps and waves the left paw at you, with knock marks (the sit-only reminder; WAVE_MS, then idle)
//   holdCup  waves with the left paw while the right one holds a glass of water, then holds it in both (water
//            reminders); the wave plays once when the pose appears, and again each time it is redrawn (a knock)
//   sip      the straw at the mouth, eyes closed, the water going down; then ^^ (SIP_MS, plays once)
//   focus    typing with headphones on, brows set, the tip of the tongue out (a pomodoro focus)
QJZ.pets.states = (function () {
  var LIST = [
    ['idle', { group: '未上班', label: '發呆', eyes: 'open', mouth: 'neutral', arms: 'rest', props: [] }],
    ['doze', { group: '未上班', label: '打瞌睡', eyes: 'sleepy', mouth: 'neutral', arms: 'rest', props: ['z'], alt: { eyes: 'open' } }],
    ['typing', { group: '上班中', label: '打字', eyes: 'open', mouth: 'neutral', arms: 'type', props: [] }],
    ['stretch', { group: '上班中', label: '伸懶腰', eyes: 'open', mouth: 'neutral', arms: 'rest', props: ['sparkle'], alt: { eyes: 'closed', mouth: 'open', arms: 'up' } }],
    ['yawn', { group: '上班中', label: '打哈欠', eyes: 'open', mouth: 'neutral', arms: 'rest', props: ['tear'], alt: { eyes: 'closed', mouth: 'yawn' } }],
    ['coffee', { group: '上班中', label: '喝咖啡', eyes: 'open', mouth: 'neutral', arms: 'hold', props: ['coffee'], alt: { eyes: 'closed' } }],
    ['stare', { group: '上班中', label: '盯螢幕', eyes: 'open', mouth: 'neutral', arms: 'rest', props: ['dots'] }],
    ['scratch', { group: '上班中', label: '抓頭', eyes: 'open', mouth: 'pout', arms: 'scratch', props: ['question'] }],
    ['sprint', { group: '衝刺', label: '衝刺', eyes: 'angry', mouth: 'neutral', arms: 'type', props: ['fire', 'sweat'] }],
    ['lunchSleep', { group: '午休', label: '趴桌睡', pose: 'lie', eyes: 'closed', mouth: 'neutral', arms: 'none', props: ['zzz', 'bubble'] }],
    ['lunchEat', { group: '午休', label: '吃便當', eyes: 'happy', mouth: 'chew', arms: 'hold', props: ['bento', 'onigiri'] }],
    ['celebrate', { group: '下班', label: '慶祝', eyes: 'happy', mouth: 'smile', arms: 'up', props: ['confetti'] }],
    ['waitBag', { group: '下班', label: '背包包等你', eyes: 'sparkle', mouth: 'smile', arms: 'wave', props: ['bag', 'notes', 'sparkle'] }],
    ['petted', { group: '互動', label: '被摸摸', eyes: 'happy', mouth: 'smile', arms: 'rest', props: ['hearts'] }],
    ['angry', { group: '互動', label: '生氣', eyes: 'angry', mouth: 'pout', arms: 'rest', props: ['smoke', 'anger', 'puff'] }],
    ['eat', { group: '互動', label: '吃零食', eyes: 'happy', mouth: 'chew', arms: 'hold', props: ['snack', 'crumbs'] }],
    ['hop', { group: '互動', label: '里程碑', eyes: 'happy', mouth: 'smile', arms: 'rest', props: ['coin'], alt: { arms: 'up' } }],
    ['dangle', { group: '互動', label: '被拎起來', pose: 'dangle', eyes: 'dazed', mouth: 'tiny', arms: 'none', props: ['blush'] }]
  ];
  var POSES11 = [
    ['wave', { group: '1.1', label: '跳起來揮手（敲窗）', eyes: 'sparkle', mouth: 'smile', arms: 'hello', props: ['knock'] }],
    ['holdCup', { group: '1.1', label: '捧著水杯揮手', eyes: 'sparkle', mouth: 'smile', arms: 'cup', props: ['glass', 'knock'], alt: { arms: 'glass' } }],
    ['sip', { group: '1.1', label: '喝一口', eyes: 'closed', mouth: 'tiny', arms: 'glass', props: ['sipGlass', 'fresh'], alt: { eyes: 'happy', mouth: 'smile' } }],
    ['focus', { group: '1.1', label: '戴耳機專心打字', eyes: 'open', mouth: 'neutral', arms: 'type', props: ['headphones', 'brows', 'tongue'] }]
  ];
  var BY = {};
  LIST.concat(POSES11).forEach(function (e) { BY[e[0]] = e[1]; });

  return {
    NAMES: LIST.map(function (e) { return e[0]; }),
    get: function (name) { return BY.hasOwnProperty(name) ? BY[name] : null; }
  };
})();
