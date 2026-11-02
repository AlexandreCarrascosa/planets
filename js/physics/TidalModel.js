import * as THREE from "three";
import { clamp } from "./PhysicalUnits.js";

// Newtonian tide in the existing laboratory units. Cohesion is a reduced
// material parameter, not a measured SI tensile strength in compressed space.
export function tidalLoad(body, source, gravity = 1) {
  const direction = source.position.clone().sub(body.position);
  const distance = Math.max(direction.length(), source.radius, 1e-5);
  direction.normalize();
  const cohesion = body.isSmall ? 0.8
    : body.data.type === "Estrela" ? 0.12
      : ["Gasoso", "Gelado"].includes(body.data.type) ? 0.3 : 1.5;
  const restoring = gravity * body.mu / body.radius ** 2 + cohesion;
  const gradient = 2 * gravity * source.mu / distance ** 3;
  return { source, direction, ratio: gradient * body.radius / restoring };
}

export class TidalState {
  constructor() {
    this.strain = 0;
    this.damage = 0;
    this.direction = new THREE.Vector3(0, 0, 1);
    this.source = null;
  }
  update(load, step) {
    if (step <= 0) return false;
    const ratio = load?.ratio || 0;
    const target = clamp(ratio * 0.22, 0, 0.65);
    this.strain += (target - this.strain) * -Math.expm1(-step / 0.12);
    if (load && ratio > 1e-6) {
      this.direction.copy(load.direction);
      this.source = load.source;
    }
    this.damage = Math.min(1, this.damage + Math.max(0, ratio - 1) * step / 0.25);
    return this.damage >= 1;
  }
}

// Symmetric radial stretch: A = t I + (l - t) n nᵀ. Unlike rotating the root,
// this preserves spin, axial tilt and the separate satellite coordinate frame.
// Eigenvalues are l, t, t; determinant = 1. No oblate/pancake axis is introduced.
export function tidalMatrix(direction, strain, target = new THREE.Matrix4()) {
  if (direction.lengthSq() < 1e-20) return target.identity();
  const n = direction.clone().normalize();
  const longitudinal = 1 + clamp(strain, 0, 0.65);
  const transverse = 1 / Math.sqrt(longitudinal);
  const d = longitudinal - transverse, { x, y, z } = n;
  return target.set(
    transverse + d*x*x, d*x*y, d*x*z, 0,
    d*y*x, transverse + d*y*y, d*y*z, 0,
    d*z*x, d*z*y, transverse + d*z*z, 0,
    0, 0, 0, 1,
  );
}
