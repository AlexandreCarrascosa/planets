import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
export class PostProcessing {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.lens = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        center: { value: new THREE.Vector2(0.5, 0.5) },
        radius: { value: 0 },
        aspect: { value: 1 },
      },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform sampler2D tDiffuse;uniform vec2 center;uniform float radius;uniform float aspect;varying vec2 vUv;void main(){vec2 d=vUv-center;d.x*=aspect;float r=length(d);float bend=radius*radius/(r*r+.0002)*.055;vec2 uv=vUv+(vUv-center)*min(bend,.65)*(1.-smoothstep(radius*.6,radius*5.+.00001,r));vec4 col=texture2D(tDiffuse,clamp(uv,0.,1.));float horizon=smoothstep(radius*.35,radius*.47+.00001,r);gl_FragColor=vec4(col.rgb*mix(1.,horizon,step(.0001,radius)),col.a);}`,
    });
    this.composer.addPass(this.lens);
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      0.38,
      0.5,
      1.25,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }
  resize(w, h) {
    this.composer.setSize(w, h);
    this.lens.uniforms.aspect.value = w / h;
  }
  render() {
    this.composer.render();
  }
}
