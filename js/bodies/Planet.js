import * as THREE from "three";
import { CelestialBody } from "./CelestialBody.js";
import { Moon } from "./Moon.js";
import { atmosphereMaterial, ringTexture } from "../effects/ShaderLibrary.js";
import { orbitalPosition } from "../physics/OrbitalMechanics.js";
import { AU } from "../data/planetData.js";
export class Planet extends CelestialBody {
  constructor(data, assets) {
    super(data);
    this.distance = data.visualDistance;
    this.realScale = false;
    const material = new THREE.MeshPhysicalMaterial({
      map: assets.get(data.texture),
      color: assets.get(data.texture) ? "#ffffff" : data.color,
      roughness: data.id === "earth" ? 0.75 : 1,
      metalness: 0,
      bumpMap: ["mercury", "mars"].includes(data.id)
        ? assets.get(data.texture)
        : null,
      bumpScale: this.radius * 0.018,
    });
    this.createSurface(material);
    if (data.id === "jupiter" || data.id === "saturn")
      this.surface.scale.y = 0.94;
    if (data.atmosphereColor) {
      this.atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(this.radius * 1.03, 48, 32),
        atmosphereMaterial(
          data.atmosphereColor,
          data.id === "earth" ? 0.62 : 0.3,
        ),
      );
      this.tilt.add(this.atmosphere);
    }
    if (data.id === "earth") {
      material.emissiveMap = assets.get("earth_nightmap");
      material.emissive = new THREE.Color("#ffce89");
      material.emissiveIntensity = 1.2;
      this.sunDirection = { value: new THREE.Vector3(1, 0, 0) };
      material.onBeforeCompile = (shader) => {
        shader.uniforms.sunDirection = this.sunDirection;
        shader.fragmentShader =
          "uniform vec3 sunDirection;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n totalEmissiveRadiance *= (1.0 - smoothstep(-0.15, 0.2, dot(normal, sunDirection)));",
        );
      };
      this.clouds = new THREE.Mesh(
        new THREE.SphereGeometry(this.radius * 1.012, 64, 32),
        new THREE.MeshPhysicalMaterial({
          map: assets.get("earth_clouds"),
          alphaMap: assets.get("earth_clouds"),
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
          roughness: 1,
        }),
      );
      this.tilt.add(this.clouds);
    }
    if (data.hasRings) {
      const geo = new THREE.RingGeometry(
        this.radius * 1.35,
        this.radius * 2.35,
        160,
      );
      const pos = geo.attributes.position,
        uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++)
        uv.setXY(
          i,
          Math.hypot(pos.getX(i), pos.getY(i)) / this.radius - 1.35,
          0.5,
        );
      this.rings = new THREE.Mesh(
        geo,
        new THREE.MeshPhysicalMaterial({
          map: ringTexture(),
          emissive: "#b69b75",
          emissiveIntensity: 0.22,
          side: THREE.DoubleSide,
          transparent: true,
          roughness: 1,
          depthWrite: false,
          alphaTest: 0.02,
        }),
      );
      this.rings.rotation.x = -Math.PI / 2;
      this.rings.receiveShadow = true;
      this.rings.castShadow = true;
      this.tilt.add(this.rings);
    }
    this.moons = data.moons.map(
      (moon, index) => new Moon(moon, this, index, assets),
    );
    this.createOrbit();
    this.setOrbitPosition();
  }
  createOrbit() {
    const pts = [];
    for (let i = 0; i <= 256; i++) {
      const p = orbitalPosition(
        { ...this.data, phase: 0 },
        (i / 256) * this.data.orbitalPeriodDays,
        this.distance,
      );
      pts.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    this.orbit = new THREE.LineLoop(
      geo,
      new THREE.LineBasicMaterial({
        color: "#586575",
        transparent: true,
        opacity: 0.18,
      }),
    );
  }
  setOrbitPosition() {
    const p = orbitalPosition(this.data, this.orbitDays, this.distance);
    this.position.set(p.x, p.y, p.z);
  }
  setScale(real) {
    this.realScale = real;
    this.distance = real
      ? (this.data.distanceFromSunKm / AU) * 30
      : this.data.visualDistance;
    const radius = real
      ? (this.data.radiusKm / AU) * 30
      : this.data.visualRadius;
    this.radius = radius;
    this.tilt.scale.setScalar(radius / this.data.visualRadius);
    this.orbit.geometry.dispose();
    const pts = [];
    for (let i = 0; i <= 256; i++) {
      const p = orbitalPosition(
        { ...this.data, phase: 0 },
        (i / 256) * this.data.orbitalPeriodDays,
        this.distance,
      );
      pts.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    this.orbit.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    if (!this.free) this.setOrbitPosition();
  }
  update(deltaDays, camera) {
    if (!this.free && !this.dragging) {
      this.orbitDays += deltaDays * this.orbitDirection;
      this.setOrbitPosition();
    }
    this.rotate(deltaDays);
    if (this.clouds)
      this.clouds.rotation.y =
        (this.clouds.rotation.y + deltaDays * 0.1) % (Math.PI * 2);
    if (this.sunDirection) {
      this.sunDirection.value
        .copy(this.position)
        .negate()
        .transformDirection(camera.matrixWorldInverse);
    }
    for (const moon of this.moons) moon.update(this.orbitDays, this.realScale);
    this.orbit.visible = !this.free && !this.destroyed;
  }
  dispose() {
    super.dispose();
    this.orbit.geometry.dispose();
    this.orbit.material.dispose();
    this.orbit.removeFromParent();
  }
}
