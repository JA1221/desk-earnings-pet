window.QJZ = window.QJZ || {};
// The small 1.1 icons (drop, tom, stand, rest, hp, cup), drawn from the mockup sprite (docs/prototypes/v1.1/index.html,
// <symbol id="i-…">). QJZ.icons.svg(name, cls) is an inline SVG with class "ic" (sized by the CSS that places it);
// an unknown name gives ''. Static markup only: nothing in it comes from the user.
QJZ.icons = (function () {
  var L = '#3D2C24';
  var ICONS = {
    drop: ['0 0 20 20',
      '<path d="M10,1.8 C12.6,6 16,9 16,12.7 A6,6 0 0 1 4,12.7 C4,9 7.4,6 10,1.8Z" fill="#9AD0FF" stroke="' + L + '" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M7.1,12.5 Q7.2,15 9.3,15.9" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>'],
    tom: ['0 0 20 20',
      '<path d="M10,5.2 C15.3,5.2 18.2,8.1 18.2,11.8 C18.2,15.8 14.7,18.6 10,18.6 C5.3,18.6 1.8,15.8 1.8,11.8 C1.8,8.1 4.7,5.2 10,5.2Z" fill="#FF6B57" stroke="' + L + '" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M5.4,6.7 Q7.5,5.8 8.3,4.3 Q9.4,6 10,5.6 Q10.7,4 11.9,4.4 Q12.4,5.9 14.6,6.5 Q12.3,8 10,7.1 Q7.7,8.1 5.4,6.7Z" fill="#5CC27A" stroke="' + L + '" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M10,5.2 V2.1" stroke="' + L + '" stroke-width="1.8" stroke-linecap="round"/>' +
      '<ellipse cx="6.4" cy="11.4" rx="1.3" ry="2.3" fill="#fff" opacity=".75" transform="rotate(22 6.4 11.4)"/>'],
    stand: ['0 0 20 20',
      '<path d="M10,8.6 V13.2 M10,9.6 L5.2,5.4 M10,9.6 L14.8,5.4 M10,13.2 L6.8,18.2 M10,13.2 L13.2,18.2" fill="none" stroke="' + L + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="10" cy="5" r="2.8" fill="#FF8A3D" stroke="' + L + '" stroke-width="1.6"/>'],
    rest: ['0 0 20 20',
      '<path d="M4,8.5 H14.5 V13 A4,4 0 0 1 10.5,17 H8 A4,4 0 0 1 4,13 Z" fill="#fff" stroke="' + L + '" stroke-width="1.7" stroke-linejoin="round"/>' +
      '<path d="M14.5,10 Q17.6,10 17.2,12.6 Q16.8,14.6 14.2,14.4" fill="none" stroke="' + L + '" stroke-width="1.7" stroke-linecap="round"/>' +
      '<path d="M7.4,6.6 Q6.4,5.2 7.4,3.8 M10.6,6.6 Q9.6,5.2 10.6,3.8" fill="none" stroke="' + L + '" stroke-width="1.4" stroke-linecap="round"/>' +
      '<path d="M5.4,10.5 H13.1 V12.6 A3,3 0 0 1 10.1,15.6 H8.4 A3,3 0 0 1 5.4,12.6 Z" fill="#8EE3B0"/>'],
    hp: ['0 0 20 20',
      '<path d="M3.6,12.5 V10.2 A6.4,6.4 0 0 1 16.4,10.2 V12.5" fill="none" stroke="' + L + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<rect x="1.8" y="10.4" width="4.6" height="7" rx="2.2" fill="#FF6B57" stroke="' + L + '" stroke-width="1.6"/>' +
      '<rect x="13.6" y="10.4" width="4.6" height="7" rx="2.2" fill="#FF6B57" stroke="' + L + '" stroke-width="1.6"/>'],
    cup: ['0 0 14 16',
      '<path d="M1.6,1.6 H12.4 L11.1,13.6 A1.6,1.6 0 0 1 9.5,15 H4.5 A1.6,1.6 0 0 1 2.9,13.6 Z" fill="#fff"/>' +
      '<path d="M2.3,5.3 H11.7 L10.7,13.6 H3.3 Z" fill="#7CC4FF"/>' +
      '<path d="M4.5,7.2 V11.4" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>' +
      '<path d="M1.6,1.6 H12.4 L11.1,13.6 A1.6,1.6 0 0 1 9.5,15 H4.5 A1.6,1.6 0 0 1 2.9,13.6 Z" fill="none" stroke="' + L + '" stroke-width="1.6" stroke-linejoin="round"/>']
  };

  // name: one of NAMES; cls: more classes (e.g. 'pi-foc').
  function svg(name, cls) {
    var ic = Object.prototype.hasOwnProperty.call(ICONS, name) ? ICONS[name] : null;
    if (!ic) return '';
    return '<svg class="ic ic-' + name + (cls ? ' ' + cls : '') + '" viewBox="' + ic[0] + '" aria-hidden="true" focusable="false">' + ic[1] + '</svg>';
  }

  return { svg: svg, NAMES: Object.keys(ICONS) };
})();
