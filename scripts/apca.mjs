// APCA contrast math (SAPC, 0.0.98G-4g constants), reimplemented from the
// published algorithm and constants: https://github.com/Myndex/SAPC-APCA
// (© Andrew Somers / Myndex; the apca-w3 reference package carries a W3
// license — this file is an independent math-only implementation for
// build-time token checks and cites the constants version it mirrors).
//
// Lc output is signed: positive for dark-on-light, negative for
// light-on-dark. Compare magnitudes against the APCA readability levels
// (Lc 90 preferred body, 75 body minimum, 60 content text, 45 large/heavy
// headline, 30 non-text UI, 15 discernibility threshold).

const SA98G = {
  mainTRC: 2.4,
  sRco: 0.2126729,
  sGco: 0.7151522,
  sBco: 0.072175,
  normBG: 0.56,
  normTXT: 0.57,
  revTXT: 0.62,
  revBG: 0.65,
  blkThrs: 0.022,
  blkClmp: 1.414,
  scaleBoW: 1.14,
  scaleWoB: 1.14,
  loBoWoffset: 0.027,
  loWoBoffset: 0.027,
  deltaYmin: 0.0005,
  loClip: 0.1
};

export function hexToRgb(hex) {
  const raw = hex.trim().replace(/^#/, "");
  const expanded = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    throw new Error(`not a hex color: ${hex}`);
  }
  return [
    parseInt(expanded.slice(0, 2), 16),
    parseInt(expanded.slice(2, 4), 16),
    parseInt(expanded.slice(4, 6), 16)
  ];
}

export function sRGBtoY(hex) {
  const [r, g, b] = hexToRgb(hex);
  const channel = (c) => Math.pow(c / 255, SA98G.mainTRC);
  return SA98G.sRco * channel(r) + SA98G.sGco * channel(g) + SA98G.sBco * channel(b);
}

export function apcaLc(textHex, backgroundHex) {
  let txtY = sRGBtoY(textHex);
  let bgY = sRGBtoY(backgroundHex);

  txtY = txtY > SA98G.blkThrs ? txtY : txtY + Math.pow(SA98G.blkThrs - txtY, SA98G.blkClmp);
  bgY = bgY > SA98G.blkThrs ? bgY : bgY + Math.pow(SA98G.blkThrs - bgY, SA98G.blkClmp);

  if (Math.abs(bgY - txtY) < SA98G.deltaYmin) return 0;

  let sapc;
  let output;
  if (bgY > txtY) {
    sapc = (Math.pow(bgY, SA98G.normBG) - Math.pow(txtY, SA98G.normTXT)) * SA98G.scaleBoW;
    output = sapc < SA98G.loClip ? 0 : sapc - SA98G.loBoWoffset;
  } else {
    sapc = (Math.pow(bgY, SA98G.revBG) - Math.pow(txtY, SA98G.revTXT)) * SA98G.scaleWoB;
    output = sapc > -SA98G.loClip ? 0 : sapc + SA98G.loWoBoffset;
  }
  return output * 100;
}

// WCAG 2.x ratio, kept for side-by-side reporting while the repo's rules
// migrate from 4.5:1 language to APCA Lc levels.
export function wcagRatio(hexA, hexB) {
  const lum = (hex) => {
    const [r, g, b] = hexToRgb(hex).map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(hexA), lum(hexB)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
