/* 一只燕子一次扇翅循环。flap(phi) phi∈[0,1) → { far, body, near } 三条 SVG 路径（同色叠着画）。
   坐标：头朝 +x，原点在身体中心，身长（喙尖到尾叉根）= 100，y 朝下，背在 -y。
   身子是固定的一块；翅在 3D 里绕身体轴上下扇（翅根角 a、过了手腕那段慢半拍、上抬时半收），再用侧面略偏上的视角压成平面。 */
(function (root) {
  const K = 100 / 122, CX = 40;
  const DEG = Math.PI / 180;
  const P = { top: 76, bot: -52, down: 0.40, lag: 0.075, eps: 36, kz: 0.46, L: 1, farDa: -14, fw0: 0.05, fw1: 0.28 };
  const f1 = (v) => (Math.round(v * 10) / 10).toString();
  const pt = (x, y) => f1((x - CX) * K) + ',' + f1(y * K);
  function alpha(phi) {   // 翅根角：下扑快（占 down），上抬慢
    phi = ((phi % 1) + 1) % 1; const mid = (P.top + P.bot) / 2, amp = (P.top - P.bot) / 2;
    return phi < P.down ? mid + amp * Math.cos(Math.PI * phi / P.down) : mid - amp * Math.cos(Math.PI * (phi - P.down) / (1 - P.down));
  }
  function fold(phi) {    // 上抬时半收
    phi = ((phi % 1) + 1) % 1; if (phi < P.down) return 0.06 * Math.sin(Math.PI * phi / P.down);
    return 0.82 * Math.pow(Math.sin(Math.PI * (phi - P.down) / (1 - P.down)), 0.9);
  }
  function wing(phi, sgn) {
    const aIn = (alpha(phi) + (sgn < 0 ? P.farDa : 0)) * DEG, aOut = (alpha(phi - P.lag) + (sgn < 0 ? P.farDa : 0)) * DEG, f = fold(phi);
    const sw = 50, ce = Math.cos(P.eps * DEG), se = Math.sin(P.eps * DEG);
    const prj = (s, b) => {
      let up, out;
      if (s <= sw) { up = s * Math.sin(aIn); out = s * Math.cos(aIn); }
      else { up = sw * Math.sin(aIn) + (s - sw) * Math.sin(aOut); out = sw * Math.cos(aIn) + (s - sw) * Math.cos(aOut); }
      // 扇翅平面是斜的（照马雷的连拍对的）：下扑时翅往前下方扫，举起来时偏后
      const fw = s <= sw ? s * (P.fw0 - P.fw1 * Math.sin(aIn)) : sw * (P.fw0 - P.fw1 * Math.sin(aIn)) + (s - sw) * (P.fw0 - P.fw1 * Math.sin(aOut));
      const x3 = 62 - b + fw, y3 = 6 + up, z3 = sgn * (8 + out);
      return pt(x3 + P.kz * z3, -y3 * ce + z3 * se);
    };
    // 翅的平面形（s 沿翅展，b 往后）：前缘外凸，后缘深凹，根宽
    const tip = [140 - 46 * f, 88 + 40 * f];
    return 'M' + prj(0, 0) + ' C' + prj(40, -6) + ' ' + prj(94 - 20 * f, 24 + 14 * f) + ' ' + prj(tip[0], tip[1]) +
      ' C' + prj(92 - 30 * f, 50 + 22 * f) + ' ' + prj(44 - 6 * f, 40 + 8 * f) + ' ' + prj(8, 76) + ' Z';
  }
  function body(phi) {
    const d = 2.2 * Math.sin(2 * Math.PI * (phi - 0.12));   // 尾叉跟着轻轻摆一点
    const q = (x, y, w) => pt(x, y + d * w);
    return 'M' + pt(101, 5) + ' L' + pt(92, 0.5) + ' C' + pt(92, -7) + ' ' + pt(85, -12.5) + ' ' + pt(76, -13) + ' C' + pt(72, -13.5) + ' ' + pt(68, -13) + ' ' + pt(64, -12) +
      ' C' + pt(44, -18) + ' ' + pt(6, -17) + ' ' + pt(-22, -8) +
      ' C' + q(-50, -6, .3) + ' ' + q(-84, 0, .8) + ' ' + q(-114, 8, 1.4) + ' C' + q(-88, 5, .9) + ' ' + q(-66, 4, .5) + ' ' + q(-50, 5, .3) +
      ' C' + q(-68, 10, .5) + ' ' + q(-88, 18, .9) + ' ' + q(-106, 30, 1.4) + ' C' + q(-80, 22, .8) + ' ' + q(-50, 14, .3) + ' ' + pt(-22, 9) +
      ' C' + pt(4, 23) + ' ' + pt(44, 22) + ' ' + pt(64, 12) + ' C' + pt(68, 11.5) + ' ' + pt(71, 10.5) + ' ' + pt(75, 10.5) + ' C' + pt(80, 11) + ' ' + pt(85, 11.5) + ' ' + pt(89.5, 9) + ' Z';
  }
  function flap(phi) { return { far: wing(phi, -1), body: body(phi), near: wing(phi, 1) }; }
  root.flap = flap; root.FLAP_P = P;
})(typeof window !== 'undefined' ? window : globalThis);
