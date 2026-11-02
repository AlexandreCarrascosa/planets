import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { PhysicalOrbits, keplerState, MU_SUN, apsidalAdvance } from "../js/physics/PhysicalOrbits.js";
import { solarEvolution, adiabaticOrbit } from "../js/physics/StellarEvolution.js";
import { PLANETS } from "../js/data/planetData.js";
import { GravityEngine } from "../js/physics/GravityEngine.js";
import { orbitalPosition } from "../js/physics/OrbitalMechanics.js";
import { EjectaCloud } from "../js/effects/EjectaCloud.js";
import { CelestialBody } from "../js/bodies/CelestialBody.js";
import { classifyImpact } from "../js/physics/ImpactModel.js";

const point=(mass,x,vz)=>({mass,position:new THREE.Vector3(x,0,0),velocity:new THREE.Vector3(0,0,vz)});
test("physical AU/day model obeys inverse square and equal opposite force",()=>{
  const engine=new PhysicalOrbits([point(1,0,0),point(1e-3,1,0)]);
  const acceleration=engine.accelerations();
  assert.ok(Math.abs(acceleration[1].x+MU_SUN)<1e-16);
  assert.ok(acceleration[0].clone().addScaledVector(acceleration[1],1e-3).length()<1e-16);
  engine.states[1].position.x=2;
  assert.ok(Math.abs(acceleration[1].x/engine.accelerations()[1].x-4)<1e-12);
});
test("physical circular orbit retains energy and angular momentum for ten years",()=>{
  const engine=new PhysicalOrbits([point(1,0,0),point(0,1,Math.sqrt(MU_SUN))]);
  const first=engine.states[1].velocity.lengthSq()/2-MU_SUN;
  engine.step(3652.5);
  const p=engine.states[1],energy=p.velocity.lengthSq()/2-MU_SUN/p.position.length();
  assert.ok(Math.abs((energy-first)/first)<1e-8);
  assert.ok(Math.abs(p.position.length()-1)<2e-6);
  assert.ok(Math.abs(new THREE.Vector3().crossVectors(p.position,p.velocity).length()/Math.sqrt(MU_SUN)-1)<1e-10);
});
test("Kepler initial conditions satisfy vis-viva including eccentric and inclined planets",()=>{
  for(const data of PLANETS) {
    const p=keplerState(data),a=data.distanceFromSunKm/149597870.7;
    assert.ok(Math.abs(p.velocity.lengthSq()/(MU_SUN*(2/p.position.length()-1/a))-1)<1e-12);
  }
});
test("Mercury 1PN numerical excess apsidal motion agrees with weak-field prediction",()=>{
  const a=.387098,e=.20563,r=a*(1-e),v=Math.sqrt(MU_SUN*(1+e)/(a*(1-e)));
  const engine=new PhysicalOrbits([point(1,0,0),point(0,r,v)],true);
  const reference=new PhysicalOrbits([point(1,0,0),point(0,r,v)]);
  engine.maxStep=reference.maxStep=.02;
  const period=2*Math.PI*Math.sqrt(a**3/MU_SUN);
  engine.step(period*30);reference.step(period*30);
  const angle=simulation=>{
    const p=simulation.states[1],r=p.position,v=p.velocity;
    const eccentricity=r.clone().multiplyScalar(v.lengthSq()-MU_SUN/r.length()).addScaledVector(v,-r.dot(v)).divideScalar(MU_SUN);
    return Math.atan2(eccentricity.z,eccentricity.x);
  };
  const measured=angle(engine)-angle(reference),expected=apsidalAdvance(a,e)*30;
  assert.ok(Math.abs(measured/expected-1)<.03,`${measured} vs ${expected}`);
  const arcseconds=apsidalAdvance(a,e)*206264.806*36525/87.969;
  assert.ok(arcseconds>42.8&&arcseconds<43.2);
});
test("a black hole with unchanged central mass leaves distant Newtonian orbits unchanged",()=>{
  const first=new PhysicalOrbits([point(1,0,0),point(0,1,Math.sqrt(MU_SUN))]);
  const second=new PhysicalOrbits([point(1,0,0),point(0,1,Math.sqrt(MU_SUN))]);
  second.states[0].isBlackHole=true;first.step(365);second.step(365);
  assert.deepEqual(first.states[1].position,second.states[1].position);
});
test("binary stars both move about their common barycenter",()=>{
  const separation=8,speed=Math.sqrt(MU_SUN*1.65/separation);
  const a=point(1,-separation*.65/1.65,-speed*.65/1.65);
  const b=point(.65,separation/1.65,speed/1.65);
  const engine=new PhysicalOrbits([a,b]);engine.step(365*5);
  assert.ok(Math.abs(a.position.z)>.1&&Math.abs(b.position.z)>.1);
  assert.ok(a.position.clone().addScaledVector(b.position,.65).length()<1e-10);
  assert.ok(a.velocity.clone().addScaledVector(b.velocity,.65).length()<1e-12);
  assert.ok(Math.abs(a.position.distanceTo(b.position)-separation)<1e-6);
});
test("sandbox release retains eccentric radial motion instead of imposing circular velocity",()=>{
  const data=PLANETS[0],body={data,distance:data.visualDistance,orbitDirection:1,position:new THREE.Vector3(),velocity:new THREE.Vector3()};
  const position=orbitalPosition(data,0);body.position.set(position.x,position.y,position.z);
  new GravityEngine().release(body,{position:new THREE.Vector3(),mu:120});
  assert.ok(Math.abs(body.velocity.lengthSq()/(120*(2/body.position.length()-1/body.distance))-1)<1e-12);
  assert.ok(Math.abs(body.position.dot(body.velocity))>1e-4);
});
test("solar phases respect Stefan-Boltzmann, mass loss and a white-dwarf ending",()=>{
  for(let i=0;i<=100;i++) {
    const s=solarEvolution(i/100);
    assert.ok(s.mass>0&&s.mass<=1&&s.radius>0&&s.temperature>0);
    assert.ok(Math.abs(s.radius**2*(s.temperature/5772)**4/s.luminosity-1)<1e-12);
    assert.ok(Math.abs(adiabaticOrbit(1,s.mass)*s.mass-1)<1e-12);
  }
  assert.equal(solarEvolution(0).mass,1);
  assert.ok(solarEvolution(.5).radius>200);
  assert.match(solarEvolution(1).name,/Anã branca/);
});

function setupCloud() {
  const bodies=[6,1].map((mass,i)=>{
    const b=new CelestialBody({id:`source-${i}`,name:`Source ${i}`,visualRadius:1,massKg:mass,radiusKm:1000,axialTilt:0});
    b.mu=mass*.001;b.position.set(i*2-1,0,0);b.velocity.set(i?-3:.5,0,0);return b;
  });
  const app={bodies,scene:{scene:new THREE.Scene()},gravity:new GravityEngine(),destroy(body){body.destroyed=true;}};
  app.gravity.mutual=true;
  const cloud=new EjectaCloud(app),event=classifyImpact(...bodies,new THREE.Vector3(1,0,0));
  cloud.add(...bodies,event,new THREE.Vector3(1,0,0),new THREE.Vector3(-5/7,0,0));
  return {app,cloud,event};
}
test("granular release preserves source mass, center and momentum while releasing progressively",()=>{
  const {app,cloud,event}=setupCloud(),initial=new THREE.Vector3(-5/7,0,0);
  assert.equal(cloud.count,256);assert.ok(Math.abs(cloud.mass-7)<1e-12);
  const parts=cloud.streams[0].parts,positions=parts.map(p=>p.position.clone());
  cloud.step(0);assert.ok(parts.every((p,i)=>p.position.equals(positions[i])));
  cloud.step(.1);assert.ok(parts.some(p=>p.released>0)&&parts.some(p=>p.released===0));
  for(let i=0;i<49;i++)cloud.step(.01);
  const mean=parts.reduce((v,p)=>v.addScaledVector(p.position,p.mass/7),new THREE.Vector3());
  const velocity=parts.reduce((v,p)=>v.addScaledVector(p.velocity,p.mass/7),new THREE.Vector3());
  assert.ok(mean.distanceTo(initial.addScaledVector(event.centerVelocity,.59))<1e-9);
  assert.ok(velocity.distanceTo(event.centerVelocity)<1e-10);
  assert.ok(Math.abs(app.bodies.reduce((sum,b)=>sum+b.mass,0)-7)<1e-12);
  assert.ok(app.bodies.every(b=>!b.destroyed&&!b.root.visible));
  cloud.clear();app.bodies.forEach(b=>b.dispose());assert.equal(cloud.count,0);
});
test("granular horizon crossing transfers all captured mass rather than deleting it",()=>{
  const {app,cloud}=setupCloud();
  const hole={isBlackHole:true,isAttractor:true,position:new THREE.Vector3(),velocity:new THREE.Vector3(),mass:10,mu:0,radius:100,accretion:0,accrete(mass){this.mass+=mass;}};
  app.bodies.push(hole);cloud.step(.01);
  assert.equal(cloud.count,0);assert.ok(Math.abs(hole.mass-17)<1e-12);
  assert.ok(app.bodies.slice(0,2).every(b=>b.destroyed&&b.mass===0));
  cloud.clear();app.bodies.slice(0,2).forEach(b=>b.dispose());
});
test("granular detail reduction preserves mass, center and momentum instead of expiring material",()=>{
  const {app,cloud}=setupCloud(),before=cloud.streams[0].parts;
  const weighted=parts=>parts.reduce((v,p)=>v.addScaledVector(p.position,p.mass/7),new THREE.Vector3());
  const center=weighted(before),mass=cloud.mass;
  cloud.coarsen();assert.ok(cloud.count<before.length);
  assert.ok(Math.abs(cloud.mass/mass-1)<1e-12);
  assert.ok(weighted(cloud.streams[0].parts).distanceTo(center)<1e-12);
  cloud.clear();app.bodies.forEach(b=>b.dispose());
});
test("stellar capture transfers granular mass and proxies are protected from visual lifetime expiry",()=>{
  const {app,cloud}=setupCloud();
  assert.ok(app.bodies.every(b=>b.isImpactFragment));
  const star={data:{type:"Estrela"},position:new THREE.Vector3(),velocity:new THREE.Vector3(),mass:10,mu:0,radius:100,setMass(mass){this.mass=mass;}};
  app.bodies.push(star);cloud.step(.01);
  assert.equal(cloud.count,0);assert.ok(Math.abs(star.mass-17)<1e-12);
  cloud.clear();app.bodies.slice(0,2).forEach(b=>b.dispose());
});
