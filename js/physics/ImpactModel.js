import * as THREE from "three";
import { G, clamp, seededRandom } from "./PhysicalUnits.js";

// Reduced gravity-dominated sandbox model, not calibrated scaling laws or SPH.
export function classifyImpact(a, b, normal, gravityScale = 1) {
  const mass = a.mass + b.mass;
  const reduced = a.mass * (b.mass / mass);
  const relative = a.velocity.clone().sub(b.velocity);
  const speed = relative.length();
  const grazing = speed ? Math.sqrt(Math.max(0, 1 - (relative.dot(normal) / speed) ** 2)) : 0;
  const escape = Math.sqrt(2 * gravityScale * (a.mu + b.mu) / (a.radius + b.radius));
  const specificEnergy = 0.5 * (reduced / mass) * speed ** 2;
  const binding = Math.max(0.3 * gravityScale * (a.mu + b.mu) / (a.radius + b.radius), 1e-9);
  const ratio = specificEnergy / binding;
  const massRatio = Math.min(a.mass, b.mass) / Math.max(a.mass, b.mass);
  const smaller = a.mass <= b.mass ? a : b;
  const regime = massRatio < 0.001 && !smaller.data?.orbitalPeriodDays ? "crater"
    : grazing > 0.72 && speed > escape * 0.8 ? "grazing"
      : ratio < 0.5 ? "merge" : "disruption";
  return { regime, mass, speed, escape, grazing, specificEnergy, energyRatio: ratio,
    relativeEnergy: 0.5 * reduced * speed ** 2,
    largestFraction: regime === "merge" ? 1 : clamp(1 - 0.5 * ratio, 0.08, 0.95),
    centerVelocity: a.velocity.clone().multiplyScalar(a.mass / mass)
      .addScaledVector(b.velocity, b.mass / mass) };
}

// Weighted fragments include unresolved ejecta. Zero-mean velocity offsets
// preserve momentum, and their kinetic energy is bounded by the impact budget.
export function fragmentImpact(event, count = 12, seed = 1942) {
  if (count <= 1) return [{ mass: event.mass, velocity: event.centerVelocity.clone() }];
  const random = seededRandom(seed);
  const weights = [event.largestFraction];
  let rest = 0;
  for (let i = 1; i < count; i++) { weights.push(0.1 + random() ** 2); rest += weights[i]; }
  for (let i = 1; i < count; i++) weights[i] *= (1 - weights[0]) / rest;
  const offsets = weights.map(() => new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5));
  const mean = new THREE.Vector3();
  offsets.forEach((v, i) => mean.addScaledVector(v, weights[i]));
  offsets.forEach(v => v.sub(mean));
  const rawEnergy = offsets.reduce((sum, v, i) => sum + 0.5 * weights[i] * event.mass * v.lengthSq(), 0);
  const factor = Math.sqrt(event.relativeEnergy * 0.3 / Math.max(rawEnergy, 1e-100));
  return weights.map((w, i) => ({ mass: w * event.mass,
    velocity: offsets[i].multiplyScalar(factor).add(event.centerVelocity) }));
}

// Resolved solid cells inherit an impact-directed flow. Recenter and normalize
// once so unequal pieces conserve linear momentum within the kinetic budget.
export function fractureVelocities(parts, event, normal, center) {
  const offsets = parts.map(part => {
    const radial = part.position.clone().sub(center);
    const axial = normal.clone().multiplyScalar(radial.dot(normal));
    const lateral = radial.clone().sub(axial);
    const scale = Math.max(radial.length(), 0.1);
    return part.sourceVelocity.clone().sub(event.centerVelocity).multiplyScalar(0.55)
      .addScaledVector(axial, event.speed * 0.35 / scale)
      .addScaledVector(lateral, event.speed * 0.2 / scale);
  });
  const mean = offsets.reduce((v, p, i) => v.addScaledVector(p, parts[i].mass / event.mass), new THREE.Vector3());
  offsets.forEach(p => p.sub(mean));
  const energy = offsets.reduce((sum, v, i) => sum + 0.5 * parts[i].mass * v.lengthSq(), 0);
  const factor = Math.sqrt(0.3 * event.relativeEnergy / Math.max(energy, 1e-100));
  return offsets.map(v => v.multiplyScalar(factor).add(event.centerVelocity));
}

// Uniform-density spheres, SI masses/radii, no latent heat or equation of state.
// The sandbox velocity is mapped by v / escape; this is a thermal estimate only.
export function estimateMergerHeat(a, b, event) {
  const ra = a.data.radiusKm * 1000, rb = b.data.radiusKm * 1000;
  const massKg = a.mass + b.mass, radius = Math.cbrt(ra ** 3 + rb ** 3);
  if (!(ra > 0 && rb > 0 && event.escape > 0)) return { energyJ: 0, massKg, radiusKm: radius / 1000 };
  const binding = 0.6 * G * (massKg ** 2 / radius - a.mass ** 2 / ra - b.mass ** 2 / rb);
  const mutual = G * a.mass * b.mass / (ra + rb);
  const physicalSpeed = event.speed / event.escape * Math.sqrt(2 * G * massKg / (ra + rb));
  const kinetic = 0.5 * (a.mass * b.mass / massKg) * physicalSpeed ** 2;
  return { energyJ: Math.max(0, binding - mutual + kinetic), massKg, radiusKm: radius / 1000 };
}

export function resolveGrazing(a, b, normal, restitution = 0.35) {
  const relative = b.velocity.clone().sub(a.velocity).dot(normal);
  if (relative >= 0) return;
  const impulse = -(1 + restitution) * relative / (1 / a.mass + 1 / b.mass);
  a.velocity.addScaledVector(normal, -impulse / a.mass);
  b.velocity.addScaledVector(normal, impulse / b.mass);
}
