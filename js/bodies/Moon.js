import * as THREE from "three";
export class Moon {
  constructor(data, parent, index, assets) {
    this.data = data;
    this.parent = parent;
    this.phase = index * 1.8;
    this.distance = parent.radius * (2.7 + index * 0.8);
    this.radius = Math.max(
      0.09,
      (parent.radius * data.radiusKm) / parent.data.radiusKm,
    );
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius, 20, 12),
      new THREE.MeshPhysicalMaterial({
        map: assets.get("moon"),
        roughness: 1,
        bumpMap: assets.get("moon"),
        bumpScale: this.radius * 0.035,
      }),
    );
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    parent.root.add(this.mesh);
  }
  update(days, real) {
    const a = (days / this.data.period) * Math.PI * 2 + this.phase;
    const distance = real
      ? (this.data.distanceKm / 149597870.7) * 30
      : this.distance;
    this.mesh.position.set(
      Math.cos(a) * distance,
      Math.sin(a) * distance * 0.07,
      Math.sin(a) * distance,
    );
    this.mesh.rotation.y = -a;
    this.mesh.scale.setScalar(
      real ? ((this.data.radiusKm / 149597870.7) * 30) / this.radius : 1,
    );
  }
}
