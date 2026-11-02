export function sweptSphereContact(a0, a1, b0, b1, radius) {
  const start = a0.clone().sub(b0), delta = a1.clone().sub(b1).sub(start);
  const c = start.lengthSq() - radius ** 2, aa = delta.lengthSq();
  if (c <= 0) return 0;
  if (aa < 1e-20) return null;
  const bb = start.dot(delta), disc = bb * bb - aa * c;
  if (disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / aa;
  return t >= 0 && t <= 1 ? t : null;
}
export function sweptSphereHit(a0, a1, b0, b1, radius) {
  return sweptSphereContact(a0, a1, b0, b1, radius) !== null;
}
export class CollisionSystem {
  constructor(onCollision) {
    this.onCollision = onCollision;
  }
  check(bodies) {
    const hits = [];
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (a.destroyed || a.dragging || a.impactLocked) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (
          b.destroyed ||
          b.dragging ||
          b.impactLocked ||
          (!a.free && !b.free) ||
          (a.isDebris && b.isDebris)
        )
          continue;
        const r = a.isBlackHole ? a.radius : b.isBlackHole ? b.radius : a.radius + b.radius;
        const t = sweptSphereContact(
            a.previous || a.position,
            a.position,
            b.previous || b.position,
            b.position,
            r,
          );
        if (t !== null) hits.push({ a, b, t });
      }
    }
    hits.sort((a, b) => a.t - b.t);
    const handled = new Set();
    for (const { a, b, t } of hits) {
      if (a.destroyed || b.destroyed || a.impactLocked || b.impactLocked || handled.has(a) || handled.has(b)) continue;
      const pa = (a.previous || a.position).clone().lerp(a.position, t);
      const pb = (b.previous || b.position).clone().lerp(b.position, t);
      const normal = pb.clone().sub(pa).normalize();
      if (!normal.lengthSq()) normal.set(1, 0, 0);
      this.onCollision(a, b, { t, pa, pb, normal, point: pa.clone().addScaledVector(normal, a.radius) });
      handled.add(a); handled.add(b);
    }
  }
}
