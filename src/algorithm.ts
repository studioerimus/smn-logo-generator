// Seeded LCG PRNG (Mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface GeneratorParams {
  seed: number
  gridSize: number    // 4, 5, or 6
  nodeCount: number   // 4..9
  contrast: number    // 0..1  controls base radius fraction of cell spacing
  sizeVariation: number // 0..1  controls per-cell radius variation
}

export interface GeneratorResult {
  polygon: [number, number][]
  circles: { x: number; y: number; r: number }[]
  canvasSize: number
}

const ARC_STEPS = 16

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  return Math.sqrt(dx * dx + dy * dy)
}

export function generate(params: GeneratorParams): GeneratorResult {
  const { seed, gridSize, nodeCount, contrast, sizeVariation } = params
  const rng = mulberry32(seed)

  const CANVAS = 512
  const cells = gridSize * gridSize
  const N = Math.min(nodeCount, cells)

  // Cell spacing
  const margin = CANVAS / (gridSize + 1)
  const spacing = (CANVAS - 2 * margin) / (gridSize - 1)

  // Generate grid centers
  const centersX: number[] = []
  const centersY: number[] = []
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      centersX.push(margin + col * spacing)
      centersY.push(margin + row * spacing)
    }
  }

  // Per-cell radii
  const baseR = spacing * (0.15 + contrast * 0.35) // 0.15..0.50 * spacing
  const radii: number[] = []
  for (let i = 0; i < cells; i++) {
    const variation = (rng() * 2 - 1) * sizeVariation * baseR * 0.6
    radii.push(Math.max(baseR * 0.3, baseR + variation))
  }

  // Fisher-Yates partial shuffle -> pick N cells
  const pool: number[] = Array.from({ length: cells }, (_, i) => i)
  for (let i = 0; i < N; i++) {
    const j = i + Math.floor(rng() * (cells - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const tour = pool.slice(0, N)

  // 2-opt improvement on closed tour
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < N - 1; i++) {
      for (let j = i + 2; j < N; j++) {
        if (i === 0 && j === N - 1) continue
        const jp1 = (j + 1) % N
        const A = tour[i], B = tour[i + 1], C = tour[j], D = tour[jp1]
        const current = dist(centersX[A], centersY[A], centersX[B], centersY[B])
                      + dist(centersX[C], centersY[C], centersX[D], centersY[D])
        const next    = dist(centersX[A], centersY[A], centersX[C], centersY[C])
                      + dist(centersX[B], centersY[B], centersX[D], centersY[D])
        if (next < current - 1e-10) {
          // reverse tour[i+1..j]
          let lo = i + 1, hi = j
          while (lo < hi) {
            ;[tour[lo], tour[hi]] = [tour[hi], tour[lo]]
            lo++; hi--
          }
          improved = true
        }
      }
    }
  }

  // Compute signs: +1 if cross(prev->curr, curr->next).z > 0 else -1
  const signs: number[] = new Array(N)
  for (let i = 0; i < N; i++) {
    const prev = (i - 1 + N) % N
    const next = (i + 1) % N
    const cx = centersX[tour[i]], cy = centersY[tour[i]]
    const px = centersX[tour[prev]], py = centersY[tour[prev]]
    const nx = centersX[tour[next]], ny = centersY[tour[next]]
    const cross = (cx - px) * (ny - cy) - (cy - py) * (nx - cx)
    signs[i] = cross > 0 ? 1 : -1
  }

  // Build polygon
  const polygon: [number, number][] = []

  for (let i = 0; i < N; i++) {
    const prev = (i - 1 + N) % N
    const next = (i + 1) % N

    const cx = centersX[tour[i]], cy = centersY[tour[i]]
    const px = centersX[tour[prev]], py = centersY[tour[prev]]
    const nx = centersX[tour[next]], ny = centersY[tour[next]]
    const R = radii[tour[i]]
    const Rprev = radii[tour[prev]]
    const Rnext = radii[tour[next]]

    // ---- ENTRY tangent (prev -> curr) ----
    const sign_off_p = -signs[i]
    const is_inner_p = signs[prev] !== signs[i]

    const edx = cx - px, edy = cy - py
    const baseAngle_p = Math.atan2(edy, edx)

    let offset_p: number
    if (is_inner_p) {
      const d = Math.sqrt(edx * edx + edy * edy)
      const sinVal = Math.min(1, (R + Rprev) / d)
      offset_p = Math.asin(sinVal) - Math.PI / 2
    } else {
      offset_p = Math.PI / 2
    }

    const phi_p = baseAngle_p + sign_off_p * offset_p
    const entryX = cx + (is_inner_p ? -1 : 1) * R * Math.cos(phi_p)
    const entryY = cy + (is_inner_p ? -1 : 1) * R * Math.sin(phi_p)
    const theta_entry = Math.atan2(entryY - cy, entryX - cx)

    polygon.push([entryX, entryY])

    // ---- EXIT tangent (curr -> next) ----
    const sign_off_n = -signs[next]
    const is_inner_n = signs[i] !== signs[next]

    const fdx = nx - cx, fdy = ny - cy
    const baseAngle_n = Math.atan2(fdy, fdx)

    let offset_n: number
    if (is_inner_n) {
      const d = Math.sqrt(fdx * fdx + fdy * fdy)
      const sinVal = Math.min(1, (R + Rnext) / d)
      offset_n = Math.asin(sinVal) - Math.PI / 2
    } else {
      offset_n = Math.PI / 2
    }

    const phi_n = baseAngle_n + sign_off_n * offset_n
    const exitX = cx + R * Math.cos(phi_n)
    const exitY = cy + R * Math.sin(phi_n)
    const theta_exit = Math.atan2(exitY - cy, exitX - cx)

    // ---- Arc sweep ----
    // Mirror the original: sign>0 → ensure t1>=t0; sign<=0 → ensure t0>=t1
    const TAU = 2 * Math.PI
    let t0 = theta_entry, t1 = theta_exit

    if (signs[i] > 0) {
      if (t1 < t0) t1 += TAU
    } else {
      if (t0 < t1) t0 += TAU
    }

    for (let k = 1; k < ARC_STEPS; k++) {
      const t = t0 + (t1 - t0) * (k / ARC_STEPS)
      polygon.push([cx + R * Math.cos(t), cy + R * Math.sin(t)])
    }

    polygon.push([exitX, exitY])
  }

  const circles = tour.map(idx => ({
    x: centersX[idx],
    y: centersY[idx],
    r: radii[idx],
  }))

  return { polygon, circles, canvasSize: CANVAS }
}

// Build SVG path string from polygon
export function polygonToSVGPath(polygon: [number, number][]): string {
  if (polygon.length === 0) return ''
  const parts = polygon.map(([x, y], i) =>
    `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
  )
  return parts.join(' ') + ' Z'
}
