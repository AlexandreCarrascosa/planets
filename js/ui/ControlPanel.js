import { icon, populateIcons } from "./icons.js";
import { assetUrl } from "../core/assetUrl.js";
import { BODY_DATA, SPEEDS, SPEED_LABELS } from "../data/planetData.js";
import { InputManager } from "../interaction/InputManager.js";
export class ControlPanel {
  constructor(app) {
    this.app = app;
    populateIcons();
    const list = document.getElementById("body-list");
    list.innerHTML = BODY_DATA.map(
      (d) =>
        `<button class="body-row" data-body="${d.id}" aria-label="Selecionar ${d.name}"><span class="body-thumb ${d.id}" style="background-image:url('${assetUrl(`assets/textures/${d.texture}.jpg`)}');background-color:${d.color}"></span><span class="body-name">${d.name}</span><small>${d.type}</small></button>`,
    ).join("");
    list.addEventListener("click", (e) => {
      const row = e.target.closest("[data-body]");
      if (row) {
        const b = app.bodies.find(
          (b) => b.id === row.dataset.body && !b.destroyed,
        );
        if (b) app.select(b);
        document.getElementById("sidebar").classList.remove("open");
      }
    });
    const bind = (id, event, fn) =>
      document.getElementById(id).addEventListener(event, fn);
    bind("overview", "click", () => app.overview());
    bind("focus-button", "click", () => {
      if (app.selected && !app.selected.destroyed)
        app.camera.focus(app.selected);
    });
    bind("play", "click", () => this.togglePause());
    bind("reset", "click", () => app.reset());
    bind("time-speed", "input", (e) => {
      app.clock.speed = SPEEDS[+e.target.value];
      app.clock.paused = app.clock.speed === 0;
      document.getElementById("time-value").textContent =
        SPEED_LABELS[+e.target.value];
      this.syncPlay();
    });
    bind("orbit-toggle", "click", (e) => {
      app.showOrbits = !app.showOrbits;
      this.toggle(e.currentTarget, app.showOrbits);
    });
    bind("label-toggle", "click", (e) => {
      app.showLabels = !app.showLabels;
      this.toggle(e.currentTarget, app.showLabels);
    });
    bind("free-flight", "click", () => {
      app.camera.setFree(!app.camera.free);
      this.toggle(document.getElementById("free-flight"), app.camera.free);
      app.log.add(
        app.camera.free
          ? "Voo livre: WASD para mover, Q/E para subir e descer. Arraste para olhar."
          : "Câmera orbital ativada.",
      );
    });
    bind("help-button", "click", () =>
      document.getElementById("help-dialog").showModal(),
    );
    bind("close-help", "click", () =>
      document.getElementById("help-dialog").close(),
    );
    bind("fullscreen-button", "click", async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        app.log.add("Tela cheia indisponível neste navegador.");
      }
    });
    bind("capture", "click", () => {
      app.scene.render();
      const a = document.createElement("a");
      a.download = "solaris-universo.png";
      a.href = app.scene.renderer.domElement.toDataURL("image/png");
      a.click();
      app.log.add("Imagem do universo salva.");
    });
    bind("explore-tab", "click", () => this.mode(false));
    bind("lab-tab", "click", () => this.mode(true));
    bind("mobile-planets", "click", () =>
      document.getElementById("sidebar").classList.toggle("open"),
    );
    bind("close-sidebar", "click", () =>
      document.getElementById("sidebar").classList.remove("open"),
    );
    document
      .querySelectorAll("[data-scale]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          app.setScale(button.dataset.scale === "real"),
        ),
      );
    document.querySelectorAll("[data-panel]").forEach((button) =>
      button.addEventListener("click", () => {
        document
          .querySelectorAll("[data-panel]")
          .forEach((b) => b.classList.toggle("active", b === button));
        document
          .querySelectorAll(".lab-content")
          .forEach(
            (panel) =>
              (panel.hidden = panel.id !== `panel-${button.dataset.panel}`),
          );
      }),
    );
    document
      .querySelectorAll("[data-spawn]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          app.setTool(button.dataset.spawn),
        ),
      );
    bind("cancel-tool", "click", () => app.setTool(null));
    document
      .querySelectorAll("[data-preset]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          app.preset(button.dataset.preset),
        ),
      );
    bind("quality", "change", (e) => {
      app.scene.setQuality(e.target.value);
      app.belt.mesh.count = { low: 600, medium: 1600, ultra: 3200 }[
        e.target.value
      ];
    });
    bind(
      "asteroids-toggle",
      "change",
      (e) => (app.showBelt = e.target.checked),
    );
    bind(
      "bloom-toggle",
      "change",
      (e) => (app.scene.post.bloom.enabled = e.target.checked),
    );
    bind("exposure", "input", (e) => {
      app.scene.renderer.toneMappingExposure = +e.target.value;
      document.getElementById("exposure-value").value = e.target.value;
    });
    bind("mutual-gravity", "change", (e) =>
      app.enablePhysics(e.target.checked),
    );
    bind(
      "collisions",
      "change",
      (e) => (app.collisionsEnabled = e.target.checked),
    );
    bind("gravity", "input", (e) => {
      app.gravity.global = +e.target.value;
      document.getElementById("gravity-value").value = `${e.target.value}×`;
      app.enablePhysics(true);
    });
    bind("sun-mass", "input", (e) => {
      app.sun.mu = 120 * +e.target.value;
      app.sun.mass = BODY_DATA[0].massKg * +e.target.value;
      document.getElementById("sun-mass-value").value = `${e.target.value} M☉`;
      app.enablePhysics(true);
      if (app.selected === app.sun) app.hud.show(app.sun, 0);
    });
    bind("stop-rotation", "click", () => {
      if (app.selected) {
        app.selected.rotationMultiplier = app.selected.rotationMultiplier
          ? 0
          : 1;
        app.log.add(
          `${app.selected.data.name}: rotação ${app.selected.rotationMultiplier ? "retomada" : "pausada"}.`,
        );
      }
    });
    bind("reverse-rotation", "click", () => {
      if (app.selected) {
        app.selected.rotationMultiplier = -(
          app.selected.rotationMultiplier || 1
        );
        app.log.add(`Rotação de ${app.selected.data.name} invertida.`);
      }
    });
    bind("reverse-orbit", "click", () => {
      const b = app.selected;
      if (b && b !== app.sun) {
        if (b.free) b.velocity.negate();
        else b.orbitDirection *= -1;
        app.log.add(`Órbita de ${b.data.name} invertida.`);
      }
    });
    bind("throw-planet", "click", () => app.setTool("throw"));
    this.input = new InputManager(app, this);
  }
  toggle(el, on) {
    el.classList.toggle("selected", on);
    el.setAttribute("aria-pressed", String(on));
  }
  togglePause() {
    this.app.clock.paused = !this.app.clock.paused;
    if (!this.app.clock.paused && this.app.clock.speed === 0) {
      this.app.clock.speed = 10;
      document.getElementById("time-speed").value = 3;
      document.getElementById("time-value").textContent = "10 dias/s";
    }
    this.syncPlay();
  }
  syncPlay() {
    const button = document.getElementById("play");
    button.innerHTML = icon(this.app.clock.paused ? "play" : "pause");
    button.setAttribute(
      "aria-label",
      this.app.clock.paused ? "Continuar simulação" : "Pausar simulação",
    );
    button.title = this.app.clock.paused
      ? "Continuar (Espaço)"
      : "Pausar (Espaço)";
  }
  mode(lab) {
    document.getElementById("lab-panel").hidden = !lab;
    document.getElementById("inspector").hidden = lab;
    document.getElementById("lab-tab").classList.toggle("active", lab);
    document.getElementById("explore-tab").classList.toggle("active", !lab);
    if (!lab) this.app.setTool(null);
  }
  selected(body) {
    document.querySelectorAll("[data-body]").forEach((el) => {
      const active = el.dataset.body === body.id;
      el.classList.toggle("active", active);
      el.setAttribute("aria-pressed", String(active));
    });
    document.getElementById("view-caption").textContent =
      body.data.name.toUpperCase();
  }
  update() {
    document.getElementById("sim-date").textContent = this.app.clock
      .date()
      .toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
      .replaceAll(" de ", " ")
      .replace(".", "")
      .toUpperCase();
  }
}
