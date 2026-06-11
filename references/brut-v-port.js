const CANVAS = 512;
const CELLS  = 16;
const N      = 12;
const R      = 56;
const M      = 16;

// Grid centers: 4x4, spacing 128, offset 64
const centers = [];
for (let row = 0; row < 4; row++)
  for (let col = 0; col < 4; col++)
    centers.push([64 + col * 128, 64 + row * 128]);

// ---- helpers ----

function dist2(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

// Fisher-Yates partial shuffle -> pick N indices from CELLS
function pickTour() {
  const pool = Array.from({length: CELLS}, (_, i) => i);
  for (let i = 0; i < N; i++) {
    const j = i + Math.floor(Math.random() * (CELLS - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, N);
}

// 2-opt improvement on cyclic tour
function twoOpt(tour) {
  const n = tour.length;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        // skip wrap-around edge that reverses the whole cycle
        if (i === 0 && j === n - 1) continue;
        const jp1 = (j + 1) % n;
        const [ax, ay] = centers[tour[i]];
        const [bx, by] = centers[tour[i + 1]];
        const [cx, cy] = centers[tour[j]];
        const [dx, dy] = centers[tour[jp1]];
        const cur = dist2(ax, ay, bx, by) + dist2(cx, cy, dx, dy);
        const nxt = dist2(ax, ay, cx, cy) + dist2(bx, by, dx, dy);
        if (nxt < cur - 1e-10) {
          // reverse tour[i+1..j]
          let lo = i + 1, hi = j;
          while (lo < hi) { [tour[lo], tour[hi]] = [tour[hi], tour[lo]]; lo++; hi--; }
          improved = true;
        }
      }
    }
  }
  return tour;
}

// Cross-product z-component sign per vertex (determines arc direction)
function computeSigns(tour) {
  const n = tour.length;
  const signs = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;
    const [px, py] = centers[tour[prev]];
    const [cx, cy] = centers[tour[i]];
    const [nx, ny] = centers[tour[next]];
    const cross = (cx - px) * (ny - cy) - (cy - py) * (nx - cx);
    signs[i] = cross > 0 ? 1 : -1;
  }
  return signs;
}

// Build polygon vertices for the Dubins-style rounded tour
function buildPoly(tour, signs) {
  const n = tour.length;
  const verts = [];

  const TAU = Math.PI * 2;

  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;

    const [cx, cy] = centers[tour[i]];
    const [px, py] = centers[tour[prev]];
    const [nx, ny] = centers[tour[next]];

    // ---- ENTRY tangent (prev -> curr) ----
    const prevSign = signs[prev];
    const currSign = signs[i];

    const signOffP = -currSign;
    const isInnerP = prevSign !== currSign ? 1 : 0;

    const dex = cx - px, dey = cy - py;
    const thetaPrevCurr = Math.atan2(dey, dex);

    let offsetP;
    if (isInnerP) {
      const d = Math.sqrt(dex * dex + dey * dey);
      const ratio = (2 * R) / d;
      const clamped = Math.max(-1, Math.min(1, ratio));
      offsetP = Math.asin(clamped) - Math.PI / 2;
    } else {
      offsetP = Math.PI / 2;
    }

    const phiP = thetaPrevCurr + signOffP * offsetP;
    const cosP = Math.cos(phiP), sinP = Math.sin(phiP);

    let entX, entY;
    if (isInnerP) {
      entX = cx - R * cosP;
      entY = cy - R * sinP;
    } else {
      entX = cx + R * cosP;
      entY = cy + R * sinP;
    }
    verts.push([Math.round(entX), Math.round(entY)]);

    // theta_entry from actual offset vector
    const thetaEntry = Math.atan2(entY - cy, entX - cx);

    // ---- EXIT tangent (curr -> next) ----
    const nextSign = signs[next];

    const signOffN = -nextSign;
    const isInnerN = currSign !== nextSign ? 1 : 0;

    const dxn = nx - cx, dyn = ny - cy;
    const thetaCurrNext = Math.atan2(dyn, dxn);

    let offsetN;
    if (isInnerN) {
      const d = Math.sqrt(dxn * dxn + dyn * dyn);
      const ratio = (2 * R) / d;
      const clamped = Math.max(-1, Math.min(1, ratio));
      offsetN = Math.asin(clamped) - Math.PI / 2;
    } else {
      offsetN = Math.PI / 2;
    }

    const phiN = thetaCurrNext + signOffN * offsetN;
    const cosN = Math.cos(phiN), sinN = Math.sin(phiN);

    const extX = cx + R * cosN;
    const extY = cy + R * sinN;

    const thetaExit = Math.atan2(sinN, cosN); // angle of offset direction

    // ---- Arc sweep ----
    let t0 = thetaEntry, t1 = thetaExit;

    if (currSign > 0) {
      if (t1 < t0) t1 += TAU;
    } else {
      if (t0 < t1) t0 += TAU;
    }

    for (let k = 1; k < M; k++) {
      const t = t0 + (t1 - t0) * (k / M);
      const ax = cx + R * Math.cos(t);
      const ay = cy + R * Math.sin(t);
      verts.push([Math.round(ax), Math.round(ay)]);
    }

    verts.push([Math.round(extX), Math.round(extY)]);
  }

  return verts;
}

new p5(p => {
  p.setup = () => {
    p.createCanvas(CANVAS, CANVAS);
    p.frameRate(1);
  };

  p.draw = () => {
    p.background(255);

    // 1-3: pick tour
    let tour = pickTour();

    // 4: 2-opt
    tour = twoOpt(tour);

    // 5: signs
    const signs = computeSigns(tour);

    // 6: build polygon
    const poly = buildPoly(tour, signs);

    // 7: draw all 16 circles (white fill, black stroke)
    p.stroke(0);
    p.strokeWeight(2);
    p.fill(255);
    for (const [x, y] of centers)
      p.circle(x, y, R * 2);

    // 8: stamp polygon
    p.fill(0);
    p.stroke(0);
    p.strokeWeight(2);
    p.beginShape();
    for (const [x, y] of poly)
      p.vertex(x, y);
    p.endShape(p.CLOSE);
  };
});