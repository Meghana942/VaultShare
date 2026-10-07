// Polynomial helpers for the Visualize tab (small real numbers, so the curves are easy to see).
// The real system does the same thing in Python, modulo a 2047-bit prime.

export function evalPoly(coeffs, x) {
  return coeffs.reduceRight((acc, c) => acc * x + c, 0)
}

// Lagrange interpolation: the unique lowest-degree curve through `points`, evaluated at x.
export function lagrangeAt(points, x) {
  let sum = 0
  points.forEach(([xi, yi], i) => {
    let term = yi
    points.forEach(([xj], j) => {
      if (j !== i) term *= (x - xj) / (xi - xj)
    })
    sum += term
  })
  return sum
}

const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1))

// f(x) = secret + a1*x + a2*x^2 with small coefficients that keep the plot readable.
export function randomCurve() {
  const secret = randInt(15, 55)
  let a2 = 0
  while (a2 === 0) a2 = randInt(-4, 4)
  return [secret, randInt(-10, 14), a2]
}

export function niceStep(range, target = 5) {
  const raw = range / target
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
}
