// Mulberry32 seeded PRNG
function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gridParams(gridSize: 4 | 5 | 6) {
  const CANVAS  = 512
  const spacing = CANVAS / gridSize
  const offset  = spacing / 2
  const CELLS   = gridSize * gridSize
  const N       = Math.round(0.75 * CELLS)
  const R       = spacing * 0.44

  const centers: [number, number][] = []
  for (let row = 0; row < gridSize; row++)
    for (let col = 0; col < gridSize; col++)
      centers.push([offset + col * spacing, offset + row * spacing])

  return { CANVAS, CELLS, N, R, centers }
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay
  return Math.sqrt(dx * dx + dy * dy)
}

function pickTour(rng: () => number, cells: number, n: number): number[] {
  const pool = Array.from({ length: cells }, (_, i) => i)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (cells - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

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

// Each arc in the output: all parameters needed by Canvas2D arc() and SVG A command.
// ccw=true → Canvas2D counterclockwise=true; ccw=false → CW (counterclockwise=false).
export interface ArcSegment {
  cx: number; cy: number; r: number
  thetaEntry: number  // angle (radians) from center to entry point
  thetaExit:  number  // angle (radians) from center to exit point
  ccw: boolean        // arc direction in Canvas2D terms
  entX: number; entY: number  // entry tangent point (arc start)
  extX: number; extY: number  // exit tangent point (arc end)
}

function buildArcs(
  tour:    number[],
  signs:   number[],
  centers: [number, number][],
  R:       number
): ArcSegment[] {
  const n    = tour.length
  const arcs: ArcSegment[] = []

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

    const offsetP = isInnerP
      ? Math.asin(Math.max(-1, Math.min(1, (2 * R) / Math.sqrt(dex * dex + dey * dey)))) - Math.PI / 2
      : Math.PI / 2

    const phiP = thetaPC + signOffP * offsetP
    const cosP = Math.cos(phiP), sinP = Math.sin(phiP)

    const entX = isInnerP ? cx - R * cosP : cx + R * cosP
    const entY = isInnerP ? cy - R * sinP : cy + R * sinP
    const thetaEntry = Math.atan2(entY - cy, entX - cx)

    // ---- EXIT ----
    const signOffN = -signs[next]
    const isInnerN = signs[i] !== signs[next]

    const dxn = nx - cx, dyn = ny - cy
    const thetaCN = Math.atan2(dyn, dxn)

    const offsetN = isInnerN
      ? Math.asin(Math.max(-1, Math.min(1, (2 * R) / Math.sqrt(dxn * dxn + dyn * dyn)))) - Math.PI / 2
      : Math.PI / 2

    const phiN   = thetaCN + signOffN * offsetN
    const thetaExit = phiN  // atan2(sin(phiN), cos(phiN)) = phiN

    const extX = cx + R * Math.cos(phiN)
    const extY = cy + R * Math.sin(phiN)

    // ccw: Canvas2D counterclockwise flag
    // signs[i] > 0  → t1 adjusted >= t0 → increasing angle → CW on screen → ccw=false
    // signs[i] <= 0 → t0 adjusted >= t1 → decreasing angle → CCW on screen → ccw=true
    const ccw = signs[i] <= 0

    arcs.push({ cx, cy, r: R, thetaEntry, thetaExit, ccw, entX, entY, extX, extY })
  }

  return arcs
}

export interface GenerationResult {
  arcs:     ArcSegment[]
  circles:  [number, number][]
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
  const arcs  = buildArcs(tour, signs, centers, R)

  return { arcs, circles: centers, R, CANVAS, seed, gridSize }
}
