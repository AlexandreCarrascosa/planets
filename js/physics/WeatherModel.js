import { clamp, seededRandom } from "./PhysicalUnits.js";

// Equal-area rows in sin(latitude), periodic longitude. Conservative upwind
// tracer transport under prescribed zonal winds; not a fluid/GCM solver.
export class WeatherModel {
  constructor(profile, seed = 1942, width = 96, height = 48) {
    this.profile = profile; this.width = width; this.height = height;
    this.time = 0; this.pendingDays = 0; this.revision = 0; this.skippedDays = 0;
    const count = width * height, random = seededRandom(seed);
    this.vapor = new Float64Array(count);
    this.cloud = new Float64Array(count);
    this.surfaceWater = new Float64Array(count).fill(50);
    this.rain = new Float32Array(count);
    this.work = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const latitude = Math.asin(2 * (Math.floor(i / width) + 0.5) / height - 1);
      this.vapor[i] = 0.5 + 0.3 * Math.cos(latitude) + random() * 0.2;
      this.cloud[i] = Math.max(0, random() - 0.35) * (0.5 + 0.5 * Math.cos(latitude * 3));
    }
  }
  totalWater() {
    let sum = 0;
    for (let i = 0; i < this.vapor.length; i++) sum += this.vapor[i] + this.cloud[i] + this.surfaceWater[i];
    return sum;
  }
  transport(field, h) {
    this.work.set(field);
    for (let y = 0; y < this.height; y++) {
      const latitude = Math.asin(2 * (y + 0.5) / this.height - 1);
      const jet = this.profile.kind === "bands" ? Math.sin(latitude * 14) : Math.cos(latitude * 4);
      const wind = this.profile.wind * (0.3 + jet);
      const fraction = Math.min(0.4, Math.abs(wind) * h * this.width / (2 * Math.PI));
      for (let x = 0; x < this.width; x++) {
        const i = y * this.width + x;
        const j = y * this.width + (x + (wind >= 0 ? 1 : -1) + this.width) % this.width;
        const amount = field[i] * fraction;
        this.work[i] -= amount; this.work[j] += amount;
      }
    }
    field.set(this.work);
  }
  update(days, temperature) {
    if (days <= 0) return false;
    this.pendingDays += days;
    // Bound cost at time warp. Only the last 2 days of a jump are integrated;
    // skipped weather time is recorded rather than presented as a forecast.
    if (this.pendingDays > 2) {
      this.skippedDays += this.pendingDays - 2;
      this.time += this.pendingDays - 2;
      this.pendingDays = 2;
    }
    const h = 0.125;
    const n = Math.floor((this.pendingDays + 1e-10) / h);
    if (!n) return false;
    this.pendingDays = Math.max(0, this.pendingDays - n * h);
    for (let step = 0; step < n; step++) {
      this.time += h;
      this.transport(this.vapor, h); this.transport(this.cloud, h);
      for (let y = 0; y < this.height; y++) {
        const lat = Math.asin(2 * (y + 0.5) / this.height - 1);
        for (let x = 0; x < this.width; x++) {
          const i = y * this.width + x;
          const wave = Math.sin(x * 2 * Math.PI / this.width * 5 + lat * 9 - this.time * 0.18);
          const localT = temperature + 18 * Math.cos(lat) - 12 + wave * 3;
          const saturation = clamp(Math.exp((localT - this.profile.baselineK) * 0.055), 0.05, 5);
          const evap = Math.min(this.surfaceWater[i], Math.max(0, saturation - this.vapor[i]) * h * 0.09);
          this.surfaceWater[i] -= evap; this.vapor[i] += evap;
          const rising = 0.12 * Math.cos(lat * 6) + wave * 0.12;
          const condense = Math.max(0, this.vapor[i] - saturation * (0.75 - rising)) * (1 - Math.exp(-h * 0.8));
          this.vapor[i] -= condense; this.cloud[i] += condense;
          const dry = Math.min(this.cloud[i], Math.max(0, saturation * 0.6 - this.vapor[i]) * h * 0.2);
          this.cloud[i] -= dry; this.vapor[i] += dry;
          const rain = Math.max(0, this.cloud[i] - 0.24) * (1 - Math.exp(-h * 0.4));
          this.cloud[i] -= rain; this.surfaceWater[i] += rain;
          this.rain[i] = rain / h;
        }
      }
    }
    this.revision++;
    return true;
  }
  coverage() {
    return this.cloud.reduce((sum, v) => sum + Math.min(1, v * 1.5), 0) / this.cloud.length;
  }
}
