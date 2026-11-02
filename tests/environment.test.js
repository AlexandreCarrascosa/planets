import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { WeatherModel } from "../js/physics/WeatherModel.js";
import { ThermalModel, solarFlux, equilibriumTemperature } from "../js/physics/ThermalModel.js";
import { classifyImpact, fragmentImpact, resolveGrazing } from "../js/physics/ImpactModel.js";
import { sweptSphereContact, CollisionSystem } from "../js/physics/CollisionSystem.js";
import { schwarzschildRadius, SOLAR_MASS } from "../js/physics/PhysicalUnits.js";
import { ENVIRONMENTS } from "../js/data/environmentData.js";
import { ParticleSystem } from "../js/effects/ParticleSystem.js";
import { BlackHole } from "../js/bodies/BlackHole.js";

const body = (mass, velocity, mu = mass) => ({mass, mu, radius: 1, velocity: new THREE.Vector3(...velocity)});
test("impacts distinguish merging, grazing, local cratering and disruption", () => {
  const a = body(1, [0,0,0]), n = new THREE.Vector3(1,0,0);
  assert.equal(classifyImpact(a, body(1, [-0.1,0,0]), n).regime, "merge");
  assert.equal(classifyImpact(a, body(1, [-1,5,0]), n).regime, "grazing");
  assert.equal(classifyImpact(a, body(1, [-5,0,0]), n).regime, "disruption");
  assert.equal(classifyImpact(a, body(1e-5, [-5,0,0]), n).regime, "crater");
});
test("fragmentation preserves mass and momentum with bounded ejecta energy", () => {
  const a = body(6e24, [1,2,3], 0.01), b = body(6e23, [-7,0,2], 0.001);
  const event = classifyImpact(a,b,new THREE.Vector3(1,0,0));
  const pieces = fragmentImpact(event, 14, 42);
  assert.ok(Math.abs(pieces.reduce((s,p)=>s+p.mass,0) / event.mass - 1) < 1e-14);
  const momentum = pieces.reduce((v,p)=>v.addScaledVector(p.velocity,p.mass/event.mass),new THREE.Vector3());
  assert.ok(momentum.distanceTo(event.centerVelocity) < 1e-12);
  const energy = pieces.reduce((s,p)=>s+0.5*p.mass*p.velocity.clone().sub(event.centerVelocity).lengthSq(),0);
  assert.ok(Math.abs(energy/event.relativeEnergy - 0.3) < 1e-12);
  assert.deepEqual(pieces, fragmentImpact(event,14,42));
});
test("grazing impulse preserves linear momentum and dissipates normal energy", () => {
  const a=body(2,[1,2,0]),b=body(1,[-3,0,0]);
  const before=a.velocity.clone().multiplyScalar(2).add(b.velocity);
  const e0=a.velocity.lengthSq()+0.5*b.velocity.lengthSq();
  resolveGrazing(a,b,new THREE.Vector3(1,0,0));
  assert.ok(a.velocity.clone().multiplyScalar(2).add(b.velocity).distanceTo(before)<1e-12);
  assert.ok(a.velocity.lengthSq()+0.5*b.velocity.lengthSq()<e0);
});
test("continuous collision returns first contact, and resolves earliest event first", () => {
  const origin=new THREE.Vector3();
  assert.equal(sweptSphereContact(new THREE.Vector3(-10,0,0),new THREE.Vector3(10,0,0),origin,origin,1),0.45);
  const projectile={position:new THREE.Vector3(10,0,0),previous:new THREE.Vector3(-10,0,0),radius:.1,free:true};
  const near={position:new THREE.Vector3(-3,0,0),radius:1},far={position:new THREE.Vector3(3,0,0),radius:1};
  let victim;
  new CollisionSystem((a,b)=>{victim=b;a.destroyed=true;}).check([projectile,far,near]);
  assert.equal(victim,near);
});
test("radiative flux follows inverse square and equilibrium temperature fourth root", () => {
  assert.equal(solarFlux(1)/solarFlux(2),4);
  assert.ok(Math.abs(equilibriumTemperature(1)/equilibriumTemperature(2)-Math.sqrt(2))<1e-14);
  assert.ok(equilibriumTemperature(1)>250 && equilibriumTemperature(1)<260);
});
test("thermal response is timestep independent at fixed flux and reaches freezing/heating", () => {
  const a=new ThermalModel(ENVIRONMENTS.earth,1), b=new ThermalModel(ENVIRONMENTS.earth,1);
  a.update(100,1,0.1);
  for(let i=0;i<100;i++) b.update(1,1,0.1);
  assert.ok(Math.abs(a.temperature-b.temperature)<1e-10);
  assert.ok(a.ice>.8);
  b.update(1000,1,8);assert.ok(b.temperature>373);
});
test("weather conserves condensable mass during advection, evaporation and rain", () => {
  const a=new WeatherModel(ENVIRONMENTS.earth,42,48,24);
  const initial=a.totalWater(), cloud0=a.cloud.slice();
  for(let i=0;i<300;i++) a.update(.2,288);
  assert.ok(Math.abs(a.totalWater()/initial-1)<1e-12);
  assert.notDeepEqual(a.cloud,cloud0);
  for(const field of [a.vapor,a.cloud,a.surfaceWater]) assert.ok(field.every(v=>v>=0 && Number.isFinite(v)));
  assert.equal(a.update(0,288),false);
});
test("weather replay is reproducible across compatible step sizes and large jumps are explicit", () => {
  const a=new WeatherModel(ENVIRONMENTS.earth,42,24,12), b=new WeatherModel(ENVIRONMENTS.earth,42,24,12);
  for(let i=0;i<40;i++){a.update(.25,288);b.update(.125,288);b.update(.125,288);}
  assert.deepEqual(a.cloud,b.cloud);
  const mass=a.totalWater(); a.update(1e7,288);
  assert.equal(a.skippedDays,1e7-2);
  assert.ok(Math.abs(a.totalWater()/mass-1)<1e-12);
});
test("particle pool compacts every live transform after middle entries expire", () => {
  const scene=new THREE.Scene(), p=new ParticleSystem(scene);
  p.burst(new THREE.Vector3(),"#aabbcc",.1);
  p.particles[1].life=0;p.particles[3].life=0;
  const expected=p.particles.length-2;p.update(.01);
  assert.equal(p.mesh.count,expected);
  for(let i=0;i<expected;i++){
    const m=new THREE.Matrix4();p.mesh.getMatrixAt(i,m);
    const v=new THREE.Vector3().setFromMatrixPosition(m);
    assert.ok(v.distanceTo(p.particles[i].position)<1e-6);
  }
  assert.equal(p.shocks.length,0);p.clear();assert.equal(p.mesh.count,0);
});
test("black hole mass, gravity and physical horizon grow consistently after capture", () => {
  assert.ok(Math.abs(schwarzschildRadius(SOLAR_MASS)/1000-2.953)<.01);
  const h=new BlackHole("test"),mass=h.mass,mu=h.mu,r=h.radius;
  h.accrete(mass*.1);
  assert.ok(Math.abs(h.mu/mu-1.1)<1e-12);
  assert.ok(Math.abs(h.radius/r-1.1)<1e-12);
  assert.equal(h.data.radiusKm,schwarzschildRadius(h.mass)/1000);
  h.dispose();
});
