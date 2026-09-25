import * as THREE from "three";
import { PostProcessing } from "../effects/PostProcessing.js";
export class SceneManager {
  constructor(container) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#05080e");
    this.camera = new THREE.PerspectiveCamera(
      45,
      innerWidth / innerHeight,
      0.01,
      20000,
    );
    this.camera.position.set(85, 95, 160);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.append(this.renderer.domElement);
    this.post = new PostProcessing(this.renderer, this.scene, this.camera);
    this.scene.add(new THREE.AmbientLight(0x8090ad, 0.13));
    this.addStars();
    window.addEventListener("resize", () => this.resize());
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      document.getElementById("loading").classList.remove("done");
      document.getElementById("loading-text").textContent =
        "A conexão com a GPU foi interrompida. Recarregue a página para continuar.";
    });
  }
  addStars() {
    const positions = [],
      colors = [];
    let seed = 1942;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 6500; i++) {
      const y = random() * 2 - 1,
        a = random() * Math.PI * 2,
        r = 3500 + random() * 3000;
      positions.push(
        Math.sqrt(1 - y * y) * Math.cos(a) * r,
        y * r,
        Math.sqrt(1 - y * y) * Math.sin(a) * r,
      );
      const k = 0.15 + random() ** 4 * 0.85;
      colors.push(k * (0.75 + random() * 0.25), k * (0.8 + random() * 0.2), k);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 1.25,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    this.scene.add(this.stars);
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.post.resize(innerWidth, innerHeight);
  }
  setQuality(value) {
    const ratio = { low: 1, medium: 1.5, ultra: 2 }[value];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, ratio));
    this.post.composer.setPixelRatio(Math.min(devicePixelRatio, ratio));
    this.renderer.shadowMap.enabled = value !== "low";
    this.resize();
  }
  render() {
    this.stars.position.copy(this.camera.position);
    this.post.render();
  }
}
