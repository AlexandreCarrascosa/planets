import * as THREE from "three";
import { seededRandom } from "../physics/PhysicalUnits.js";
import { sweptSphereContact } from "../physics/CollisionSystem.js";

// Massive weighted fragments, integrated with the same clock and attraction
// units as the laboratory. Visual lifetime never deletes their physical mass.
export class TidalDebris {
  constructor(scene) {
    this.scene = scene;
    this.streams = [];
    this.capacity = 2048;
    this.dummy = new THREE.Object3D();
    this.nextSeed = 1847;
    this.initialMass = 0;
    this.capturedMass = 0;
  }
  get count() { return this.streams.reduce((n, s) => n + s.particles.length, 0); }
  get remainingMass() {
    return this.streams.reduce((sum, stream) => sum + stream.particles.reduce((m,p) => m+p.mass, 0), 0);
  }
  add(body, source) {
    const count = Math.min(body.isSmall ? 24 : 128, this.capacity - this.count);
    if (count < 8) return false;
    body.root.updateMatrixWorld(true);
    const random = seededRandom(this.nextSeed++);
    const particles = [];
    const weights = Array.from({length: count}, () => 0.15 + random() ** 3 * 6);
    const weightSum = weights.reduce((a,b) => a+b, 0);
    for (let i = 0; i < count; i++) {
      const y = 1 - 2 * (i + 0.5) / count;
      const angle = i * Math.PI * (3 - Math.sqrt(5));
      const radius = Math.cbrt(0.1 + random() * 0.9) * body.data.visualRadius;
      const local = new THREE.Vector3(Math.sqrt(1-y*y)*Math.cos(angle), y, Math.sqrt(1-y*y)*Math.sin(angle)).multiplyScalar(radius);
      const position = body.surface.localToWorld(local);
      const fraction = weights[i] / weightSum;
      const aspect = 0.7 + random() * 0.65;
      particles.push({ position, velocity: body.velocity.clone(), mass: body.mass * fraction,
        radius: body.radius * Math.cbrt(fraction), aspect });
    }
    // Avoid imparting a position/momentum kick just because of finite sampling.
    const mean = particles.reduce((v,p) => v.addScaledVector(p.position, p.mass/body.mass), new THREE.Vector3());
    const correction = body.position.clone().sub(mean);
    for (const p of particles) p.position.add(correction);
    const gaseous = ["Estrela", "Gasoso", "Gelado"].includes(body.data.type);
    const material = new THREE.MeshStandardMaterial({
      color: gaseous ? "#e9c6a4" : body.data.type === "Cometa" ? "#a7bac5" : "#847367", roughness: 0.95,
      emissive: "#ad4118", emissiveIntensity: gaseous ? 0.5 : 0.025,
    });
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.scene.add(mesh);
    this.streams.push({ particles, mesh, radius: body.radius / Math.cbrt(count), source, age: 0 });
    this.initialMass += body.mass;
    this.render();
    return true;
  }
  acceleration(position, attractors, gravity) {
    const force = new THREE.Vector3();
    for (const source of attractors) {
      if (source.destroyed) continue;
      const delta = source.position.clone().sub(position);
      const r2 = delta.lengthSq() + 0.12 ** 2;
      force.addScaledVector(delta, gravity * source.mu / (r2 * Math.sqrt(r2)));
    }
    return force;
  }
  step(h, bodies, gravity, onCapture) {
    if (h <= 0) return;
    const attractors = bodies.filter(b => !b.destroyed && (b.isAttractor || b.id === "sun"));
    const holes = attractors.filter(b => b.isBlackHole);
    for (const stream of this.streams) {
      stream.age += h;
      let live = 0;
      for (const p of stream.particles) {
        const previous = p.position.clone();
        p.velocity.addScaledVector(this.acceleration(p.position, attractors, gravity), h/2);
        p.position.addScaledVector(p.velocity, h);
        p.velocity.addScaledVector(this.acceleration(p.position, attractors, gravity), h/2);
        // Swept capture prevents tunnelling on the last plunge. Only material
        // that actually crosses a horizon feeds its mass and linear momentum.
        let hit = null, first = Infinity;
        for (const hole of holes) {
          const t = sweptSphereContact(previous, p.position, hole.previous || hole.position, hole.position, hole.radius);
          if (t !== null && t < first) { first = t; hit = hole; }
        }
        if (hit) { this.capturedMass += p.mass; onCapture(hit, p); }
        else stream.particles[live++] = p;
      }
      stream.particles.length = live;
    }
  }
  render() {
    for (let i = this.streams.length - 1; i >= 0; i--) {
      const stream = this.streams[i];
      if (!stream.particles.length) {
        this.disposeStream(stream); this.streams.splice(i, 1); continue;
      }
      for (let j = 0; j < stream.particles.length; j++) {
        const p = stream.particles[j];
        this.dummy.position.copy(p.position);
        this.dummy.scale.set(p.radius * p.aspect, p.radius * 0.9, p.radius / (p.aspect * 0.9));
        this.dummy.rotation.set(j*0.7 + stream.age*0.1, j*1.9, stream.age*0.15);
        this.dummy.updateMatrix();
        stream.mesh.setMatrixAt(j, this.dummy.matrix);
      }
      stream.mesh.count = stream.particles.length;
      stream.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  disposeStream(stream) {
    stream.mesh.removeFromParent(); stream.mesh.geometry.dispose(); stream.mesh.material.dispose();
  }
  clear() {
    for (const stream of this.streams) this.disposeStream(stream);
    this.streams = []; this.nextSeed = 1847;
    this.initialMass = 0; this.capturedMass = 0;
  }
}
