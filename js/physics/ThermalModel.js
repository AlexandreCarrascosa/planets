import { SIGMA, SOLAR_LUMINOSITY, AU_METERS, DAY, clamp } from "./PhysicalUnits.js";

export function solarFlux(distanceAU, luminosity = 1) {
  return SOLAR_LUMINOSITY * luminosity / (4 * Math.PI * (Math.max(distanceAU, 0.001) * AU_METERS) ** 2);
}
export function equilibriumTemperature(distanceAU, albedo = 0.3, luminosity = 1, emissivity = 1) {
  return ((1 - albedo) * solarFlux(distanceAU, luminosity) / (4 * SIGMA * emissivity)) ** 0.25;
}
export class ThermalModel {
  constructor(profile, distanceAU) {
    this.profile = profile;
    this.referenceAU = distanceAU;
    this.temperature = profile.baselineK;
    this.target = this.temperature;
    this.impactHeat = 0;
    this.bulkHeat = 0;
    this.ice = 0;
    this.molten = 0;
  }
  get surfaceTemperature() { return this.temperature + this.bulkHeat; }
  addMergerHeat({ energyJ, massKg, radiusKm }) {
    if (!(energyJ >= 0 && massKg > 0 && radiusKm > 0)) return;
    const existingEnergy = this.bulkHeat * (this.heatCapacity || 0);
    this.heatCapacity = massKg * 1000; // Approximate rocky bulk heat capacity, J/K.
    this.radiatingArea = 4 * Math.PI * (radiusKm * 1000) ** 2;
    this.bulkHeat = (existingEnergy + energyJ) / this.heatCapacity;
  }
  update(days, distanceAU, luminosity = 1) {
    if (days <= 0) return;
    // Reference-calibrated response to irradiation, including an approximate
    // greenhouse/internal-heat offset. This is not radiative-convective climate.
    const ref = equilibriumTemperature(this.referenceAU, this.profile.albedo);
    const irradiated = equilibriumTemperature(distanceAU, this.profile.albedo, luminosity);
    this.target = Math.max(3, this.profile.baselineK + irradiated - ref);
    this.temperature += (this.target - this.temperature) * -Math.expm1(-days / this.profile.inertiaDays);
    this.impactHeat *= Math.exp(-days / 8);
    if (this.bulkHeat > 0) {
      const oldHeat = this.bulkHeat;
      const coefficient = this.radiatingArea * SIGMA * days * DAY / this.heatCapacity;
      const baseline = this.temperature;
      let low = 0, high = oldHeat;
      // Implicit radiative cooling stays positive even for large clock steps.
      for (let i = 0; i < 40; i++) {
        const heat = (low + high) / 2;
        const balance = heat + coefficient * ((baseline + heat) ** 4 - baseline ** 4);
        if (balance > oldHeat) high = heat; else low = heat;
      }
      this.bulkHeat = (low + high) / 2;
    }
    this.ice = this.profile.kind === "water" ? clamp((278 - this.surfaceTemperature) / 45, 0, 1) : 0;
    this.molten = clamp((this.surfaceTemperature + this.impactHeat - 1200) / 800, 0, 1);
  }
  get state() {
    if (this.molten > 0.1) return "Superfície em fusão";
    if (this.profile.kind === "water") {
      if (this.surfaceTemperature < 260) return "Congelamento generalizado";
      if (this.surfaceTemperature > 373) return "Evaporação intensa · clima extrapolado";
    }
    return this.impactHeat > 30 ? "Resfriamento após impacto" : "Equilíbrio térmico aproximado";
  }
}
