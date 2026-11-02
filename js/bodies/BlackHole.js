import * as THREE from "three";
import { CelestialBody } from "./CelestialBody.js";
import { schwarzschildRadius, SOLAR_MASS } from "../physics/PhysicalUnits.js";
import { labHoleRadius } from "../data/blackHoleProfiles.js";
export class BlackHole extends CelestialBody {
  constructor(id, options = {}) {
    const solarMasses=options.solarMasses??100;
    if(!Number.isFinite(solarMasses)||solarMasses<3||solarMasses>1e11)throw new RangeError("Massa do buraco negro fora da faixa suportada");
    const radius=options.visualRadius??labHoleRadius(solarMasses);
    super({
      id,
      name: options.name ? `Buraco negro ${options.name.toLowerCase()}` : "Buraco negro",
      type: "Singularidade",
      visualRadius: radius,
      radiusKm: schwarzschildRadius(solarMasses*SOLAR_MASS) / 1000,
      massKg: solarMasses*SOLAR_MASS,
      rotationPeriodHours: 1,
      axialTilt: 15,
      temperature: 0,
      color: "#ecaa78",
      distanceFromSunKm: 0,
      orbitalPeriodDays: 0,
    });
    this.isAttractor = true;
    this.initialMass=this.mass;this.initialRadius=this.radius;this.linearHorizon=!!options.linearHorizon;
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
    const totalRatio=(this.mass+mass)/this.initialMass;
    const nextRadius=this.initialRadius*(this.linearHorizon||totalRatio<=2?totalRatio:2+Math.log(totalRatio/2));
    const drawingRatio=nextRadius/this.radius;
    this.mass += mass; this.mu *= ratio; this.radius=nextRadius;
    this.tilt.scale.multiplyScalar(drawingRatio); this.disk.scale.multiplyScalar(drawingRatio);
    this.data = { ...this.data, massKg: this.mass, radiusKm: schwarzschildRadius(this.mass) / 1000 };
  }
}
