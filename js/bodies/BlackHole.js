import * as THREE from "three";
import { CelestialBody } from "./CelestialBody.js";
import { schwarzschildRadius } from "../physics/PhysicalUnits.js";
export class BlackHole extends CelestialBody {
  constructor(id) {
    super({
      id,
      name: "Buraco negro",
      type: "Singularidade",
      visualRadius: 1.5,
      radiusKm: schwarzschildRadius(1.9885e32) / 1000,
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
    this.accretion = 0;
    this.free = true;
    this.createSurface(new THREE.MeshBasicMaterial({ color: "#000000" }));
    const geometry = new THREE.RingGeometry(
      this.radius * 3,
      this.radius * 10,
      128,
      12,
    );
    this.disk = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, feed: { value: 0 }, horizon: { value: this.radius } },
        vertexShader: `varying vec2 vPos;void main(){vPos=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform float time,feed,horizon;varying vec2 vPos;void main(){float r=length(vPos)/horizon;float a=atan(vPos.y,vPos.x);float rotation=time*24./pow(max(r,3.),1.5);float stripes=.78+.22*sin(r*14.+a*5.-rotation);float falloff=(1.-smoothstep(8.,10.,r))*smoothstep(3.,3.3,r);float temperature=pow(3./max(r,3.),.75)*pow(max(.001,1.-sqrt(3./max(r,3.))),.25);float doppler=1.+.25*cos(a);vec3 c=mix(vec3(.7,.06,.01),vec3(1.,.8,.5),temperature*2.);gl_FragColor=vec4(c*stripes*doppler*2.2,falloff*min(1.,feed));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
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
    this.accretion *= Math.exp(-days / 40);
    this.disk.material.uniforms.feed.value = this.accretion;
    this.disk.visible = this.accretion > 0.001;
  }
  accrete(mass) {
    const ratio = (this.mass + mass) / this.mass;
    this.mass += mass; this.mu *= ratio; this.radius *= ratio;
    this.tilt.scale.multiplyScalar(ratio); this.disk.scale.multiplyScalar(ratio);
    this.data = { ...this.data, massKg: this.mass, radiusKm: schwarzschildRadius(this.mass) / 1000 };
  }
}
