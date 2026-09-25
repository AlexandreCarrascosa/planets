import * as THREE from "three";
export function sweptSphereHit(a0, a1, b0, b1, radius) {
  const start = new THREE.Vector3().subVectors(a0, b0),
    end = new THREE.Vector3().subVectors(a1, b1),
    delta = end.clone().sub(start);
  const t = delta.lengthSq()
    ? THREE.MathUtils.clamp(-start.dot(delta) / delta.lengthSq(), 0, 1)
    : 0;
  return start.addScaledVector(delta, t).lengthSq() <= radius * radius;
}
export class CollisionSystem {
  constructor(onCollision) {
    this.onCollision = onCollision;
  }
  check(bodies) {
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (a.destroyed || a.dragging) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (
          b.destroyed ||
          b.dragging ||
          (!a.free && !b.free) ||
          (a.isDebris && b.isDebris)
        )
          continue;
        const r = a.radius + b.radius;
        if (
          a.position.distanceToSquared(b.position) < r * r ||
          sweptSphereHit(
            a.previous || a.position,
            a.position,
            b.previous || b.position,
            b.position,
            r,
          )
        ) {
          this.onCollision(a, b);
          if (a.destroyed) break;
        }
      }
    }
  }
}
