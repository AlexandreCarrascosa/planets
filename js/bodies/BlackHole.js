import * as THREE from "three";
import { CelestialBody } from "./CelestialBody.js";
export class BlackHole extends CelestialBody {
  constructor(id) {
    super({
      id,
      name: "Buraco negro",
      type: "Singularidade",
      visualRadius: 1.5,
      radiusKm: 2953,
      massKg: 1.9885e32,
      rotationPeriodHours: 1,
      axialTilt: 15,
      temperature: 0,
      color: "#ecaa78",
      distanceFromSunKm: 0,
      orbitalPeriodDays: 0,
    });
    this.isAttractor = true;
    this.isBlackHole = true;
    this.mu = 2200;
    this.free = true;
    this.createSurface(new THREE.MeshBasicMaterial({ color: "#000000" }));
    const geometry = new THREE.RingGeometry(
      this.radius * 1.4,
      this.radius * 5,
      128,
      12,
    );
    this.disk = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: `varying vec2 vPos;void main(){vPos=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform float time;varying vec2 vPos;void main(){float r=length(vPos);float a=atan(vPos.y,vPos.x);float stripes=.65+.35*sin(r*20.+a*4.-time*2.);float falloff=pow(max(0.,1.-(r-2.1)/5.4),1.5);vec3 c=mix(vec3(1.,.16,.025),vec3(1.,.82,.48),falloff);gl_FragColor=vec4(c*stripes*2.6,falloff*.85);}`,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.disk.rotation.x = -Math.PI / 2 + 0.22;
    this.root.add(this.disk);
  }
  update(days, time) {
    this.disk.material.uniforms.time.value = time;
  }
}
