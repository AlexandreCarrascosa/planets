import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CelestialBody } from "../js/bodies/CelestialBody.js";
import { PlanetImpacts } from "../js/effects/PlanetImpacts.js";
import { fractureBody } from "../js/physics/FractureGeometry.js";
import { classifyImpact, estimateMergerHeat } from "../js/physics/ImpactModel.js";
import { GravityEngine } from "../js/physics/GravityEngine.js";
import { CollisionSystem } from "../js/physics/CollisionSystem.js";
import { SimulationClock } from "../js/core/Clock.js";
import { ThermalModel } from "../js/physics/ThermalModel.js";
import { ENVIRONMENTS } from "../js/data/environmentData.js";
import { PLANETS } from "../js/data/planetData.js";

function body(id, mass, radius = 1) {
  const result = new CelestialBody({ id, name: id, massKg: mass, visualRadius: radius,
    radiusKm: radius * 1000, axialTilt: 0, rotationPeriodHours: 24 });
  result.createSurface(new THREE.MeshStandardMaterial({ color: "#887766" }));
  result.free = true; result.mu = mass * 0.01;
  return result;
}

function setup(regime, radius = 1) {
  const a = body("a", 6, radius), b = body("b", 1, radius);
  a.position.set(-radius, 0, 0); b.position.set(radius, 0, 0);
  a.velocity.set(0.1, 0.2, 0); b.velocity.set(regime === "merge" ? -0.01 : -7, 0.2, 0);
  const gravity = new GravityEngine(); gravity.global = 0;
  const app = { bodies: [a, b], gravity, scene: { scene: new THREE.Scene() },
    camera: { tracking: a, lastTarget: new THREE.Vector3() }, particles: { burst() {} }, log: { add() {} },
    spawn(type, position, velocity) {
      const part = body("fragment", 0.1, 0.1); part.position.copy(position); part.velocity.copy(velocity);
      this.bodies.push(part); this.scene.scene.add(part.root); return part;
    }, destroy(b) { b.destroyed = true; b.root.visible = false; }, select(b) { this.selected = b; },
  };
  app.scene.scene.add(a.root, b.root);
  const event = { ...classifyImpact(a, b, new THREE.Vector3(1, 0, 0)), regime };
  const impacts = new PlanetImpacts(app); app.planetImpacts = impacts;
  impacts.begin(a, b, event, { normal: new THREE.Vector3(1, 0, 0), point: new THREE.Vector3() });
  return { a, b, app, impacts, event };
}

const live = app => app.bodies.filter(b => !b.destroyed);
const center = app => live(app).reduce((v, b) => v.addScaledVector(b.position, b.mass / 7), new THREE.Vector3());
const momentum = app => live(app).reduce((v, b) => v.addScaledVector(b.velocity, b.mass / 7), new THREE.Vector3());

test("closed fracture cells cover both source volume and original surface without gaps or new mass", () => {
  const b = body("source", 6);
  b.position.set(145, 20, 0); b.tilt.rotation.z = 0.4;
  b.updateImpactShape(new THREE.Vector3(1, 0, 0), 0.1);
  const parts = fractureBody(b, 24, 123, 0.12);
  assert.ok(Math.abs(parts.reduce((sum, p) => sum + p.fraction, 0) - 1) < 1e-10);
  assert.ok(Math.abs(parts.reduce((sum, p) => sum + p.mass, 0) - b.mass) < 1e-10);
  const mean = parts.reduce((v, p) => v.addScaledVector(p.position, p.mass / b.mass), new THREE.Vector3());
  assert.ok(mean.distanceTo(b.position) < 1e-10);
  for (const p of parts) {
    assert.ok(p.mass > 0 && Number.isFinite(p.radius));
    assert.ok(p.radius / Math.cbrt(p.visualVolume) < 2.5, "Solid fragments should not become broad, thin plates");
    assert.ok(p.geometry.groups[0].count >= 0);
    assert.ok(p.geometry.groups[1].count > 0);
    assert.ok([...p.geometry.attributes.position.array].every(Number.isFinite));
    p.geometry.dispose();
  }
  b.dispose();
});

test("first contact keeps both solid bodies and locks duplicate collision handling", () => {
  const { a, b, app, impacts } = setup("disruption");
  assert.equal(impacts.begin(a, b, {}, {}), false);
  impacts.step(0.1);
  assert.equal(a.destroyed, false); assert.equal(b.destroyed, false);
  assert.equal(a.root.visible, true); assert.equal(b.root.visible, true);
  assert.equal(app.bodies.length, 2);
  assert.ok(Math.abs(a.impactGroup.matrix.determinant() - 1) < 1e-12);
  let hits = 0;
  new CollisionSystem(() => hits++).check(app.bodies);
  assert.equal(hits, 0);
  const positions = [a.position.clone(), b.position.clone()];
  impacts.step(0);
  app.gravity.step(app.bodies, 0.1);
  assert.ok(a.position.equals(positions[0]) && b.position.equals(positions[1]));
  impacts.clear(); app.bodies.forEach(b => b.dispose());
});

test("rupture replaces both surfaces at their own positions with massful textured solid cells", () => {
  const { a, b, app, impacts, event } = setup("disruption");
  const velocity = event.centerVelocity.clone();
  for (let i = 0; i < 100; i++) impacts.step(0.01);
  assert.equal(impacts.active.length, 0);
  assert.equal(a.destroyed, false); assert.equal(b.destroyed, false);
  assert.equal(live(app).length, 24);
  assert.ok(live(app).every(b => b.root.visible && b.isImpactFragment));
  assert.ok(Math.abs(live(app).reduce((sum, b) => sum + b.mass, 0) - 7) < 1e-10);
  assert.ok(momentum(app).distanceTo(velocity) < 1e-10);
  assert.ok(center(app).distanceTo(velocity.clone().multiplyScalar(0.75).add(new THREE.Vector3(-5/7, 0, 0))) < 1e-9);
  const energy = live(app).reduce((sum, b) => sum + 0.5 * b.mass * b.velocity.clone().sub(velocity).lengthSq(), 0);
  assert.ok(Math.abs(energy / event.relativeEnergy - 0.3) < 1e-10);
  app.bodies.forEach(b => b.dispose());
});

test("merger transports visible material before retiring the victim and conserves mass, momentum and center", () => {
  const { a, b, app, impacts, event } = setup("merge");
  const initialCenter = center(app), velocity = event.centerVelocity.clone();
  let transported = false, incorporated = false, time = 0;
  for (let i = 0; i < 600 && impacts.active.length; i++) {
    impacts.step(0.01); time += 0.01;
    assert.ok(Math.abs(live(app).reduce((sum, b) => sum + b.mass, 0) - 7) < 1e-9);
    assert.ok(momentum(app).distanceTo(velocity) < 1e-9);
    assert.ok(center(app).distanceTo(initialCenter.clone().addScaledVector(velocity, time)) < 1e-9);
    if (impacts.active[0]?.phase === "transfer") {
      transported = true;
      assert.equal(b.destroyed, false);
      assert.ok(impacts.active[0].parts.length > 0);
      assert.ok(impacts.active[0].parts.every(p => p.mesh.parent === app.scene.scene));
      if (a.mass > 6) incorporated = true;
    }
  }
  assert.ok(transported && incorporated);
  assert.equal(impacts.active.length, 0);
  assert.equal(b.destroyed, true); assert.ok(Math.abs(a.mass - 7) < 1e-9);
  assert.ok(Math.abs(a.radius ** 3 - 2) < 1e-9);
  assert.ok(Math.abs(a.mu - 0.07) < 1e-12);
  assert.equal(a.impactLocked, false);
  app.bodies.forEach(b => b.dispose());
});

test("reset removes in-flight material and restores the contact transforms", () => {
  const { a, b, app, impacts } = setup("merge");
  impacts.step(1.4);
  assert.equal(impacts.active[0].phase, "transfer");
  const parts = [...impacts.active[0].parts];
  impacts.clear();
  assert.equal(impacts.active.length, 0);
  assert.ok(parts.every(p => p.mesh.parent === null));
  assert.equal(a.impactLocked, false); assert.equal(b.impactLocked, false);
  assert.equal(a.impactGroup.matrix.determinant(), 1);
  app.bodies.forEach(b => b.dispose());
});

test("a full body pool reuses both originals without discarding either mass", () => {
  const { a, b, app, impacts } = setup("disruption");
  for (let i = 0; i < 94; i++) app.bodies.push({ mass: 0, destroyed: false, position: new THREE.Vector3(), mu: 0 });
  app.spawn = () => { throw new Error("No capacity available"); };
  impacts.step(0.75);
  assert.equal(app.bodies.length, 96);
  assert.ok(Math.abs(a.mass + b.mass - 7) < 1e-10);
  assert.equal(a.root.visible, true); assert.equal(b.root.visible, true);
  assert.equal(impacts.active.length, 0);
  a.dispose(); b.dispose();
});

test("contact and material transfer freeze on pause and advance with the single-day control", () => {
  const { app, impacts } = setup("merge");
  const clock = new SimulationClock(); clock.paused = true;
  impacts.step(clock.update(10) * 0.1);
  assert.equal(impacts.active[0].age, 0);
  clock.advance(1); impacts.step(clock.update(0.1) * 0.1);
  assert.equal(impacts.active[0].age, 0.1);
  impacts.step(clock.update(10) * 0.1);
  assert.equal(impacts.active[0].age, 0.1);
  impacts.clear(); app.bodies.forEach(b => b.dispose());
});

test("a planet hitting a giant is not erased by the tiny-projectile crater shortcut", () => {
  const a = body("giant", 10000, 5), b = body("planet", 1);
  b.data.orbitalPeriodDays = 365;
  b.velocity.set(-0.01, 0, 0);
  assert.equal(classifyImpact(a, b, new THREE.Vector3(1, 0, 0)).regime, "merge");
  a.dispose(); b.dispose();
});

test("rocky merger heat includes the change in binding energy and cools without returning to a pristine Earth in days", () => {
  const earth = body("earth", PLANETS[2].massKg, 1.65), mars = body("mars", PLANETS[3].massKg, 1.16);
  earth.data = PLANETS[2]; mars.data = PLANETS[3];
  const heat = estimateMergerHeat(earth, mars, { speed: 0.2, escape: 1 });
  const thermal = new ThermalModel(ENVIRONMENTS.earth, 1);
  thermal.addMergerHeat(heat);
  const temperature = thermal.surfaceTemperature;
  assert.ok(temperature > 1400 && temperature < 1800);
  assert.ok(Math.abs(thermal.bulkHeat * thermal.heatCapacity / heat.energyJ - 1) < 1e-12);
  const repeated = new ThermalModel(ENVIRONMENTS.earth, 1);
  repeated.addMergerHeat(heat);
  repeated.addMergerHeat({ ...heat, massKg: heat.massKg * 2 });
  assert.ok(Math.abs(repeated.bulkHeat * repeated.heatCapacity / (heat.energyJ * 2) - 1) < 1e-12);
  thermal.update(0, 1, 1); assert.equal(thermal.surfaceTemperature, temperature);
  thermal.update(45, 1, 1);
  assert.ok(thermal.surfaceTemperature < temperature);
  assert.ok(thermal.surfaceTemperature > 1400 && thermal.molten > 0.1);
  assert.equal(thermal.ice, 0);
  assert.equal(thermal.state, "Superfície em fusão");
  thermal.update(1e9, 1, 1);
  assert.ok(Number.isFinite(thermal.surfaceTemperature) && thermal.bulkHeat >= 0);
  earth.dispose(); mars.dispose();
});
