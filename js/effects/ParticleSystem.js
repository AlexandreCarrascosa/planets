import * as THREE from "three";
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.shocks = [];
    this.max = 1400;
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.065, 0),
      new THREE.MeshPhysicalMaterial({
        color: "#bc8a65",
        emissive: "#ff7432",
        emissiveIntensity: 0.45,
        roughness: 1,
      }),
      this.max,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
  }
  burst(point, color, size = 1) {
    const count = Math.min(220, Math.round(size * 65));
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.max) this.particles.shift();
      const velocity = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      )
        .normalize()
        .multiplyScalar((0.4 + Math.random() * 2) * Math.sqrt(size));
      this.particles.push({
        position: point.clone(),
        velocity,
        life: 3 + Math.random() * 3,
        maxLife: 6,
        scale: 0.4 + Math.random() * size * 0.8,
        color: new THREE.Color(color),
      });
    }
    const shock = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 32, 16),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.2,
        wireframe: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    shock.position.copy(point);
    this.scene.add(shock);
    this.shocks.push({ mesh: shock, age: 0, size });
  }
  update(dt, attractors = []) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      for (const b of attractors) {
        const d = b.position.clone().sub(p.position);
        p.velocity.addScaledVector(
          d,
          (dt * b.mu) / Math.pow(d.lengthSq() + 4, 1.5),
        );
      }
      p.position.addScaledVector(p.velocity, dt);
      this.dummy.position.copy(p.position);
      this.dummy.scale.setScalar(p.scale * Math.min(1, p.life));
      this.dummy.rotation.set(p.life, p.life * 2, p.life * 0.3);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, p.color);
    }
    this.mesh.count = this.particles.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.age += dt;
      s.mesh.scale.setScalar(1 + s.age * s.size * 4);
      s.mesh.material.opacity = Math.max(0, 0.25 - s.age * 0.12);
      if (s.age > 2.1) {
        s.mesh.removeFromParent();
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        this.shocks.splice(i, 1);
      }
    }
  }
  clear() {
    this.particles = [];
    this.mesh.count = 0;
    for (const s of this.shocks) {
      s.mesh.removeFromParent();
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
    }
    this.shocks = [];
  }
}
