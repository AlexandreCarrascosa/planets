import * as THREE from "three";
import { seededRandom } from "./PhysicalUnits.js";

const EPS = 1e-8;
const interpolate = (a, b, t) => ({
  p: a.p.clone().lerp(b.p, t),
  n: a.n.clone().lerp(b.n, t).normalize(),
  uv: a.uv.clone().lerp(b.uv, t),
});

// Closed convex cells retain the original outer triangles/UVs. Newly exposed
// cut faces have their own material; this is a geometric fracture, not SPH.
export function polyhedronProperties(faces) {
  let volume = 0;
  const center = new THREE.Vector3();
  for (const face of faces) {
    const a = face.vertices[0].p;
    for (let i = 1; i < face.vertices.length - 1; i++) {
      const b = face.vertices[i].p, c = face.vertices[i + 1].p;
      const tetra = a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
      volume += tetra;
      center.addScaledVector(a.clone().add(b).add(c), tetra / 4);
    }
  }
  return { volume, center: center.divideScalar(volume) };
}

function clip(faces, normal, distance) {
  const result = [], boundary = [];
  for (const face of faces) {
    const vertices = [];
    for (let i = 0; i < face.vertices.length; i++) {
      const a = face.vertices[i], b = face.vertices[(i + 1) % face.vertices.length];
      const da = a.p.dot(normal) - distance, db = b.p.dot(normal) - distance;
      if (da <= EPS) vertices.push(a);
      if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) {
        const v = interpolate(a, b, da / (da - db));
        vertices.push(v); boundary.push(v.p);
      } else if (Math.abs(da) <= EPS) boundary.push(a.p);
    }
    if (vertices.length >= 3) result.push({ vertices, interior: face.interior });
  }
  const unique = new Map();
  for (const p of boundary) unique.set(`${Math.round(p.x / EPS)},${Math.round(p.y / EPS)},${Math.round(p.z / EPS)}`, p);
  const points = [...unique.values()];
  if (points.length >= 3) {
    const center = points.reduce((v, p) => v.add(p), new THREE.Vector3()).divideScalar(points.length);
    const u = new THREE.Vector3().crossVectors(normal, Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const v = new THREE.Vector3().crossVectors(normal, u);
    points.sort((a, b) => Math.atan2(a.clone().sub(center).dot(v), a.clone().sub(center).dot(u))
      - Math.atan2(b.clone().sub(center).dot(v), b.clone().sub(center).dot(u)));
    result.push({ interior: true, vertices: points.map(p => ({ p, n: normal.clone(), uv: new THREE.Vector2(p.dot(u), p.dot(v)) })) });
  }
  return result;
}

function sourceFaces(body) {
  body.root.updateMatrixWorld(true);
  const mesh = body.surface.levels?.[0].object || body.surface;
  const geometry = mesh.geometry, pos = geometry.attributes.position;
  const uv = geometry.attributes.uv, norm = geometry.attributes.normal;
  const matrix = mesh.matrixWorld.clone();
  matrix.setPosition(new THREE.Vector3().setFromMatrixPosition(matrix).sub(body.position));
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const index = geometry.index, count = index ? index.count : pos.count;
  const faces = [];
  for (let i = 0; i < count; i += 3) {
    const vertices = [0, 1, 2].map(j => {
      const k = index ? index.getX(i + j) : i + j;
      return { p: new THREE.Vector3().fromBufferAttribute(pos, k).applyMatrix4(matrix),
        n: new THREE.Vector3().fromBufferAttribute(norm, k).applyNormalMatrix(normalMatrix),
        uv: uv ? new THREE.Vector2().fromBufferAttribute(uv, k) : new THREE.Vector2() };
    });
    if (new THREE.Vector3().crossVectors(vertices[1].p.clone().sub(vertices[0].p), vertices[2].p.clone().sub(vertices[0].p)).lengthSq() > EPS ** 2)
      faces.push({ vertices, interior: false });
  }
  return faces;
}

function cellGeometry(cell, center) {
  const positions = [], normals = [], uvs = [], geometry = new THREE.BufferGeometry();
  for (const interior of [false, true]) {
    const start = positions.length / 3;
    for (const face of cell.filter(f => f.interior === interior)) {
      for (let i = 1; i < face.vertices.length - 1; i++) {
        for (const vertex of [face.vertices[0], face.vertices[i], face.vertices[i + 1]]) {
          positions.push(vertex.p.x - center.x, vertex.p.y - center.y, vertex.p.z - center.z);
          normals.push(vertex.n.x, vertex.n.y, vertex.n.z); uvs.push(vertex.uv.x, vertex.uv.y);
        }
      }
    }
    geometry.addGroup(start, positions.length / 3 - start, interior ? 1 : 0);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  let radius = 0;
  for (let i = 0; i < positions.length; i += 3) radius = Math.max(radius, Math.hypot(...positions.slice(i, i + 3)));
  return { geometry, radius };
}

export function fractureBody(body, count = 16, seed = 1942, retainedFraction = null, axis = new THREE.Vector3(1, 0, 0)) {
  const random = seededRandom(seed), faces = sourceFaces(body);
  const original = polyhedronProperties(faces);
  const cells = [faces];
  let protectedCell = null;
  // A small spherical cap would become a wide, thin plate. Reserve a single
  // large remnant only when it occupies a substantial part of the source.
  if (retainedFraction >= 0.35 && retainedFraction < 0.98 && count > 1) {
    const normal = axis.clone().normalize();
    let low = -body.radius * 2, high = body.radius * 2;
    for (let i = 0; i < 30; i++) {
      const d = (low + high) / 2, volume = polyhedronProperties(clip(faces, normal, d)).volume;
      if (volume < original.volume * retainedFraction) low = d; else high = d;
    }
    const distance = (low + high) / 2;
    protectedCell = clip(faces, normal, distance);
    cells.splice(0, 1, protectedCell, clip(faces, normal.clone().negate(), -distance));
  }
  while (cells.length < count) {
    let largest = -1, maxVolume = 0;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === protectedCell) continue;
      const volume = polyhedronProperties(cells[i]).volume;
      if (volume > maxVolume) { largest = i; maxVolume = volume; }
    }
    const cell = cells[largest], { center } = polyhedronProperties(cell);
    // Split across the widest direction, rather than repeatedly cutting the
    // short dimension into wafer-like layers. Candidate directions are seeded.
    let normal, widest = -Infinity;
    for (let candidate = 0; candidate < 12; candidate++) {
      const direction = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
      let low = Infinity, high = -Infinity;
      for (const face of cell) for (const vertex of face.vertices) {
        const projection = vertex.p.dot(direction);
        low = Math.min(low, projection); high = Math.max(high, projection);
      }
      if (high - low > widest) { widest = high - low; normal = direction; }
    }
    const distance = center.dot(normal);
    cells.splice(largest, 1, clip(cell, normal, distance), clip(cell, normal.clone().negate(), -distance));
  }
  const parts = cells.map(cell => {
    const { volume, center } = polyhedronProperties(cell), fraction = volume / original.volume;
    return { ...cellGeometry(cell, center), fraction, mass: body.mass * fraction, mu: body.mu * fraction,
      physicalVolume: body.data.radiusKm ** 3 * fraction,
      visualVolume: (body.visualVolume || body.radius ** 3) * fraction,
      position: body.position.clone().add(center), sourceVelocity: body.velocity.clone(), source: body };
  }).sort((a, b) => b.mass - a.mass);
  return parts;
}
