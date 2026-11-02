import { AU } from "../data/planetData.js";
import { assetUrl } from "../core/assetUrl.js";
const number = (n, d = 0) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: d });
export class InfoHUD {
  constructor() {
    this.root = document.getElementById("body-info");
  }
  show(body, index) {
    this.shownMass = body.mass;
    this.shownIndex = index;
    const d = body.data;
    this.root.innerHTML = `<div class="planet-preview"><img alt="Textura de ${d.name}" src="${assetUrl(`assets/textures/${d.texture || "moon"}.jpg`)}"><span class="preview-shade"></span></div><h2>${d.name}<span class="body-index">${String(index).padStart(2, "0")}</span></h2><div class="body-type">${(d.category || d.type).toUpperCase()}</div><p class="body-description">${d.description || "Um novo corpo que você adicionou ao seu universo."}</p><div class="stat-grid">${this.stat("RAIO MÉDIO", number(d.radiusKm), "km")}${this.stat("TEMPERATURA", number(d.temperature), "°C")}${this.stat("DISTÂNCIA DO SOL", number(d.distanceFromSunKm / AU, 2), "UA")}${this.stat("PERÍODO ORBITAL", d.orbitalPeriodDays ? number(d.orbitalPeriodDays, 1) : "—", d.orbitalPeriodDays ? "dias" : "")}${this.stat("MASSA", (body.mass / 10 ** Math.floor(Math.log10(body.mass))).toFixed(2).replace(".", ",") + " × 10<sup>" + Math.floor(Math.log10(body.mass)) + "</sup>", "kg")}${this.stat("ROTAÇÃO", number(d.rotationPeriodHours, 1), "h")}</div>`;
  }
  stat(label, value, unit) {
    return `<div><span class="stat-label">${label}</span><span class="stat-value">${value}<small>${unit}</small></span></div>`;
  }
  update(body) {
    if (!body || body.destroyed) return;
    if (body.mass !== this.shownMass) this.show(body, this.shownIndex);
    if(body.hypotheticalHole){this.root.querySelector(".planet-preview img").hidden=true;this.root.querySelector(".planet-preview").style.background="radial-gradient(circle,#000 40%,#141a22 44%,#05080e 66%)";}
    if(body.evolvingStar||body.hypotheticalHole)for(const row of this.root.querySelectorAll(".stat-grid > div")) {
      const label=row.querySelector(".stat-label").textContent;
      if(label==="ROTAÇÃO"||(body.hypotheticalHole&&label==="TEMPERATURA"))row.querySelector(".stat-value").textContent="Não calculada";
    }
    let root = this.root.querySelector(".environment-readout");
    if (!root) {
      root = document.createElement("div"); root.className = "environment-readout";
      this.root.append(root);
    }
    const env = body.environment;
    root.textContent = env
      ? `${env.profile.label}\n${(env.thermal.surfaceTemperature - 273.15).toFixed(0)} °C estimados · ${env.thermal.state}${env.weather ? `\nCobertura de nuvens: ${(env.weather.coverage() * 100).toFixed(0)}% · circulação simplificada` : ""}`
      : body.isBlackHole ? `Schwarzschild sem rotação · horizonte: ${body.data.radiusKm.toFixed(0)} km\nÓrbita circular estável mais interna: ${(3*body.data.radiusKm).toFixed(0)} km · desenho ampliado` : "";
  }
}
