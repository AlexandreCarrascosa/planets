export class EventLog {
  constructor() {
    this.root = document.getElementById("events");
    this.timers = new Set();
  }
  add(message) {
    const item = document.createElement("div");
    item.className = "event";
    item.textContent = message;
    this.root.append(item);
    while (this.root.children.length > 3) this.root.firstChild.remove();
    const timer = setTimeout(() => {
      item.remove();
      this.timers.delete(timer);
    }, 6000);
    this.timers.add(timer);
  }
  clear() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.root.replaceChildren();
  }
}
