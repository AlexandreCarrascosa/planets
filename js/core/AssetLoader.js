import * as THREE from "three";
import { assetUrl } from "./assetUrl.js";
export class AssetLoader {
  constructor() {
    this.textures = new Map();
    this.failures = [];
  }
  async load(names, onProgress) {
    const loader = new THREE.TextureLoader();
    let done = 0;
    await Promise.all(
      names.map(async (name) => {
        try {
          const tex = await loader.loadAsync(assetUrl(`assets/textures/${name}.jpg`));
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          this.textures.set(name, tex);
        } catch {
          this.failures.push(name);
        }
        onProgress(++done / names.length, name);
      }),
    );
  }
  get(name) {
    return this.textures.get(name) || null;
  }
}
