import * as THREE from "three";
export class AsteroidBelt {
  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.075, 0),
      new THREE.MeshPhysicalMaterial({ color: "#8f8274", roughness: 1 }),
      3200,
    );
    const dummy = new THREE.Object3D();
    let seed = 93;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 3200; i++) {
      const a = rand() * Math.PI * 2,
        r = 43 + rand() * 5;
      dummy.position.set(Math.cos(a) * r, (rand() - 0.5) * 2, Math.sin(a) * r);
      dummy.rotation.set(rand() * 6, rand() * 6, rand() * 6);
      dummy.scale.setScalar(0.4 + rand() * 1.6);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.count = 1600;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  update(days) {
    this.mesh.rotation.y = -days * 0.0003;
  }
}
