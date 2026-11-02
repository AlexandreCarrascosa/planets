import * as THREE from "three";
import { TidalState, tidalMatrix } from "../physics/TidalModel.js";
export class CelestialBody {
  constructor(data) {
    this.data = data;
    this.id = data.id;
    this.radius = data.visualRadius;
    this.root = new THREE.Group();
    this.root.userData.body = this;
    this.tidal = new TidalState();
    this.tidalGroup = new THREE.Group();
    this.tidalGroup.matrixAutoUpdate = false;
    this.root.add(this.tidalGroup);
    this.impactGroup = new THREE.Group();
    this.impactGroup.matrixAutoUpdate = false;
    this.tidalGroup.add(this.impactGroup);
    this.position = this.root.position;
    this.velocity = new THREE.Vector3();
    this.free = false;
    this.destroyed = false;
    this.rotationMultiplier = 1;
    this.orbitDirection = 1;
    this.orbitDays = 0;
    this.mass = data.massKg;
    this.mu = 120 * (data.massKg / 1.9885e30);
    this.craters = [];
  }
  setMass(mass) {
    const ratio = mass / this.mass, scale = Math.cbrt(ratio);
    this.mu *= ratio;
    this.mass = mass;
    this.radius *= scale;
    this.tilt?.scale.multiplyScalar(scale);
    this.data = { ...this.data, massKg: mass, radiusKm: this.data.radiusKm * scale };
  }
  updateTidalShape() {
    tidalMatrix(this.tidal.direction, this.tidal.strain, this.tidalGroup.matrix);
    this.tidalGroup.matrixWorldNeedsUpdate = true;
  }
  updateImpactShape(axis, compression = 0) {
    const along = 1 - Math.min(0.12, Math.max(0, compression));
    const across = 1 / Math.sqrt(along), d = along - across;
    const { x, y, z } = axis;
    this.impactGroup.matrix.set(
      across + d*x*x, d*x*y, d*x*z, 0,
      d*y*x, across + d*y*y, d*y*z, 0,
      d*z*x, d*z*y, across + d*z*z, 0,
      0, 0, 0, 1,
    );
    this.impactGroup.matrixWorldNeedsUpdate = true;
  }
  createSurface(material) {
    this.tilt = new THREE.Group();
    this.tilt.rotation.z = (this.data.axialTilt * Math.PI) / 180;
    this.impactGroup.add(this.tilt);
    this.surface = new THREE.LOD();
    for (const [segments, distance] of [
      [64, 0],
      [32, this.radius * 25],
      [16, this.radius * 70],
    ]) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(
          this.radius,
          segments,
          Math.max(12, segments / 2),
        ),
        material,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.userData.body = this;
      this.surface.addLevel(mesh, distance);
    }
    this.tilt.add(this.surface);
    this.material = material;
  }
  rotate(deltaDays) {
    if (this.impactLocked) return;
    if (this.fragmentSpin && this.surface) {
      const speed = this.fragmentSpin.length();
      if (speed) this.surface.rotateOnWorldAxis(this.fragmentSpin.clone().divideScalar(speed), speed * deltaDays * 0.1);
      return;
    }
    if (this.surface)
      this.surface.rotation.y =
        (this.surface.rotation.y +
          ((deltaDays * 24) / this.data.rotationPeriodHours) *
            Math.PI *
            2 *
            this.rotationMultiplier) %
        (Math.PI * 2);
  }
  replaceWithFragment(part, materials, name) {
    this.environment?.dispose(); this.environment = null;
    const geometries = new Set(), oldMaterials = new Set();
    this.root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) oldMaterials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of oldMaterials) material.dispose();
    for (const child of [...this.root.children]) if (child !== this.tidalGroup) this.root.remove(child);
    this.tidalGroup.clear(); this.tidalGroup.matrix.identity();
    this.impactGroup.clear(); this.impactGroup.matrix.identity();
    this.tidalGroup.add(this.impactGroup);
    this.tilt = new THREE.Group(); this.impactGroup.add(this.tilt);
    this.surface = new THREE.Mesh(part.geometry, materials);
    this.surface.castShadow = true; this.surface.userData.body = this;
    this.tilt.add(this.surface); this.material = materials;
    this.clouds = this.atmosphere = this.rings = null;
    this.moons = []; this.craters = []; this.tidal.strain = 0;
    this.mass = part.mass; this.mu = part.mu; this.radius = part.radius;
    this.visualVolume = part.visualVolume;
    this.position.copy(part.position); this.velocity.copy(part.velocity);
    this.data = { ...this.data, name, type: "Remanescente", massKg: part.mass, radiusKm: Math.cbrt(part.physicalVolume), hasRings: false,
      description: "Remanescente de uma colisão. A crosta acompanha o fragmento; o raio informado corresponde ao volume equivalente de sua forma irregular." };
    this.fragmentSpin = part.spin;
    this.fragmentHeat = materials[1];
    this.isImpactFragment = true;
    this.free = true; this.isDebris = true; this.impactLocked = false;
    this.root.visible = true;
    if (this.label) this.label.textContent = name;
  }
  addCrater(worldPoint, angularSize = 0.08) {
    if (!this.surface) return;
    if (["Gasoso", "Gelado"].includes(this.data.type) || this.id === "venus") return;
    this.root.updateMatrixWorld(true);
    const local = this.surface.worldToLocal(worldPoint.clone()).normalize();
    const geo = new THREE.SphereGeometry(this.data.visualRadius * 1.002, 32, 12, 0, Math.PI * 2, 0, angularSize);
    const mat = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 craterUv;void main(){craterUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 craterUv;void main(){float r=1.-craterUv.y;float rim=exp(-pow((r-.82)*13.,2.));float a=1.-smoothstep(.78,1.,r);gl_FragColor=vec4(mix(vec3(.055,.036,.025),vec3(.28,.18,.1),rim),a*.92);}`,
      transparent: true, depthWrite: false,
    });
    const mark = new THREE.Mesh(geo, mat);
    mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), local);
    this.surface.add(mark);
    this.craters.push(mark);
    if (this.craters.length > 24) {
      const old = this.craters.shift();
      old.removeFromParent();
      old.geometry.dispose();
      old.material.dispose();
    }
  }
  dispose() {
    this.root.traverse((obj) => {
      obj.geometry?.dispose();
      if (obj.material) {
        for (const mat of Array.isArray(obj.material)
          ? obj.material
          : [obj.material])
          mat.dispose();
      }
    });
    this.root.removeFromParent();
    this.label?.remove();
  }
}
