export class SimulationClock {
  constructor() {
    this.days = 0;
    this.pendingDays = 0;
    this.speed = 10;
    this.paused = false;
    this.epoch = Date.UTC(2026, 0, 1);
  }
  update(dt) {
    const delta = this.pendingDays || (this.paused ? 0 : dt * this.speed);
    this.pendingDays = 0;
    this.days += delta;
    return delta;
  }
  reset() {
    this.days = 0;
    this.pendingDays = 0;
    this.speed = 10;
    this.paused = false;
  }
  advance(days = 1) {
    if (!Number.isFinite(days) || days <= 0) return;
    this.paused = true;
    this.pendingDays += days;
  }
  date() {
    return new Date(this.epoch + this.days * 86400000);
  }
}
