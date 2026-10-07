export function mean(a: number[]) {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}

export function variance(a: number[]) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1);
}

export function pearson(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

function erf(x: number) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function normalCDF(z: number) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function pearsonPValue(r: number, n: number) {
  if (n < 3 || Math.abs(r) >= 1) return Math.abs(r) >= 1 ? 0 : 1;
  const t = (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r);
  return 2 * (1 - normalCDF(Math.abs(t)));
}

function solveLinear(A: number[][], b: number[]) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const div = M[col][col] || 1e-12;
    for (let c = col; c <= n; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

export function multipleRegression(X: number[][], y: number[]) {
  const n = y.length;
  if (!n || !X[0]?.length) {
    return { coefficients: [] as number[], rSquared: 0, intercept: 0 };
  }
  const k = X[0].length;
  const XtX: number[][] = Array.from({ length: k + 1 }, () =>
    Array(k + 1).fill(0),
  );
  const Xty = Array(k + 1).fill(0);
  for (let i = 0; i < n; i++) {
    const row = [1, ...X[i]];
    for (let a = 0; a < k + 1; a++) {
      Xty[a] += row[a] * y[i];
      for (let b = 0; b < k + 1; b++) XtX[a][b] += row[a] * row[b];
    }
  }
  const coef = solveLinear(XtX, Xty);
  const intercept = coef[0];
  const coefficients = coef.slice(1);
  const yMean = mean(y);
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred =
      intercept + X[i].reduce((s, v, j) => s + v * coefficients[j], 0);
    ssTot += (y[i] - yMean) ** 2;
    ssRes += (y[i] - pred) ** 2;
  }
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { coefficients, rSquared, intercept };
}

export function cronbachAlpha(rows: Record<string, number>[], items: string[]) {
  if (rows.length < 2 || items.length < 2) return 0;
  const k = items.length;
  const vars = items.map((it) => variance(rows.map((r) => r[it])));
  const totalVars = variance(
    rows.map((r) => items.reduce((s, it) => s + r[it], 0)),
  );
  if (totalVars === 0) return 0;
  return (k / (k - 1)) * (1 - vars.reduce((a, b) => a + b, 0) / totalVars);
}

export function weekKey(d: Date) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7,
  );
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function round2(v: number) {
  return Math.round(v * 100) / 100;
}
