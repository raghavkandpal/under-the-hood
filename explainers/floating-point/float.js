// IEEE 754 double and single precision: decompose, compose, neighbours. No DOM.

export function bits64(x) {
  const dv = new DataView(new ArrayBuffer(8)); dv.setFloat64(0, x);
  const hi = dv.getUint32(0), lo = dv.getUint32(4);
  return (hi.toString(2).padStart(32, "0") + lo.toString(2).padStart(32, "0"));
}
export function bits32(x) {
  const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, x);
  return dv.getUint32(0).toString(2).padStart(32, "0");
}
export function fromBits64(b) {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setUint32(0, parseInt(b.slice(0, 32), 2)); dv.setUint32(4, parseInt(b.slice(32), 2));
  return dv.getFloat64(0);
}
export function fromBits32(b) { const dv = new DataView(new ArrayBuffer(4)); dv.setUint32(0, parseInt(b, 2)); return dv.getFloat32(0); }

/** Split into sign / exponent / fraction with the decoded meaning. */
export function decompose(x, precision = 64) {
  const b = precision === 64 ? bits64(x) : bits32(x), E = precision === 64 ? 11 : 8, bias = precision === 64 ? 1023 : 127;
  const sign = b[0], exp = b.slice(1, 1 + E), frac = b.slice(1 + E), e = parseInt(exp, 2);
  let kind = "normal";
  if (e === 0) kind = /1/.test(frac) ? "subnormal" : "zero";
  else if (e === 2 ** E - 1) kind = /1/.test(frac) ? "NaN" : "infinity";
  const unbiased = kind === "subnormal" ? 1 - bias : e - bias;
  return { bits: b, sign, exp, frac, e, unbiased, kind, bias };
}

/** Exact decimal value of a double, as a string (every finite double is a finite decimal). */
export function exactDecimal(x) {
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return Object.is(x, -0) ? "-0" : "0";
  const { sign, frac, e, kind } = decompose(x, 64);
  let mant = BigInt("0b" + (kind === "subnormal" ? "0" : "1") + frac);
  let exp2 = (kind === "subnormal" ? -1022 : e - 1023) - 52;
  let s;
  if (exp2 >= 0) s = (mant << BigInt(exp2)).toString();
  else {
    const k = -exp2, num = mant * 5n ** BigInt(k); // mant / 2^k = mant*5^k / 10^k
    let digits = num.toString().padStart(k + 1, "0");
    s = (digits.slice(0, -k) || "0") + "." + digits.slice(-k);
    s = s.replace(/0+$/, "").replace(/\.$/, "");
  }
  return (sign === "1" ? "-" : "") + s;
}

/** Next representable double above x (toward +∞). */
export function nextUp(x) {
  if (Number.isNaN(x) || x === Infinity) return x;
  if (x === 0) return Number.MIN_VALUE;
  const dv = new DataView(new ArrayBuffer(8)); dv.setFloat64(0, x);
  let big = dv.getBigUint64(0);
  big = x > 0 ? big + 1n : big - 1n;
  dv.setBigUint64(0, big); return dv.getFloat64(0);
}
export const ulp = x => nextUp(Math.abs(x)) - Math.abs(x);
