import { AU } from "../data/planetData.js";
import { assetUrl } from "../core/assetUrl.js";
const number = (n, d = 0) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: d });
export class InfoHUD {
  constructor() {
    this.root = document.getElementById("body-info");
  }
  show(body, index) {
    const d = body.data;
    this.root.innerHTML = `<div class="planet-preview"><img alt="Textura de ${d.name}" src="${assetUrl(`assets/textures/${d.texture || "moon"}.jpg`)}"><span class="preview-shade"></span></div><h2>${d.name}<span class="body-index">${String(index).padStart(2, "0")}</span></h2><div class="body-type">${(d.category || d.type).toUpperCase()}</div><p class="body-description">${d.description || "Um novo corpo que você adicionou ao seu universo."}</p><div class="stat-grid">${this.stat("RAIO MÉDIO", number(d.radiusKm), "km")}${this.stat("TEMPERATURA", number(d.temperature), "°C")}${this.stat("DISTÂNCIA DO SOL", number(d.distanceFromSunKm / AU, 2), "UA")}${this.stat("PERÍODO ORBITAL", d.orbitalPeriodDays ? number(d.orbitalPeriodDays, 1) : "—", d.orbitalPeriodDays ? "dias" : "")}${this.stat("MASSA", (body.mass / 10 ** Math.floor(Math.log10(body.mass))).toFixed(2).replace(".", ",") + " × 10<sup>" + Math.floor(Math.log10(body.mass)) + "</sup>", "kg")}${this.stat("ROTAÇÃO", number(d.rotationPeriodHours, 1), "h")}</div>`;
  }
  stat(label, value, unit) {
    return `<div><span class="stat-label">${label}</span><span class="stat-value">${value}<small>${unit}</small></span></div>`;
  }
}
