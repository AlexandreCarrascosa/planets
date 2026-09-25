import * as THREE from "three";
export class CelestialBody {
  constructor(data) {
    this.data = data;
    this.id = data.id;
    this.radius = data.visualRadius;
    this.root = new THREE.Group();
    this.root.userData.body = this;
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
  createSurface(material) {
    this.tilt = new THREE.Group();
    this.tilt.rotation.z = (this.data.axialTilt * Math.PI) / 180;
    this.root.add(this.tilt);
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
    if (this.surface)
      this.surface.rotation.y =
        (this.surface.rotation.y +
          ((deltaDays * 24) / this.data.rotationPeriodHours) *
            Math.PI *
            2 *
            this.rotationMultiplier) %
        (Math.PI * 2);
  }
  addCrater(worldPoint) {
    if (!this.surface) return;
    const local = this.surface.worldToLocal(worldPoint.clone()).normalize();
    const geo = new THREE.CircleGeometry(this.radius * 0.13, 24);
    const mat = new THREE.MeshPhysicalMaterial({
      color: "#29201b",
      roughness: 1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const mark = new THREE.Mesh(geo, mat);
    mark.position.copy(local).multiplyScalar(this.radius * 1.003);
    mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), local);
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
