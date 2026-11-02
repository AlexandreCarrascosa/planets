import * as THREE from "three";
import { CelestialBody } from "./CelestialBody.js";
export class Meteor extends CelestialBody {
  constructor(id, comet = false, debris = false) {
    super({
      id,
      name: debris ? "Fragmento" : comet ? "Cometa" : "Meteoro",
      type: comet ? "Cometa" : "Asteroide",
      visualRadius: debris ? 0.12 : comet ? 0.35 : 0.25,
      radiusKm: comet ? 5 : 1,
      massKg: (4 / 3) * Math.PI * (comet ? 5000 : 1000) ** 3 * (comet ? 600 : 3000),
      rotationPeriodHours: 8,
      axialTilt: 30,
      temperature: -120,
      color: comet ? "#a3d8e3" : "#c98d68",
      texture: "moon",
      distanceFromSunKm: 0,
      orbitalPeriodDays: 0,
    });
    this.free = true;
    this.isDebris = debris;
    this.isSmall = true;
    this.age = 0;
    this.createSurface(
      new THREE.MeshPhysicalMaterial({
        color: this.data.color,
        roughness: 0.95,
        emissive: comet ? "#195c6f" : "#7b290a",
        emissiveIntensity: 0.6,
        flatShading: true,
      }),
    );
    for (const level of this.surface.levels) {
      level.object.geometry.dispose();
      level.object.geometry = new THREE.IcosahedronGeometry(this.radius, 1);
    }
    if (comet) {
      this.glow = new THREE.Mesh(
        new THREE.SphereGeometry(this.radius * 1.8, 16, 12),
        new THREE.MeshBasicMaterial({
          color: "#89d5f0",
          transparent: true,
          opacity: 0.1,
          depthWrite: false,
        }),
      );
      this.root.add(this.glow);
    }
  }
  update(days) {
    this.rotate(days);
    this.age += Math.abs(days);
  }
  dispose() {
    this.trail?.dispose();
    super.dispose();
  }
}
