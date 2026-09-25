import * as THREE from "three";
export class DragAndLaunch {
  constructor(app) {
    this.app = app;
    this.start = null;
    this.body = null;
    this.wasPaused = false;
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.arrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(),
      1,
      0xe8b77d,
      1,
      0.5,
    );
    this.arrow.visible = false;
    app.scene.scene.add(this.arrow);
    const canvas = app.scene.renderer.domElement;
    canvas.addEventListener("pointerdown", (e) => this.down(e));
    canvas.addEventListener("pointermove", (e) => this.move(e));
    canvas.addEventListener("pointerup", (e) => this.up(e));
    canvas.addEventListener("pointercancel", () => this.cancel());
  }
  point(e) {
    return this.app.selection
      .ray(e)
      .ray.intersectPlane(this.plane, new THREE.Vector3());
  }
  down(e) {
    if (!this.app.tool || e.button !== 0) return;
    const app = this.app;
    this.plane.constant = -(app.selected?.position.y || 0);
    let point = this.point(e);
    if (!point || point.length() > 2000) {
      app.log.add("Aponte para mais perto do plano orbital.");
      return;
    }
    if (app.tool === "throw") {
      this.body = app.selection.pick(e);
      if (!this.body || this.body === app.sun) {
        app.log.add("Clique e arraste um planeta para definir o lançamento.");
        this.body = null;
        return;
      }
      this.originalPosition = this.body.position.clone();
      this.body.dragging = true;
      point = this.body.position.clone();
    }
    this.wasPaused = app.clock.paused;
    app.clock.paused = true;
    app.ui.syncPlay();
    this.start = point;
    this.arrow.position.copy(point);
    this.arrow.visible = true;
    app.scene.renderer.domElement.setPointerCapture(e.pointerId);
  }
  move(e) {
    if (!this.start) return;
    const p = this.point(e);
    if (!p) return;
    const delta = p.clone().sub(this.start);
    this.arrow.setDirection(
      delta.length() > 0
        ? delta.clone().normalize()
        : new THREE.Vector3(1, 0, 0),
    );
    this.arrow.setLength(
      Math.max(0.1, delta.length()),
      Math.min(2, delta.length() * 0.2),
      0.5,
    );
    if (this.body) this.body.position.copy(p);
  }
  up(e) {
    if (!this.start) return;
    const app = this.app,
      end = this.point(e) || this.start;
    const velocity = end.clone().sub(this.start).multiplyScalar(0.6);
    if (velocity.length() > 35) velocity.setLength(35);
    if (this.body) {
      app.gravity.release(this.body, app.sun);
      this.body.velocity.copy(velocity);
      this.body.dragging = false;
      app.log.add(`${this.body.data.name} saiu de sua órbita.`);
    } else app.spawn(app.tool, this.start, velocity);
    this.start = null;
    this.body = null;
    this.arrow.visible = false;
    app.clock.paused = this.wasPaused;
    app.ui.syncPlay();
    app.setTool(null);
  }
  cancel() {
    if (this.body) {
      this.body.position.copy(this.originalPosition);
      this.body.dragging = false;
    }
    if (this.start) {
      this.app.clock.paused = this.wasPaused;
      this.app.ui.syncPlay();
    }
    this.start = null;
    this.body = null;
    this.arrow.visible = false;
  }
}
