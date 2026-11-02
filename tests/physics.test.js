import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  orbitalPosition,
  solveKepler,
} from "../js/physics/OrbitalMechanics.js";
import { GravityEngine } from "../js/physics/GravityEngine.js";
import {
  sweptSphereHit,
  CollisionSystem,
} from "../js/physics/CollisionSystem.js";
import { SimulationClock } from "../js/core/Clock.js";
import { PLANETS } from "../js/data/planetData.js";

test("Kepler solver converges for large times and eccentric orbits", () => {
  for (const e of [0, 0.0167, 0.206, 0.8, 0.95])
    for (const m of [0, 0.1, 2, 5, 1e6]) {
      const E = solveKepler(m, e),
        wrapped = ((m % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      assert.ok(Math.abs(E - e * Math.sin(E) - wrapped) < 1e-9);
    }
});
test("every planet returns to its initial position after one period", () => {
  for (const data of PLANETS) {
    const a = orbitalPosition(data, 0),
      b = orbitalPosition(data, data.orbitalPeriodDays);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-9);
  }
});
test("perihelion and aphelion agree with a(1±e)", () => {
  const d = { ...PLANETS[0], phase: 0, inclination: 0 };
  assert.ok(
    Math.abs(
      orbitalPosition(d, 0).x - d.visualDistance * (1 - d.eccentricity),
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      orbitalPosition(d, d.orbitalPeriodDays / 2).x +
        d.visualDistance * (1 + d.eccentricity),
    ) < 1e-9,
  );
});
test("leapfrog retains a circular orbit and energy over ten revolutions", () => {
  const engine = new GravityEngine(),
    sun = { id: "sun", position: new THREE.Vector3(), mu: 120, free: false },
    planet = {
      position: new THREE.Vector3(20, 0, 0),
      velocity: new THREE.Vector3(0, 0, Math.sqrt(6)),
      mu: 0,
      free: true,
    };
  const initial = planet.velocity.lengthSq() / 2 - 120 / 20;
  const period = 2 * Math.PI * Math.sqrt(20 ** 3 / 120);
  for (let t = 0; t < period * 10; t += 0.1) engine.step([sun, planet], 0.1);
  const energy =
    planet.velocity.lengthSq() / 2 - 120 / planet.position.length();
  assert.ok(Math.abs(energy - initial) / Math.abs(initial) < 0.001);
  assert.ok(Math.abs(planet.position.length() - 20) < 0.01);
});
test("mutual gravity applies equal opposite momentum and respects zero gravity", () => {
  const engine = new GravityEngine();
  engine.mutual = true;
  const a = {
      position: new THREE.Vector3(-2, 0, 0),
      mu: 2,
      velocity: new THREE.Vector3(),
      free: true,
    },
    b = {
      position: new THREE.Vector3(2, 0, 0),
      mu: 4,
      velocity: new THREE.Vector3(),
      free: true,
    };
  engine.step([a, b], 0.1);
  assert.ok(a.velocity.x > 0 && b.velocity.x < 0);
  assert.ok(Math.abs(a.velocity.x * 2 + b.velocity.x * 4) < 1e-9);
  engine.global = 0;
  assert.equal(engine.acceleration(a, [a, b]).length(), 0);
});
test("continuous collision detects fast projectiles without false distant hits", () => {
  const origin = new THREE.Vector3();
  assert.equal(
    sweptSphereHit(
      new THREE.Vector3(-10, 0, 0),
      new THREE.Vector3(10, 0, 0),
      origin,
      origin,
      1,
    ),
    true,
  );
  assert.equal(
    sweptSphereHit(
      new THREE.Vector3(-10, 3, 0),
      new THREE.Vector3(10, 3, 0),
      origin,
      origin,
      1,
    ),
    false,
  );
});
test("destroyed bodies trigger only one collision", () => {
  let hits = 0;
  const bodies = [0, 1, 2].map(() => ({
    position: new THREE.Vector3(),
    radius: 1,
    free: true,
  }));
  const collisions = new CollisionSystem((a, b) => {
    hits++;
    a.destroyed = true;
    b.destroyed = true;
  });
  collisions.check(bodies);
  assert.equal(hits, 1);
});
test("pause and reset preserve simulated time semantics", () => {
  const c = new SimulationClock();
  c.update(1);
  assert.equal(c.days, 10);
  c.paused = true;
  assert.equal(c.update(3), 0);
  assert.equal(c.days, 10);
  c.advance(2);
  assert.equal(c.update(100), 2);
  assert.equal(c.days, 12);
  assert.equal(c.paused, true);
  assert.equal(c.update(100), 0);
  c.reset();
  assert.equal(c.days, 0);
  assert.equal(c.paused, false);
});
