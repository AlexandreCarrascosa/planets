import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
export class CameraController {
  constructor(camera, canvas) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 0.004;
    this.controls.maxDistance = 3000;
    this.controls.enablePan = true;
    this.controls.zoomSpeed = 0.8;
    this.tracking = null;
    this.lastTarget = new THREE.Vector3();
    this.transition = null;
    this.free = false;
    this.keys = new Set();
    this.lookDrag = null;
    window.addEventListener("keydown", (e) => {
      if (!["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName))
        this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
    canvas.addEventListener("pointerdown", (e) => {
      if (this.free) {
        this.lookDrag = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener("pointerup", () => (this.lookDrag = null));
    canvas.addEventListener("pointermove", (e) => {
      if (this.free && this.lookDrag) {
        const yaw = (e.clientX - this.lookDrag.x) * 0.003,
          pitch = (e.clientY - this.lookDrag.y) * 0.003;
        const q = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
        q.y -= yaw;
        q.x = THREE.MathUtils.clamp(q.x - pitch, -1.5, 1.5);
        camera.quaternion.setFromEuler(q);
        this.lookDrag = { x: e.clientX, y: e.clientY };
      }
    });
    this.controls.addEventListener("start", () => (this.transition = null));
  }
  focus(body, close = true) {
    this.setFree(false);
    this.tracking = body;
    this.lastTarget.copy(body.position);
    const r = Math.max(body.radius, 0.0005);
    const factor = body.isBlackHole ? 26 : body.data.hasRings ? 10 : 7;
    const d = close ? r * factor : 40;
    const direction = body.data.hasRings
      ? new THREE.Vector3(0.45, 0.85, 1).normalize()
      : new THREE.Vector3()
          .copy(body.position)
          .normalize()
          .multiplyScalar(-0.7)
          .add(new THREE.Vector3(0.2, 0.35, 0.8))
          .normalize();
    this.transition = {
      from: this.camera.position.clone(),
      targetFrom: this.controls.target.clone(),
      offset: direction.multiplyScalar(d),
      elapsed: 0,
      duration: 1.5,
    };
    this.controls.minDistance = r * 1.5;
    this.camera.near = Math.max(0.00001, r * 0.01);
    this.camera.updateProjectionMatrix();
  }
  overview(real = false) {
    this.setFree(false);
    this.tracking = null;
    this.controls.minDistance = 0.05;
    this.camera.near = 0.01;
    this.camera.updateProjectionMatrix();
    this.transition = {
      from: this.camera.position.clone(),
      targetFrom: this.controls.target.clone(),
      offset: real
        ? new THREE.Vector3(620, 800, 1380)
        : new THREE.Vector3(85, 95, 160),
      elapsed: 0,
      duration: 1.4,
    };
  }
  setFree(on) {
    if (this.free === on) return;
    this.free = on;
    this.controls.enabled = !on;
    if (on) {
      this.transition = null;
      this.tracking = null;
    } else {
      const dir = this.camera.getWorldDirection(new THREE.Vector3());
      this.controls.target.copy(this.camera.position).addScaledVector(dir, 20);
    }
  }
  update(dt) {
    if (this.free) {
      const move = new THREE.Vector3(
        (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0),
        (this.keys.has("KeyE") ? 1 : 0) - (this.keys.has("KeyQ") ? 1 : 0),
        (this.keys.has("KeyS") ? 1 : 0) - (this.keys.has("KeyW") ? 1 : 0),
      );
      move
        .applyQuaternion(this.camera.quaternion)
        .multiplyScalar(dt * (this.keys.has("ShiftLeft") ? 75 : 20));
      this.camera.position.add(move);
      return;
    }
    if (this.tracking?.destroyed) {
      this.tracking = null;
      this.transition = null;
    }
    const target = this.tracking ? this.tracking.position : new THREE.Vector3();
    if (this.transition) {
      const t = this.transition;
      t.elapsed += dt;
      const a = Math.min(1, t.elapsed / t.duration),
        ease = 1 - (1 - a) ** 3;
      this.camera.position.lerpVectors(
        t.from,
        target.clone().add(t.offset),
        ease,
      );
      this.controls.target.lerpVectors(t.targetFrom, target, ease);
      if (a === 1) this.transition = null;
    } else if (this.tracking) {
      const delta = target.clone().sub(this.lastTarget);
      this.camera.position.add(delta);
      this.controls.target.add(delta);
    }
    if (this.tracking) this.lastTarget.copy(target);
    this.controls.update();
  }
}
