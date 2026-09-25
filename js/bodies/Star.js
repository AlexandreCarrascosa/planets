import * as THREE from "three";
import { CelestialBody } from "./CelestialBody.js";
import { coronaTexture, atmosphereMaterial } from "../effects/ShaderLibrary.js";
export class Star extends CelestialBody {
  constructor(data, assets) {
    super(data);
    this.createSurface(
      new THREE.MeshPhysicalMaterial({
        map: assets.get("sun"),
        emissiveMap: assets.get("sun"),
        emissive: "#ffb34c",
        emissiveIntensity: 2.1,
        color: "#ffc46b",
        roughness: 1,
      }),
    );
    this.light = new THREE.PointLight(0xfff3dc, 3.6, 0, 0);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
    this.light.shadow.camera.near = this.radius * 1.1;
    this.light.shadow.camera.far = 350;
    this.light.shadow.bias = -0.001;
    this.light.shadow.normalBias = 0.04;
    this.root.add(this.light);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: coronaTexture(),
        color: "#ffb66b",
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.scale.setScalar(this.radius * 7);
    this.glow = glow;
    this.root.add(glow);
    this.corona = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius * 1.04, 48, 32),
      atmosphereMaterial("#ffb657", 0.8),
    );
    this.root.add(this.corona);
    // A star does not cast a shadow on itself from its central light.
    this.surface.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
  }
  update(deltaDays, time) {
    this.rotate(deltaDays);
    this.glow.material.opacity = 0.82 + Math.sin(time * 0.7) * 0.07;
    this.corona.scale.setScalar(1 + Math.sin(time) * 0.009);
  }
}
