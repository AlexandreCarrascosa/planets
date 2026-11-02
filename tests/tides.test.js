import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { tidalLoad, TidalState, tidalMatrix } from "../js/physics/TidalModel.js";
import { CelestialBody } from "../js/bodies/CelestialBody.js";
import { TidalDebris } from "../js/effects/TidalDebris.js";

function planet() {
  const body = new CelestialBody({ id: "target", type: "Rochoso", massKg: 6e24,
    visualRadius: 1.65, radiusKm: 6371, axialTilt: 23.44, rotationPeriodHours: 24, color: "#777777" });
  body.createSurface(new THREE.MeshStandardMaterial());
  return body;
}
const hole = () => ({ position: new THREE.Vector3(33,0,0), radius: 1.5, mu: 12000, isAttractor: true, isBlackHole: true });

test("tidal load follows the inverse cube, vanishes at zero gravity and accounts for resistance", () => {
  const b=planet(), h=hole(), near=tidalLoad(b,h).ratio;
  h.position.multiplyScalar(2);
  assert.ok(Math.abs(near/tidalLoad(b,h).ratio-8)<1e-12);
  assert.equal(tidalLoad(b,h,0).ratio,0);
  const loose=tidalLoad(b,h).ratio; b.mu*=1e7;
  assert.ok(tidalLoad(b,h).ratio<loose); b.dispose();
});
test("tidal transform stretches radially, compresses both transverse axes equally and preserves volume", () => {
  assert.ok(tidalMatrix(new THREE.Vector3(),.65).equals(new THREE.Matrix4()));
  const n=new THREE.Vector3(1,2,3).normalize(), u=new THREE.Vector3().crossVectors(n,new THREE.Vector3(0,1,0)).normalize();
  const v=new THREE.Vector3().crossVectors(n,u);
  for(const s of [0,.1,.4,.65,100]) {
    const matrix=tidalMatrix(n,s), radial=1+Math.min(s,.65), transverse=1/Math.sqrt(radial);
    assert.ok(Math.abs(matrix.determinant()-1)<1e-12);
    assert.ok(n.clone().applyMatrix4(matrix).distanceTo(n.clone().multiplyScalar(radial))<1e-12);
    assert.ok(Math.abs(u.clone().applyMatrix4(matrix).length()-transverse)<1e-12);
    assert.ok(Math.abs(v.clone().applyMatrix4(matrix).length()-transverse)<1e-12);
    assert.ok(radial/transverse<2.13);
  }
});
test("tidal response is smooth, timestep independent under constant load, and pause freezes damage", () => {
  const a=new TidalState(), b=new TidalState(), load={ratio:1.2,direction:new THREE.Vector3(1,0,0),source:hole()};
  for(let i=0;i<100;i++)a.update(load,.001);
  for(let i=0;i<10;i++)b.update(load,.01);
  assert.ok(Math.abs(a.strain-b.strain)<1e-12);
  assert.ok(Math.abs(a.damage-b.damage)<1e-12);
  const strain=a.strain,damage=a.damage; a.update({...load,ratio:1000},0);
  assert.equal(a.strain,strain);assert.equal(a.damage,damage);
  assert.equal(a.update({...load,ratio:5},1),true);
  assert.ok(a.strain<=.65);
});
test("deformation preserves the planet spin and does not scale or rotate satellite positions", () => {
  const b=planet(), moon=new THREE.Object3D();
  b.root.position.set(12,4,5);moon.position.set(6,0,0);b.root.add(moon);
  b.surface.rotation.y=1.1;
  const before=moon.getWorldPosition(new THREE.Vector3()), spin=b.surface.quaternion.clone();
  b.tidal.direction.set(1,1,0).normalize();b.tidal.strain=.6;b.updateTidalShape();b.root.updateMatrixWorld(true);
  assert.ok(moon.getWorldPosition(new THREE.Vector3()).distanceTo(before)<1e-12);
  assert.deepEqual(b.surface.quaternion.toArray(),spin.toArray());
  assert.deepEqual(b.root.scale,new THREE.Vector3(1,1,1));b.dispose();
});
test("tidal breakup preserves mass, center of mass and initial linear momentum without an explosion kick", () => {
  const scene=new THREE.Scene(), debris=new TidalDebris(scene), b=planet(), h=hole();
  b.position.set(10,4,2);b.velocity.set(1,2,3);b.tidal.strain=.4;b.updateTidalShape();
  assert.equal(debris.add(b,h),true);
  const stream=debris.streams[0];
  const mass=stream.particles.reduce((sum,p)=>sum+p.mass,0);
  const center=stream.particles.reduce((v,p)=>v.addScaledVector(p.position,p.mass/b.mass),new THREE.Vector3());
  const velocity=stream.particles.reduce((v,p)=>v.addScaledVector(p.velocity,p.mass/b.mass),new THREE.Vector3());
  assert.ok(Math.abs(mass/b.mass-1)<1e-12);
  assert.ok(Math.abs(stream.particles.reduce((sum,p)=>sum+p.radius**3,0)/b.radius**3-1)<1e-12);
  assert.ok(center.distanceTo(b.position)<1e-12);assert.ok(velocity.distanceTo(b.velocity)<1e-12);
  assert.equal(stream.mesh.count,stream.particles.length);debris.clear();b.dispose();
});
test("only fragments crossing the horizon are captured; fast sweeps and paused frames are handled", () => {
  const scene=new THREE.Scene(), debris=new TidalDebris(scene), b=planet(), h=hole();
  h.position.set(0,0,0);h.previous=h.position.clone();b.position.set(20,0,0);
  debris.add(b,h);const particles=debris.streams[0].particles, total=particles.length;
  const fast=particles[1];fast.position.set(-5,0,0);fast.velocity.set(100,0,0);
  let captured=0;
  debris.step(0,[h],0,()=>captured++);assert.equal(captured,0);
  debris.step(.1,[h],0,()=>captured++);
  assert.equal(captured,1);assert.equal(debris.count,total-1);
  assert.ok(Math.abs((debris.remainingMass+debris.capturedMass)/debris.initialMass-1)<1e-12);
  debris.render();assert.equal(debris.streams[0].mesh.count,total-1);
  for(const p of debris.streams[0].particles)assert.ok(Number.isFinite(p.position.length()));
  debris.clear();assert.equal(scene.children.length,0);b.dispose();
});
test("fragment capacity refuses breakup cleanly without losing the original body", () => {
  const scene=new THREE.Scene(), debris=new TidalDebris(scene), b=planet();debris.capacity=3;
  assert.equal(debris.add(b,hole()),false);assert.equal(debris.count,0);assert.equal(b.destroyed,false);
  assert.equal(scene.children.length,0);b.dispose();
});
