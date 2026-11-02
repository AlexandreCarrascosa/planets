import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
export class PostProcessing {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);
    for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      target.depthTexture = new THREE.DepthTexture(target.width, target.height, THREE.UnsignedIntType);
      target.depthBuffer = true;
    }
    this.composer.addPass(new RenderPass(scene, camera));
    this.lens = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        center: { value: new THREE.Vector2(0.5, 0.5) },
        radius: { value: 0 },
        aspect: { value: 1 },
        tDepth: { value: null },
        holeViewDepth: { value: 1 },
        holeRadius: { value: 1 },
        cameraNear: { value: camera.near },
        cameraFar: { value: camera.far },
      },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform sampler2D tDiffuse,tDepth;uniform vec2 center;
      uniform float radius,aspect,holeViewDepth,holeRadius,cameraNear,cameraFar;varying vec2 vUv;
      void main(){vec4 original=texture2D(tDiffuse,vUv);
        if(radius<.0001){gl_FragColor=original;return;}
        float depth=texture2D(tDepth,vUv).r;
        float viewDepth=cameraNear*cameraFar/(cameraFar-depth*(cameraFar-cameraNear));
        if(viewDepth<holeViewDepth-holeRadius){gl_FragColor=original;return;}
        vec2 d=vUv-center;d.x*=aspect;float r=length(d);
        float bend=min(.12,radius*radius/(r*r+.00001)*.025);
        vec2 uv=vUv+(vUv-center)*bend*(1.-smoothstep(radius,radius*3.5,r));
        vec4 col=texture2D(tDiffuse,clamp(uv,0.,1.));
        float horizon=smoothstep(radius*.96,radius*1.02,r);
        gl_FragColor=vec4(col.rgb*horizon,col.a);
      }`,
    });
    const renderLens = this.lens.render.bind(this.lens);
    this.lens.render = (renderer, writeBuffer, readBuffer, ...args) => {
      this.lens.uniforms.tDepth.value = readBuffer.depthTexture;
      renderLens(renderer, writeBuffer, readBuffer, ...args);
    };
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
