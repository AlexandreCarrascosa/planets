import * as THREE from "three";
export class SelectionSystem {
  constructor(app) {
    this.app = app;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.down = null;
    const canvas = app.scene.renderer.domElement;
    canvas.addEventListener("pointerdown", (e) => {
      this.down = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!this.down || app.tool || app.camera.free || e.button !== 0) return;
      const distance = Math.hypot(
        e.clientX - this.down.x,
        e.clientY - this.down.y,
      );
      if (distance > 5) return;
      const body = this.pick(e);
      if (body) app.select(body);
    });
  }
  ray(e) {
    const r = this.app.scene.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.app.scene.camera);
    return this.raycaster;
  }
  pick(e) {
    const hit = this.ray(e)
      .intersectObjects(
        this.app.bodies.filter((b) => !b.destroyed && b.root.visible).map((b) => b.root),
        true,
      )
      .find((h) => h.object.userData.body);
    return hit?.object.userData.body;
  }
}
