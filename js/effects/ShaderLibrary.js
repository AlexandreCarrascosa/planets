import * as THREE from "three";
export function atmosphereMaterial(color, strength = 0.65) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tint: { value: new THREE.Color(color) },
      strength: { value: strength },
    },
    vertexShader: `varying vec3 vNormal;varying vec3 vView;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vView=-p.xyz;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform vec3 tint;uniform float strength;varying vec3 vNormal;varying vec3 vView;void main(){float f=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),3.8);gl_FragColor=vec4(tint,f*strength);}`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}
export function coronaTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 128);
  g.addColorStop(0, "rgba(255,211,139,0.5)");
  g.addColorStop(0.24, "rgba(255,163,65,0.22)");
  g.addColorStop(0.5, "rgba(240,124,40,0.065)");
  g.addColorStop(1, "rgba(240,124,40,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
export function ringTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 1;
  const ctx = c.getContext("2d");
  for (let x = 0; x < 512; x++) {
    const t = x / 512;
    let a =
      (0.35 + 0.38 * Math.sin(x * 0.39) ** 2) * Math.sin(Math.PI * t) ** 0.35;
    if (t > 0.59 && t < 0.63) a = 0.015;
    if (t > 0.86 && t < 0.88) a = 0.04;
    const v = 130 + Math.floor(65 * Math.sin(x * 0.23) ** 2);
    ctx.fillStyle = `rgba(${v + 25},${v + 15},${v},${a})`;
    ctx.fillRect(x, 0, 1, 1);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
