import * as THREE from "three";
import { seededRandom } from "../physics/PhysicalUnits.js";
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.shocks = [];
    this.max = 1400;
    this.random = seededRandom(1942);
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.065, 12, 8),
      new THREE.MeshPhysicalMaterial({
        color: "#bc8a65",
        emissive: "#ff7432",
        emissiveIntensity: 0.08,
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
  burst(point, color, size = 1, options = {}) {
    const random = this.random;
    const count = Math.min(220, Math.round(size * 65));
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.max) this.particles.shift();
      const velocity = new THREE.Vector3(
        random() - 0.5,
        random() - 0.5,
        random() - 0.5,
      )
        .normalize()
        .multiplyScalar((0.4 + random() * 2) * Math.sqrt(size));
      if (options.normal && velocity.dot(options.normal) < 0) velocity.reflect(options.normal);
      const dust = i % 3 === 0;
      this.particles.push({
        position: point.clone(),
        velocity: velocity.add(options.velocity || new THREE.Vector3()),
        life: dust ? 7 + random() * 4 : 2 + random() * 4,
        maxLife: dust ? 11 : 6,
        scale: 0.4 + random() * size * 0.8,
        color: new THREE.Color(options.ice ? "#c0ddeb" : dust ? color : "#ffad55"),
        dust, ice: options.ice, drag: options.atmosphere, atmosphereBody: options.atmosphereBody,
      });
    }
    if (!options.atmosphere) return;
    const shock = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * Math.sqrt(size), 32, 16),
      new THREE.ShaderMaterial({
        uniforms: { tint: { value: new THREE.Color(color) }, opacity: { value: 0.2 } },
        vertexShader: `varying vec3 shockNormal,shockView;void main(){vec4 p=modelViewMatrix*vec4(position,1.);shockNormal=normalize(normalMatrix*normal);shockView=-p.xyz;gl_Position=projectionMatrix*p;}`,
        fragmentShader: `uniform vec3 tint;uniform float opacity;varying vec3 shockNormal,shockView;
          void main(){float rim=pow(1.-abs(dot(normalize(shockNormal),normalize(shockView))),3.);
          gl_FragColor=vec4(tint,rim*opacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    shock.position.copy(point);
    this.scene.add(shock);
    this.shocks.push({ mesh: shock, age: 0, size });
  }
  update(dt, attractors = []) {
    let live = 0;
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) {
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
      if (p.dust && p.drag && p.atmosphereBody?.environment && p.atmosphereBody.root.visible) {
        const altitude=p.position.distanceTo(p.atmosphereBody.position)/p.atmosphereBody.radius-1;
        if(altitude<.02)p.velocity.multiplyScalar(Math.exp(-dt*.1*Math.exp(-Math.max(0,altitude)/.003)));
      }
      this.dummy.position.copy(p.position);
      this.dummy.scale.setScalar(p.scale * Math.min(1, p.life / 1.5) * (p.dust ? 1 + (p.maxLife - p.life) * 0.12 : 1));
      this.dummy.rotation.set(p.life, p.life * 2, p.life * 0.3);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(live, this.dummy.matrix);
      const cooling = p.dust || p.ice ? 1 : 0.22 + 0.78 * Math.min(1, p.life / p.maxLife);
      this.mesh.setColorAt(live, p.color.clone().multiplyScalar(cooling));
      this.particles[live++] = p;
    }
    this.particles.length = live;
    this.mesh.count = live;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.age += dt;
      s.mesh.scale.setScalar(1 + s.age * s.size * 4);
      s.mesh.material.uniforms.opacity.value = Math.max(0, 0.25 - s.age * 0.12);
      if (s.age > 2.1) {
        s.mesh.removeFromParent();
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        this.shocks.splice(i, 1);
      }
    }
  }
  clear() {
    this.random = seededRandom(1942);
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
