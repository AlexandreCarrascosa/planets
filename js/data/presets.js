import * as THREE from "three";
import { seededRandom } from "../physics/PhysicalUnits.js";
import { ScientificScenarios } from "../physics/ScientificScenarios.js";
export function runPreset(app, name) {
  const random = seededRandom(1942);
  if(["physical-orbits","binary-physical","relativity","blackhole-orbits","future-sun"].includes(name)) {
    app.reset(false);app.scientific=new ScientificScenarios(app,name);
    app.clock.speed=10;app.ui.syncPlay();app.overview();
    if(name==="binary-physical")app.camera.frameEncounter(app.sun,app.scientific.companion);
    app.select(name==="future-sun"?app.sun:app.bodies.find(b=>b.id==="earth"),false);
    for(const id of ["gravity","sun-mass","solar-flux","mutual-gravity","collisions","reverse-orbit","throw-planet"])document.getElementById(id).disabled=true;
    app.log.add(name==="future-sun"?"Evolução solar condensada. Ajuste a fase em Física; o destino da Terra depende de perda de massa e marés.":"Dinâmica em AU/dias/massas solares. Raios visuais ampliados não são usados como raios de colisão.");
    return;
  }
  if(app.scientific)app.reset(false);
  if (["collision", "merge", "grazing"].includes(name) || app.planetImpacts.active.length) app.reset(false);
  if (name === "tides") {
    app.reset(false);
    const earth = app.bodies.find(b => b.id === "earth");
    earth.position.set(145, 20, 0);
    const hole = app.spawn("blackhole", new THREE.Vector3(178, 20, 0), new THREE.Vector3(), true);
    if (!hole) return;
    earth.velocity.set(0, 0, 0.65);
    app.clock.paused = false; app.clock.speed = 1;
    document.getElementById("time-speed").value = 2;
    document.getElementById("time-value").textContent = "1 dia/s";
    app.ui.syncPlay();
    app.select(earth, false);
    app.camera.frameEncounter(earth, hole);
    app.log.add("Encontro de maré: acompanhe o alongamento, a ruptura e a captura gradual. Modelo reduzido.");
    return;
  }
  if (["freeze", "heat"].includes(name)) {
    app.reset(false);
    app.luminosity = name === "freeze" ? 0.1 : 8;
    document.getElementById("solar-flux").value = app.luminosity;
    document.getElementById("solar-flux-value").value = `${app.luminosity}×`;
  }
  if (app.realScale) app.setScale(false);
  app.clock.paused = false;
  app.clock.speed = 10;
  document.getElementById("time-speed").value = 3;
  document.getElementById("time-value").textContent = "10 dias/s";
  app.ui.syncPlay();
  const earth = app.bodies.find((b) => b.id === "earth" && !b.destroyed);
  if (name === "meteor") {
    const target =
      earth ||
      app.bodies.find((b) => b instanceof app.PlanetClass && !b.destroyed);
    if (!target) {
      app.log.add("Reinicie a simulação para recuperar os planetas.");
      return;
    }
    app.gravity.release(target, app.sun);
    app.select(target);
    for (let i = 0; i < 9; i++) {
      const offset = new THREE.Vector3(
        8 + random() * 6,
        random() * 2,
        5 + random() * 5,
      );
      app.spawn(
        "meteor",
        target.position.clone().add(offset),
        offset.clone().normalize().multiplyScalar(-7).add(target.velocity),
        true,
      );
    }
    app.log.add(`Chuva de meteoros a caminho de ${target.data.name}.`);
  }
  if (["freeze", "heat"].includes(name)) {
    app.select(earth);
    app.log.add(name === "freeze"
      ? "Luminosidade reduzida: acompanhe o resfriamento e o gelo ao longo dos próximos dias."
      : "Luminosidade ampliada: acompanhe a temperatura e a resposta das nuvens. Clima extrapolado.");
  }
  if (["collision", "merge", "grazing"].includes(name)) {
    const mars = app.bodies.find((b) => b.id === "mars" && !b.destroyed);
    if (!earth || !mars) {
      app.log.add("Reinicie para recriar Terra e Marte.");
      return;
    }
    app.gravity.release(earth, app.sun);
    app.gravity.release(mars, app.sun);
    earth.position.set(earth.distance / Math.sqrt(2), earth.distance / Math.sqrt(2), 0);
    earth.velocity.set(0, 0, 0);
    const close = name !== "collision";
    mars.position.copy(earth.position).add(new THREE.Vector3(close ? earth.radius + mars.radius + 0.00001 : 12, 0, 0));
    earth.previous = earth.position.clone();
    mars.previous = mars.position.clone();
    const escape = Math.sqrt(2 * (earth.mu + mars.mu) / (earth.radius + mars.radius));
    mars.velocity.set(name === "merge" ? -escape * 0.2 : name === "grazing" ? -escape * 0.8 : -7, 0, name === "grazing" ? escape * 2 : 0);
    app.select(earth);
    app.camera.focus(earth, true);
    app.log.add(`Rota de colisão: Terra × Marte · ${name === "merge" ? "aproximação lenta" : name === "grazing" ? "rasante" : "alta energia"}.`);
  }
  if (name === "binary") {
    app.spawn(
      "star",
      new THREE.Vector3(-27, 0, 20),
      new THREE.Vector3(0, 0, -1),
    );
    app.enablePhysics(true);
    app.overview();
    app.log.add("Sistema binário: a segunda estrela perturba as órbitas.");
  }
}
