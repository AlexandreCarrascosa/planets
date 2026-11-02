export class Minimap {
  constructor(onSelect) {
    this.canvas = document.getElementById("minimap");
    this.ctx = this.canvas.getContext("2d");
    this.dots = [];
    this.canvas.addEventListener("click", (e) => {
      const r = this.canvas.getBoundingClientRect(),
        x = ((e.clientX - r.left) * 232) / r.width,
        y = ((e.clientY - r.top) * 130) / r.height;
      const nearest = this.dots.reduce(
        (best, d) => {
          const dist = Math.hypot(x - d.x, y - d.y);
          return dist < best.dist ? { body: d.body, dist } : best;
        },
        { dist: 16 },
      );
      if (nearest.body) onSelect(nearest.body);
    });
  }
  draw(bodies, selected, real) {
    const c = this.ctx;
    c.clearRect(0, 0, 232, 130);
    const max = real ? 930 : 122,
      scale = 56 / max;
    const cx = 116,
      cy = 65;
    c.lineWidth = 0.6;
    c.strokeStyle = "#53627628";
    for (const body of bodies) {
      if (body.destroyed || body.simulationHidden) continue;
      if (body.orbitDisplayRadius || body.distance) {
        c.beginPath();
        c.ellipse(
          cx,
          cy,
          (body.orbitDisplayRadius || body.distance) * scale,
          (body.orbitDisplayRadius || body.distance) * scale,
          0,
          0,
          Math.PI * 2,
        );
        c.stroke();
      }
    }
    c.strokeStyle = "#8292a018";
    c.beginPath();
    c.moveTo(cx, 0);
    c.lineTo(cx, 130);
    c.moveTo(0, cy);
    c.lineTo(232, cy);
    c.stroke();
    this.dots = [];
    for (const body of bodies) {
      if (body.destroyed || body.simulationHidden) continue;
      const x = cx + body.position.x * scale,
        y = cy + body.position.z * scale;
      this.dots.push({ x, y, body });
      c.fillStyle = body.data.color;
      c.beginPath();
      c.arc(x, y, body.id === "sun" ? 3 : 2, 0, Math.PI * 2);
      c.fill();
      if (body === selected) {
        c.strokeStyle = "#e8b77d";
        c.beginPath();
        c.arc(x, y, 5, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }
}
