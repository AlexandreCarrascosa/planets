import * as THREE from "three";
import { G, SOLAR_MASS, AU_METERS, DAY, C } from "./PhysicalUnits.js";
import { solveKepler } from "./OrbitalMechanics.js";

export const MU_SUN = G * SOLAR_MASS * DAY ** 2 / AU_METERS ** 3;
export const C_AU_DAY = C * DAY / AU_METERS;

export function keplerState(data) {
  const a = data.distanceFromSunKm * 1000 / AU_METERS, e = data.eccentricity;
  const E = solveKepler(data.phase, e), n = Math.sqrt(MU_SUN / a ** 3);
  const inclination = data.inclination * Math.PI / 180;
  const z = a * Math.sqrt(1-e*e) * Math.sin(E);
  const vz = a * Math.sqrt(1-e*e) * Math.cos(E) * n / (1-e*Math.cos(E));
  return { position: new THREE.Vector3(a*(Math.cos(E)-e), z*Math.sin(inclination), z*Math.cos(inclination)),
    velocity: new THREE.Vector3(-a*Math.sin(E)*n/(1-e*Math.cos(E)), vz*Math.sin(inclination), vz*Math.cos(inclination)) };
}

// Test-particle Schwarzschild 1PN correction. Valid for a dominant central
// mass in weak fields, NOT a geodesic solver near a horizon or a Kerr model.
export function schwarzschildCorrection(r, v, mu) {
  const distance = r.length(), dot = r.dot(v);
  if (!distance) return new THREE.Vector3();
  return r.clone().multiplyScalar(4*mu/distance-v.lengthSq())
    .addScaledVector(v, 4*dot).multiplyScalar(mu/(C_AU_DAY**2*distance**3));
}

export function apsidalAdvance(a, e, mu = MU_SUN) {
  return 6*Math.PI*mu/(a*(1-e*e)*C_AU_DAY**2);
}

export class PhysicalOrbits {
  constructor(states, relativity = false) {
    this.states = states; this.relativity = relativity; this.maxStep = 0.1;
  }
  accelerations() {
    const acceleration = this.states.map(() => new THREE.Vector3());
    for (let i=0;i<this.states.length;i++) for(let j=i+1;j<this.states.length;j++) {
      const a=this.states[i],b=this.states[j], d=b.position.clone().sub(a.position);
      const r=Math.max(d.length(),1e-12), factor=MU_SUN/(r*r*r);
      acceleration[i].addScaledVector(d, factor*b.mass);
      acceleration[j].addScaledVector(d, -factor*a.mass);
    }
    if (this.relativity) {
      const sun=this.states[0];
      for(let i=1;i<this.states.length;i++) {
        const p=this.states[i], correction=schwarzschildCorrection(p.position.clone().sub(sun.position),p.velocity.clone().sub(sun.velocity),MU_SUN*sun.mass);
        acceleration[i].add(correction);
        acceleration[0].addScaledVector(correction,-p.mass/sun.mass);
      }
    }
    return acceleration;
  }
  step(days) {
    if (!(days>0)) return;
    const steps=Math.ceil(days/this.maxStep),h=days/steps;
    for(let s=0;s<steps;s++) {
      let acceleration=this.accelerations();
      this.states.forEach((p,i)=>{p.velocity.addScaledVector(acceleration[i],h/2);p.position.addScaledVector(p.velocity,h);});
      acceleration=this.accelerations();
      this.states.forEach((p,i)=>p.velocity.addScaledVector(acceleration[i],h/2));
    }
  }
  energy() {
    let value=this.states.reduce((sum,p)=>sum+.5*p.mass*p.velocity.lengthSq(),0);
    for(let i=0;i<this.states.length;i++) for(let j=i+1;j<this.states.length;j++)
      value-=MU_SUN*this.states[i].mass*this.states[j].mass/this.states[i].position.distanceTo(this.states[j].position);
    return value;
  }
}
