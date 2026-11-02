import * as THREE from "three";
import { SceneManager } from "./core/SceneManager.js";
import { AssetLoader } from "./core/AssetLoader.js";
import { SimulationClock } from "./core/Clock.js";
import { Star } from "./bodies/Star.js";
import { Planet } from "./bodies/Planet.js";
import { AsteroidBelt } from "./bodies/Asteroid.js";
import { CameraController } from "./interaction/CameraController.js";
import { SelectionSystem } from "./interaction/SelectionSystem.js";
import { ControlPanel } from "./ui/ControlPanel.js";
import { InfoHUD } from "./ui/InfoHUD.js";
import { Minimap } from "./ui/Minimap.js";
import { EventLog } from "./ui/EventLog.js";
import { SUN, PLANETS, BODY_DATA, AU } from "./data/planetData.js";
import { GravityEngine } from "./physics/GravityEngine.js";
import { CollisionSystem } from "./physics/CollisionSystem.js";
import { Meteor } from "./bodies/Meteor.js";
import { BlackHole } from "./bodies/BlackHole.js";
import { ParticleSystem } from "./effects/ParticleSystem.js";
import { TrailRenderer } from "./effects/TrailRenderer.js";
import { DragAndLaunch } from "./interaction/DragAndLaunch.js";
import { runPreset } from "./data/presets.js";
import { classifyImpact, resolveGrazing } from "./physics/ImpactModel.js";
import { clamp } from "./physics/PhysicalUnits.js";
import { tidalLoad } from "./physics/TidalModel.js";
import { TidalDebris } from "./effects/TidalDebris.js";
import { PlanetImpacts } from "./effects/PlanetImpacts.js";

class Solaris {
  async init() {
    this.assets = new AssetLoader();
    await this.assets.load(
      [
        ...new Set(
          BODY_DATA.map((d) => d.texture).concat([
            "moon",
            "earth_clouds",
            "earth_nightmap",
          ]),
        ),
      ],
      (p, name) => {
        document.getElementById("loading-progress").style.width = `${p * 100}%`;
        document.getElementById("loading-text").textContent =
          `Carregando ${BODY_DATA.find((d) => d.texture === name)?.name || "detalhes do universo"}…`;
      },
    );
    this.scene = new SceneManager(document.getElementById("viewport"));
    this.clock = new SimulationClock();
    this.camera = new CameraController(
      this.scene.camera,
      this.scene.renderer.domElement,
    );
    this.log = new EventLog();
    this.hud = new InfoHUD();
    this.bodies = [];
    this.showOrbits = true;
    this.showLabels = true;
    this.showBelt = true;
    this.realScale = false;
    this.collisionsEnabled = true;
    this.luminosity = 1;
    this.tool = null;
    this.nextId = 0;
    this.PlanetClass = Planet;
    this.gravity = new GravityEngine();
    this.collision = new CollisionSystem((a, b, contact) => this.impact(a, b, contact));
    this.particles = new ParticleSystem(this.scene.scene);
    this.tidalDebris = new TidalDebris(this.scene.scene);
    this.planetImpacts = new PlanetImpacts(this);
    this.buildSystem();
    this.ui = new ControlPanel(this);
    this.selection = new SelectionSystem(this);
    this.drag = new DragAndLaunch(this);
    this.minimap = new Minimap((b) => this.select(b));
    this.select(
      this.bodies.find((b) => b.id === "earth"),
      false,
    );
    this.last = performance.now();
    this.frames = 0;
    this.fpsTime = 0;
    this.elapsed = 0;
    this.animate(this.last);
    document.getElementById("loading").classList.add("done");
    setTimeout(() => (document.getElementById("loading").hidden = true), 800);
    if (this.assets.failures.length)
      this.log.add(
        "Algumas texturas não carregaram. Exibindo materiais alternativos.",
      );
  }
  buildSystem() {
    this.sun = new Star(SUN, this.assets);
    this.bodies.push(this.sun);
    for (const d of PLANETS) this.bodies.push(new Planet(d, this.assets));
    for (const b of this.bodies) {
      this.scene.scene.add(b.root);
      if (b.orbit) this.scene.scene.add(b.orbit);
      this.addLabel(b);
    }
    this.belt = new AsteroidBelt();
    this.scene.scene.add(this.belt.mesh);
  }
  addLabel(body) {
    const label = document.createElement("button");
    label.className = "body-label";
    label.textContent = body.data.name;
    label.setAttribute("aria-label", `Focar ${body.data.name}`);
    label.addEventListener("click", () => this.select(body));
    document.getElementById("labels").append(label);
    body.label = label;
  }
  select(body, focus = true) {
    if (body.destroyed) return;
    this.selected = body;
    this.hud.show(
      body,
      BODY_DATA.findIndex((d) => d.id === body.id),
    );
    this.ui?.selected(body);
    if (focus) this.camera.focus(body);
  }
  overview() {
    this.camera.overview(this.realScale);
    document.getElementById("view-caption").textContent = "SISTEMA SOLAR";
    this.ui.toggle(document.getElementById("free-flight"), false);
  }
  setScale(real) {
    // Rebuild after experiments so changing units never mixes incompatible velocities.
    if (this.bodies.some((b) => b.free || b.destroyed)) this.reset(false);
    this.realScale = real;
    for (const b of this.bodies) if (b instanceof Planet) b.setScale(real);
    this.sun.root.scale.setScalar(
      real ? ((SUN.radiusKm / AU) * 30) / SUN.visualRadius : 1,
    );
    this.sun.radius = real ? (SUN.radiusKm / AU) * 30 : SUN.visualRadius;
    document
      .querySelectorAll("[data-scale]")
      .forEach((b) =>
        b.classList.toggle("active", (b.dataset.scale === "real") === real),
      );
    document.getElementById("scale-caption").textContent = real
      ? "PROPORÇÕES ASTRONÔMICAS"
      : "DISTÂNCIAS ILUSTRATIVAS";
    this.overview();
    if (real)
      this.log.add(
        "Escala real: planetas ficam minúsculos. Selecione um nome para explorar de perto.",
      );
  }
  reset(notify = true) {
    this.setTool(null);
    this.planetImpacts.clear();
    for (const b of this.bodies) b.dispose();
    this.bodies = [];
    this.belt.mesh.removeFromParent();
    this.belt.mesh.geometry.dispose();
    this.belt.mesh.material.dispose();
    this.particles.clear();
    this.tidalDebris.clear();
    this.log.clear();
    this.clock.reset();
    this.luminosity = 1;
    this.lastImpact = null;
    document.getElementById("solar-flux").value = 1;
    document.getElementById("solar-flux-value").value = "1×";
    this.gravity = new GravityEngine();
    this.realScale = false;
    this.collisionsEnabled = true;
    this.nextId = 0;
    this.buildSystem();
    this.select(
      this.bodies.find((b) => b.id === "earth"),
      false,
    );
    this.overview();
    document.getElementById("time-speed").value = 3;
    document.getElementById("time-value").textContent = "10 dias/s";
    document.getElementById("gravity").value = 1;
    document.getElementById("gravity-value").value = "1×";
    document.getElementById("sun-mass").value = 1;
    document.getElementById("sun-mass-value").value = "1 M☉";
    document.getElementById("mutual-gravity").checked = false;
    document.getElementById("collisions").checked = true;
    document.getElementById("scale-caption").textContent =
      "DISTÂNCIAS ILUSTRATIVAS";
    document
      .querySelectorAll("[data-scale]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.scale === "educational"),
      );
    document
      .querySelectorAll("[data-body]")
      .forEach((b) => (b.disabled = false));
    this.belt.mesh.count = { low: 600, medium: 1600, ultra: 3200 }[
      document.getElementById("quality").value
    ];
    this.ui.syncPlay();
    if (notify) this.log.add("Um novo começo. Sistema Solar restaurado.");
  }
  setTool(tool) {
    this.drag?.cancel();
    if (tool && this.realScale) {
      this.setScale(false);
      this.log.add("Laboratório aberto em escala didática.");
    }
    this.tool = tool;
    this.camera.setFree(false);
    this.camera.controls.enabled = !tool;
    this.ui.toggle(document.getElementById("free-flight"), false);
    this.scene.renderer.domElement.classList.toggle("crosshair", !!tool);
    document
      .querySelectorAll("[data-spawn]")
      .forEach((b) => b.classList.toggle("active", b.dataset.spawn === tool));
    document.getElementById("cancel-tool").hidden = !tool;
    document.getElementById("tool-hint").textContent =
      tool === "throw"
        ? "Clique e arraste um planeta. Ao soltar, ele seguirá na direção da seta."
        : tool
          ? "Clique no espaço e arraste na direção desejada. Solte para criar."
          : "Escolha um corpo e clique no espaço. Arraste para definir a velocidade.";
    if (tool === "throw")
      this.log.add(
        "Arraste um planeta no espaço para removê-lo da órbita e lançá-lo.",
      );
  }
  preset(name) {
    this.setTool(null);
    runPreset(this, name);
  }
  enablePhysics(on) {
    if (this.realScale) this.setScale(false);
    this.gravity.mutual = on;
    document.getElementById("mutual-gravity").checked = on;
    for (const b of this.bodies)
      if (b instanceof Planet && !b.destroyed)
        this.gravity.release(b, this.sun);
    if (on) {
      this.limitPhysicsSpeed();
      this.log.add(
        "Gravidade mútua ativada. As órbitas agora respondem à física.",
      );
    } else
      this.log.add(
        "Atração entre planetas desligada. Reinicie para restaurar órbitas keplerianas.",
      );
  }
  limitPhysicsSpeed() {
    if (this.clock.speed > 100) {
      this.clock.speed = 100;
      document.getElementById("time-speed").value = 5;
      document.getElementById("time-value").textContent = "100 dias/s";
      this.log.add(
        "Laboratório limitado a 100 dias/s para preservar a estabilidade das colisões.",
      );
    }
  }
  spawn(type, position, velocity = new THREE.Vector3(), quiet = false) {
    if (this.bodies.filter((b) => !b.destroyed).length >= 96) {
      if (!quiet)
        this.log.add(
          "Limite de 96 corpos atingido. Reinicie para abrir espaço.",
        );
      return null;
    }
    let body;
    const id = `created-${++this.nextId}`;
    if (type === "blackhole") {
      body = new BlackHole(id);
      this.enablePhysics(true);
    } else if (type === "star") {
      body = new Star(
        {
          ...SUN,
          id,
          name: "Estrela companheira",
          visualRadius: 3,
          massKg: SUN.massKg * 0.65,
        },
        this.assets,
      );
      body.free = true;
      body.isAttractor = true;
      body.light.castShadow = false;
      this.enablePhysics(true);
    } else {
      body = new Meteor(id, type === "comet", type === "debris");
      if (type === "comet") body.trail = new TrailRenderer(this.scene.scene);
    }
    body.position.copy(position);
    body.velocity.copy(velocity);
    this.bodies.push(body);
    this.scene.scene.add(body.root);
    if (!body.isDebris) this.addLabel(body);
    this.limitPhysicsSpeed();
    if (!quiet) this.log.add(`${body.data.name} adicionado ao universo.`);
    return body;
  }
  destroy(body) {
    if (body.destroyed) return;
    body.destroyed = true;
    body.root.visible = false;
    body.label?.remove();
    body.trail?.dispose();
    body.trail = null;
    if (body.orbit) body.orbit.visible = false;
    const row = document.querySelector(`[data-body="${body.id}"]`);
    if (row) row.disabled = true;
    if (this.selected === body) {
      this.camera.tracking = null;
      this.select(
        this.bodies.find((b) => !b.destroyed && b !== body) || this.sun,
        false,
      );
    }
  }
  impact(a, b, contact) {
    if (a.destroyed || b.destroyed || a.impactLocked || b.impactLocked) return;
    const event = classifyImpact(a, b, contact.normal, this.gravity.global);
    a.position.copy(contact.pa); b.position.copy(contact.pb);
    const larger = a.mass >= b.mass ? a : b, smaller = larger === a ? b : a;
    const outward = contact.normal.clone().multiplyScalar(larger === a ? 1 : -1);
    const point = larger.position.clone().addScaledVector(outward, larger.radius);
    const options = { normal: outward, atmosphere: !!larger.environment?.profile.atmosphere };
    const absorb = (target, victim) => {
      const mass = target.mass + victim.mass;
      target.velocity.copy(event.centerVelocity);
      if (target.isBlackHole) target.accrete(victim.mass);
      else target.setMass(mass);
      this.destroy(victim);
    };
    this.lastImpact = { ...event, names: `${a.data.name} × ${b.data.name}` };
    const hole = a.isBlackHole ? a : b.isBlackHole ? b : null;
    if (hole) {
      const victim = hole === a ? b : a;
      if (this.disruptByTides(victim, hole)) return;
      // Capacity fallback keeps capture mass/momentum intact without emitting
      // the old isotropic explosion at the horizon.
      hole.accretion = Math.min(1.5, hole.accretion + 0.4);
      absorb(hole, victim);
      return;
    }
    const star = a instanceof Star ? a : b instanceof Star ? b : null;
    if (star) {
      const victim = star === a ? b : a;
      this.particles.burst(victim.position, "#ffc083", 3);
      absorb(star, victim);
      this.log.add(`${victim.data.name} foi incorporado por ${star.data.name}.`);
      return;
    }
    const small = event.regime === "crater" ? smaller : null;
    if (small) {
      const target = small === a ? b : a;
      const point = small.position
        .clone()
        .sub(target.position)
        .normalize()
        .multiplyScalar(target.radius)
        .add(target.position);
      const angularSize = clamp(Math.cbrt(small.mass / target.mass) * (1 + Math.sqrt(event.speed)) * 4, 0.008, 0.22);
      target.addCrater(point, angularSize);
      target.environment?.impact(point, clamp(angularSize * 10, 0.05, 1));
      this.particles.burst(point, target.data.color, 0.3 + angularSize * 5, { ...options, ice: small.data.type === "Cometa" });
      absorb(target, small);
      if (!small.isDebris)
        this.log.add(`${small.data.name} atingiu ${target.data.name}.`);
      return;
    }
    if (event.regime === "grazing") {
      resolveGrazing(a, b, contact.normal);
      const overlap = a.radius + b.radius - a.position.distanceTo(b.position) + 0.01;
      a.position.addScaledVector(contact.normal, -Math.max(0, overlap) * b.mass / event.mass);
      b.position.addScaledVector(contact.normal, Math.max(0, overlap) * a.mass / event.mass);
      this.particles.burst(contact.point, "#c9a27a", 0.8, options);
      a.environment?.impact(contact.point, 0.5); b.environment?.impact(contact.point, 0.5);
      this.log.add(`Impacto rasante: ${a.data.name} e ${b.data.name} sobreviveram.`);
      return;
    }
    this.planetImpacts.begin(a, b, event, contact);
  }
  disruptByTides(body, source) {
    if (body.isBlackHole || body.destroyed || !this.tidalDebris.add(body, source)) return false;
    const followed = this.selected === body || this.camera.tracking === body;
    if (followed) this.camera.frameEncounter(body, source);
    this.destroy(body);
    if (followed) this.select(source, false);
    if (!body.isDebris) this.log.add(`${body.data.name}: ruptura de maré. O material segue trajetórias próprias antes da captura.`);
    return true;
  }
  updateTides(h) {
    const holes = this.bodies.filter(b => b.isBlackHole && !b.destroyed);
    if (this.realScale) return;
    for (const body of this.bodies) {
      if (body.destroyed || body.isBlackHole || body.dragging || body.impactLocked) continue;
      let strongest = null;
      for (const hole of holes) {
        const load = tidalLoad(body, hole, this.gravity.global);
        if (!strongest || load.ratio > strongest.ratio) strongest = load;
      }
      const broken = body.tidal.update(strongest, h);
      body.updateTidalShape();
      if (broken && strongest) this.disruptByTides(body, strongest.source);
    }
  }
  updatePhysics(dt, days) {
    const physical = this.bodies.some((b) => b.free && !b.destroyed);
    if (physical) this.limitPhysicsSpeed();
    this.gravity.step(this.bodies, days * 0.1, (h) => {
      this.planetImpacts.step(h);
      this.tidalDebris.step(h, this.bodies, this.gravity.global, (hole, fragment) => {
        const total = hole.mass + fragment.mass;
        hole.velocity.multiplyScalar(hole.mass / total).addScaledVector(fragment.velocity, fragment.mass / total);
        const feed = fragment.mass / hole.mass;
        hole.accrete(fragment.mass);
        hole.accretion = Math.min(1.5, hole.accretion + Math.min(0.15, Math.cbrt(feed) * 2));
      });
      this.updateTides(h);
      if (this.collisionsEnabled) this.collision.check(this.bodies);
    });
    this.tidalDebris.render();
    for (const b of this.bodies) {
      if (b.destroyed) continue;
      if (b instanceof Meteor) {
        b.update(days);
        if (days) b.trail?.update(b.position);
        if (!b.isImpactFragment && (b.age > 6000 || b.position.length() > 4000)) this.destroy(b);
      }
      if (b.fragmentHeat) b.fragmentHeat.emissiveIntensity *= Math.exp(-Math.abs(days) / 20);
      if (b instanceof BlackHole) b.update(days, this.elapsed);
      if (b.environment) {
        const distanceAU = b.position.distanceTo(this.sun.position) / b.distance * b.data.distanceFromSunKm / AU;
        b.environment.update(days, distanceAU, this.luminosity, this.sun.position);
      }
    }
    this.particles.update(
      days * 0.1,
      this.bodies.filter(
        (b) => !b.destroyed && (b.id === "sun" || b.isAttractor),
      ),
    );
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i];
      if (b.destroyed && !BODY_DATA.some((d) => d.id === b.id)) {
        b.dispose();
        this.bodies.splice(i, 1);
      }
    }
    document.getElementById("simulation-status").textContent = physical
      ? "FÍSICA SANDBOX"
      : "ÓRBITAS KEPLERIANAS";
  }
  updateLensing() {
    this.scene.camera.updateMatrixWorld();
    const holes = this.bodies.filter((b) => b.isBlackHole && !b.destroyed);
    let visibleHole = null,
      bestRadius = 0;
    for (const hole of holes) {
      const p = hole.position.clone().project(this.scene.camera),
        distance = this.scene.camera.position.distanceTo(hole.position),
        radius = (hole.radius / distance) * 1.2;
      if (
        p.z < 1 &&
        p.z > -1 &&
        Math.abs(p.x) < 1.3 &&
        Math.abs(p.y) < 1.3 &&
        radius > bestRadius
      ) {
        visibleHole = { p, radius, hole };
        bestRadius = radius;
      }
    }
    const lens = this.scene.post.lens.uniforms;
    lens.radius.value = visibleHole ? visibleHole.radius : 0;
    if (visibleHole) {
      lens.center.value.set(
        visibleHole.p.x * 0.5 + 0.5,
        visibleHole.p.y * 0.5 + 0.5,
      );
      lens.holeViewDepth.value = -visibleHole.hole.position.clone().applyMatrix4(this.scene.camera.matrixWorldInverse).z;
      lens.holeRadius.value = visibleHole.hole.radius;
    }
    lens.cameraNear.value = this.scene.camera.near;
    lens.cameraFar.value = this.scene.camera.far;
  }
  updateLabels() {
    const camera = this.scene.camera;
    camera.updateMatrixWorld();
    for (const b of this.bodies) {
      if (!b.label) continue;
      const p = b.position.clone().project(camera);
      const distance = camera.position.distanceTo(b.position);
      const offset = Math.max(9, (b.radius / distance) * innerHeight * 1.2);
      const visible =
        this.showLabels &&
        !b.destroyed &&
        p.z < 1 &&
        p.z > -1 &&
        Math.abs(p.x) < 1.1 &&
        Math.abs(p.y) < 1.1;
      b.label.hidden = !visible;
      if (visible) {
        b.label.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
        b.label.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight + offset}px`;
        b.label.classList.toggle("active", b === this.selected);
      }
    }
  }
  animate(now) {
    const wallDt = (now - this.last) / 1000,
      dt = Math.min(wallDt, 0.05);
    this.last = now;
    if (!this.clock.paused) this.elapsed += dt;
    if (this.bodies.some((b) => b.free && !b.destroyed))
      this.limitPhysicsSpeed();
    const days = this.clock.update(dt);
    for (const b of this.bodies) {
      if (b.destroyed) continue;
      b.previous = b.position.clone();
      if (b instanceof Star) b.update(days, this.elapsed);
      else if (b instanceof Planet) b.update(days, this.scene.camera);
      if (b.orbit) b.orbit.visible = this.showOrbits && !b.free && !b.destroyed;
    }
    this.updatePhysics(dt, days);
    this.sun.light.intensity = 3.6 * this.luminosity;
    this.sun.material.emissiveIntensity = 2.1 * this.luminosity;
    this.sun.glow.material.opacity *= Math.min(1.5, Math.sqrt(this.luminosity));
    this.belt.update(this.clock.days);
    this.belt.mesh.visible = this.showBelt && !this.realScale;
    this.camera.update(dt);
    this.updateLensing();
    this.updateLabels();
    this.scene.render();
    this.frames++;
    this.fpsTime += wallDt;
    if (this.frames % 6 === 0) {
      this.ui.update();
      this.hud.update(this.selected);
      this.minimap.draw(this.bodies, this.selected, this.realScale);
    }
    if (this.fpsTime >= 1) {
      document.getElementById("fps").textContent =
        `${Math.round(this.frames / this.fpsTime)} FPS`;
      this.frames = 0;
      this.fpsTime = 0;
    }
    requestAnimationFrame((t) => this.animate(t));
  }
}
const app = new Solaris();
app.init().catch((error) => {
  console.error(error);
  document.getElementById("loading-text").textContent =
    "Não foi possível iniciar o WebGL. Ative a aceleração de hardware e recarregue a página.";
});
