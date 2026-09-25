import * as THREE from "three";
export class TrailRenderer {
  constructor(scene, color = "#95ddeb") {
    this.positions = new Float32Array(90 * 3);
    this.history = [];
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.line = new THREE.Line(
      this.geometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.line.frustumCulled = false;
    scene.add(this.line);
  }
  update(position) {
    this.history.unshift(position.clone());
    if (this.history.length > 90) this.history.pop();
    for (let i = 0; i < this.history.length; i++)
      this.history[i].toArray(this.positions, i * 3);
    this.geometry.setDrawRange(0, this.history.length);
    this.geometry.attributes.position.needsUpdate = true;
  }
  dispose() {
    this.line.removeFromParent();
    this.geometry.dispose();
    this.line.material.dispose();
  }
}
