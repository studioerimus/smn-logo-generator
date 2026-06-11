// Mulberry32 seeded PRNG — drop-in replacement for Math.random()
function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Grid parameters — N = 75 % of cells, R = 44 % of cell spacing
export function gridParams(gridSize: 4 | 5 | 6) {
  const CANVAS = 512
  const spacing = CANVAS / gridSize
  const offset  = spacing / 2
  const CELLS   = gridSize * gridSize
  const N       = Math.round(0.75 * CELLS)
  const R       = spacing * 0.44

  const centers: [number, number][] = []
  for (let row = 0; row < gridSize; row++)
    for (let col = 0; col < gridSize; col++)
      centers.push([offset + col * spacing, offset + row * spacing])

  return { CANVAS, CELLS, N, R, spacing, centers }
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay
  return Math.sqrt(dx * dx + dy * dy)
}

// Fisher-Yates partial shuffle → pick N indices
function pickTour(rng: () => number, cells: number, n: number): number[] {
  const pool = Array.from({ length: cells }, (_, i) => i)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (cells - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

// 2-opt improvement on cyclic tour
function twoOpt(tour: number[], centers: [number, number][]): number[] {
  const n = tour.length
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue
        const jp1 = (j + 1) % n
        const [ax, ay] = centers[tour[i]]
        const [bx, by] = centers[tour[i + 1]]
        const [cx, cy] = centers[tour[j]]
        const [dx, dy] = centers[tour[jp1]]
        const cur = dist(ax, ay, bx, by) + dist(cx, cy, dx, dy)
        const nxt = dist(ax, ay, cx, cy) + dist(bx, by, dx, dy)
        if (nxt < cur - 1e-10) {
          let lo = i + 1, hi = j
          while (lo < hi) { ;[tour[lo], tour[hi]] = [tour[hi], tour[lo]]; lo++; hi-- }
          improved = true
        }
      }
    }
  }
  return tour
}

// Cross-product sign per vertex
function computeSigns(tour: number[], centers: [number, number][]): number[] {
  const n = tour.length
  return Array.from({ length: n }, (_, i) => {
    const prev = (i - 1 + n) % n
    const next = (i + 1) % n
    const [px, py] = centers[tour[prev]]
    const [cx, cy] = centers[tour[i]]
    const [nx, ny] = centers[tour[next]]
    const cross = (cx - px) * (ny - cy) - (cy - py) * (nx - cx)
    return cross > 0 ? 1 : -1
  })
}

// Build polygon vertices — direct port of brut-v-port.js
function buildPoly(
  tour: number[],
  signs: number[],
  centers: [number, number][],
  R: number
): [number, number][] {
  const TAU = Math.PI * 2
  const M   = 16
  const n   = tour.length
  const verts: [number, number][] = []

  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n
    const next = (i + 1) % n

    const [cx, cy] = centers[tour[i]]
    const [px, py] = centers[tour[prev]]
    const [nx, ny] = centers[tour[next]]

    // ---- ENTRY ----
    const signOffP = -signs[i]
    const isInnerP = signs[prev] !== signs[i]

    const dex = cx - px, dey = cy - py
    const thetaPC = Math.atan2(dey, dex)

    let offsetP: number
    if (isInnerP) {
      const d = Math.sqrt(dex * dex + dey * dey)
      const clamped = Math.max(-1, Math.min(1, (2 * R) / d))
      offsetP = Math.asin(clamped) - Math.PI / 2
    } else {
      offsetP = Math.PI / 2
    }

    const phiP = thetaPC + signOffP * offsetP
    const cosP = Math.cos(phiP), sinP = Math.sin(phiP)

    const entX = isInnerP ? cx - R * cosP : cx + R * cosP
    const entY = isInnerP ? cy - R * sinP : cy + R * sinP
    verts.push([Math.round(entX), Math.round(entY)])

    const thetaEntry = Math.atan2(entY - cy, entX - cx)

    // ---- EXIT ----
    const signOffN = -signs[next]
    const isInnerN = signs[i] !== signs[next]

    const dxn = nx - cx, dyn = ny - cy
    const thetaCN = Math.atan2(dyn, dxn)

    let offsetN: number
    if (isInnerN) {
      const d = Math.sqrt(dxn * dxn + dyn * dyn)
      const clamped = Math.max(-1, Math.min(1, (2 * R) / d))
      offsetN = Math.asin(clamped) - Math.PI / 2
    } else {
      offsetN = Math.PI / 2
    }

    const phiN = thetaCN + signOffN * offsetN
    const cosN = Math.cos(phiN), sinN = Math.sin(phiN)

    const extX = cx + R * cosN
    const extY = cy + R * sinN
    const thetaExit = Math.atan2(sinN, cosN) // = phiN

    // ---- Arc sweep ----
    let t0 = thetaEntry, t1 = thetaExit
    if (signs[i] > 0) {
      if (t1 < t0) t1 += TAU
    } else {
      if (t0 < t1) t0 += TAU
    }

    for (let k = 1; k < M; k++) {
      const t = t0 + (t1 - t0) * (k / M)
      verts.push([Math.round(cx + R * Math.cos(t)), Math.round(cy + R * Math.sin(t))])
    }

    verts.push([Math.round(extX), Math.round(extY)])
  }

  return verts
}

export interface GenerationResult {
  poly:     [number, number][]
  circles:  [number, number][]  // all grid centers
  R:        number
  CANVAS:   number
  seed:     number
  gridSize: 4 | 5 | 6
}

export function generate(seed: number, gridSize: 4 | 5 | 6): GenerationResult {
  const rng = mulberry32(seed)
  const { CANVAS, CELLS, N, R, centers } = gridParams(gridSize)

  let tour = pickTour(rng, CELLS, N)
  tour = twoOpt(tour, centers)
  const signs = computeSigns(tour, centers)
  const poly  = buildPoly(tour, signs, centers, R)

  return { poly, circles: centers, R, CANVAS, seed, gridSize }
}
