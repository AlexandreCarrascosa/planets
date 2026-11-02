import * as THREE from "three";
// Sandbox units deliberately compress astronomical distances. Kick-drift-kick integration.
export class GravityEngine {
  constructor() {
    this.global = 1;
    this.mutual = false;
    this.softening = 0.12;
    this.maxStep = 1 / 120;
  }
  acceleration(body, bodies) {
    const result = new THREE.Vector3();
    for (const other of bodies) {
      if (other === body || other.destroyed || !other.mu) continue;
      if (!this.mutual && other.id !== "sun" && !other.isAttractor) continue;
      const delta = other.position.clone().sub(body.position);
      const r2 = delta.lengthSq() + this.softening ** 2;
      result.addScaledVector(
        delta,
        (this.global * other.mu) / (r2 * Math.sqrt(r2)),
      );
    }
    return result;
  }
  step(bodies, dt, onStep) {
    if (dt <= 0) return;
    const steps = Math.max(1, Math.ceil(dt / this.maxStep));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      const active = bodies.filter(
        (b) => b.free && !b.destroyed && !b.dragging && !b.impactLocked,
      );
      const accelerations = active.map((b) => this.acceleration(b, bodies));
      for (let i = 0; i < active.length; i++) {
        const b = active[i];
        b.previous = b.position.clone();
        b.velocity.addScaledVector(accelerations[i], h / 2);
        b.position.addScaledVector(b.velocity, h);
      }
      const after = active.map((b) => this.acceleration(b, bodies));
      for (let i = 0; i < active.length; i++)
        active[i].velocity.addScaledVector(after[i], h / 2);
      onStep?.(h);
    }
  }
  release(body, sun) {
    if (body.free || body === sun) return;
    body.free = true;
    const radial = body.position.clone().sub(sun.position);
    body.velocity
      .crossVectors(new THREE.Vector3(0, 1, 0), radial)
      .normalize()
      .multiplyScalar(
        -Math.sqrt(sun.mu / Math.max(radial.length(), 1)) * body.orbitDirection,
      );
  }
}
