export class SimulationClock {
  constructor() {
    this.days = 0;
    this.speed = 10;
    this.paused = false;
    this.epoch = Date.UTC(2026, 0, 1);
  }
  update(dt) {
    const delta = this.paused ? 0 : dt * this.speed;
    this.days += delta;
    return delta;
  }
  reset() {
    this.days = 0;
    this.speed = 10;
    this.paused = false;
  }
  date() {
    return new Date(this.epoch + this.days * 86400000);
  }
}
