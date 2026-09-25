import * as THREE from "three";
export function runPreset(app, name) {
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
        8 + Math.random() * 6,
        Math.random() * 2,
        5 + Math.random() * 5,
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
  if (name === "collision") {
    const mars = app.bodies.find((b) => b.id === "mars" && !b.destroyed);
    if (!earth || !mars) {
      app.log.add("Reinicie para recriar Terra e Marte.");
      return;
    }
    app.gravity.release(earth, app.sun);
    app.gravity.release(mars, app.sun);
    earth.position.set(145, 20, 0);
    earth.velocity.set(0, 0, 0);
    mars.position.copy(earth.position).add(new THREE.Vector3(12, 0, 0));
    earth.previous = earth.position.clone();
    mars.previous = mars.position.clone();
    mars.velocity.set(-7, 0, 0);
    app.select(earth);
    app.camera.focus(earth, false);
    app.log.add("Rota de colisão: Terra × Marte.");
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
