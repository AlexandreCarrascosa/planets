import * as THREE from "three";
import { ENVIRONMENTS } from "../data/environmentData.js";
import { ThermalModel } from "../physics/ThermalModel.js";
import { WeatherModel } from "../physics/WeatherModel.js";
import { AU } from "../data/planetData.js";

const noiseGLSL = `
float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float detail(vec3 p){return .57*noise3(p)+.28*noise3(p*2.03)+.15*noise3(p*4.01);}
`;
export class PlanetEnvironment {
  constructor(planet, assets) {
    this.planet = planet;
    this.profile = ENVIRONMENTS[planet.id];
    this.thermal = new ThermalModel(this.profile, planet.data.distanceFromSunKm / AU);
    this.time = 0;
    this.uniforms = {
      envTime: { value: 0 }, ice: { value: 0 }, molten: { value: 0 },
      gas: { value: ["bands", "methane", "acid"].includes(this.profile.kind) ? 1 : 0 },
      sunWorld: { value: new THREE.Vector3(1, 0, 0) },
      wind: { value: this.profile.wind || 0 },
      cloudMap: { value: null },
      cloudDetail: { value: assets.get("earth_clouds") },
      heatPoint: { value: new THREE.Vector3(0, 1, 0) },
      heat: { value: 0 },
      solarIllumination: { value: 1 },
    };
    if (planet.id === "earth") {
      this.weather = new WeatherModel(this.profile);
      this.cloudData = new Uint8Array(this.weather.width * this.weather.height * 4);
      this.cloudTexture = new THREE.DataTexture(this.cloudData, this.weather.width, this.weather.height);
      this.cloudTexture.wrapS = THREE.RepeatWrapping;
      this.cloudTexture.magFilter = this.cloudTexture.minFilter = THREE.LinearFilter;
      this.uniforms.cloudMap.value = this.cloudTexture;
      this.uploadWeather();
    }
    this.setupSurface(planet.material, assets);
    if (this.profile.atmosphere) this.setupAtmosphere();
    if (this.weather) this.setupClouds();
  }
  setupSurface(material, assets) {
    const isEarth = this.planet.id === "earth";
    if (isEarth) {
      material.emissiveMap = assets.get("earth_nightmap");
      material.emissive.set("#ffe1a1"); material.emissiveIntensity = 0.6;
    }
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = `varying vec3 envNormal; varying vec3 envWorld; varying vec2 envUv;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
        `#include <begin_vertex>\nenvNormal=normalize(position); envUv=uv; envWorld=(modelMatrix*vec4(position,1.)).xyz;`);
      shader.fragmentShader = `uniform float envTime,ice,molten,gas,wind,heat,solarIllumination;
        uniform vec3 sunWorld,heatPoint; uniform sampler2D cloudMap,cloudDetail;
        varying vec3 envNormal; varying vec3 envWorld; varying vec2 envUv;\n` + noiseGLSL + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
        #ifdef USE_MAP
        vec2 flowUv=vMapUv;
        if(gas>.5){float lat=asin(clamp(envNormal.y,-1.,1.));
          flowUv.x+=envTime*wind*(.3+sin(lat*14.))*.015;
          flowUv.y+=.006*sin(flowUv.x*40.+lat*9.+envTime*.1);}
        vec4 sampledDiffuseColor=texture2D(map,flowUv); diffuseColor*=sampledDiffuseColor;
        #endif
        float frozen=smoothstep(.1,.8,ice-(1.-abs(envNormal.y))*.45);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.85,.91),frozen*.9);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.09,.035,.02)*(.7+.6*detail(envNormal*24.)),clamp(molten*2.,0.,1.));
        ${isEarth ? `vec2 shadowUv=envUv;
        shadowUv.x+=envTime*.0015*cos(asin(clamp(envNormal.y,-1.,1.))*4.);
        shadowUv.y+=.015*sin(shadowUv.x*20.+envNormal.y*5.+envTime*.04);
        float cover=texture2D(cloudMap,vec2(envUv.x,.5+.5*envNormal.y)).r
          *(.25+1.4*texture2D(cloudDetail,vec2(fract(shadowUv.x),shadowUv.y)).r);
        diffuseColor.rgb*=1.-smoothstep(.3,.78,cover)*.24;` : ""}
      `);
      shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `
        #include <roughnessmap_fragment>
        ${isEarth ? `float ocean=smoothstep(.01,.12,diffuseColor.b-diffuseColor.r);
        roughnessFactor=mix(.88,.22,ocean*(1.-ice)*(1.-molten));` : ""}
      `);
      shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `
        #include <emissivemap_fragment>
        ${isEarth ? `float daylight=mix(-1.,dot(normal,normalize(mat3(viewMatrix)*sunWorld)),solarIllumination);
        float cloudOcclusion=texture2D(cloudMap,vec2(envUv.x,.5+.5*envNormal.y)).r;
        totalEmissiveRadiance*= (1.-smoothstep(-.18,.05,daylight))*(1.-cloudOcclusion*.9)*(1.-clamp(molten*2.,0.,1.));` : ""}
        float scar=pow(max(0.,dot(normalize(envNormal),heatPoint)),180.)*heat;
        totalEmissiveRadiance+=vec3(2.,.22,.015)*(scar+molten*(.2+.8*detail(envNormal*36.)));
      `);
    };
    material.customProgramCacheKey = () => `planet-environment-${this.planet.id}`;
  }
  setupAtmosphere() {
    const p = this.planet, color = p.data.atmosphereColor || "#8da9d1";
    p.atmosphere = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.015, 64, 32),
      new THREE.ShaderMaterial({
        uniforms: { ...this.uniforms, tint: { value: new THREE.Color(color) }, strength: { value: this.profile.atmosphere } },
        vertexShader: `varying vec3 wN,wP;void main(){wP=(modelMatrix*vec4(position,1.)).xyz;wN=normalize((vec4(normalMatrix*normal,0.)*viewMatrix).xyz);gl_Position=projectionMatrix*viewMatrix*vec4(wP,1.);}`,
        fragmentShader: `uniform vec3 tint,sunWorld;uniform float strength,molten,solarIllumination;varying vec3 wN,wP;
        void main(){vec3 n=normalize(wN),v=normalize(cameraPosition-wP);float mu=abs(dot(n,v));
        float optical=1.-exp(-.11/max(.06,mu)); float day=smoothstep(-.16,.3,dot(n,sunWorld));
        float dusk=exp(-pow(dot(n,sunWorld)*5.,2.));vec3 c=mix(tint,vec3(.95,.26,.08),max(dusk*.48,molten*.8));
        gl_FragColor=vec4(c*(.15+day*.85),optical*strength*(.08+day*.92)*solarIllumination);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
    p.tilt.add(p.atmosphere);
  }
  setupClouds() {
    const p = this.planet;
    p.clouds = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.0018, 96, 48),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: `varying vec2 uvC;varying vec3 nC,wC,worldN;void main(){uvC=uv;nC=normal;worldN=normalize((vec4(normalMatrix*normal,0.)*viewMatrix).xyz);wC=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(wC,1.);}`,
        fragmentShader: `uniform sampler2D cloudMap,cloudDetail;uniform float envTime,molten,solarIllumination;uniform vec3 sunWorld;
        varying vec2 uvC;varying vec3 nC,wC,worldN;` + noiseGLSL + `
        void main(){vec3 n=normalize(nC);vec2 uv=vec2(uvC.x,.5+.5*n.y);
        vec2 flow=uvC;flow.x+=envTime*.0015*cos(asin(clamp(n.y,-1.,1.))*4.);
        flow.y+=.015*sin(flow.x*20.+n.y*5.+envTime*.04);
        float observed=texture2D(cloudDetail,vec2(fract(flow.x),flow.y)).r;
        float density=texture2D(cloudMap,uv).r*(.25+1.4*observed);
        float d=detail(n*42.+vec3(envTime*.07,0.,0.));
        float alpha=smoothstep(.3,.78,density+(.18*d-.09));
        float light=max(0.,dot(normalize(worldN),sunWorld))*solarIllumination;
        vec3 col=mix(vec3(.045,.065,.11),vec3(1.05,1.04,1.),pow(light,.55));
        gl_FragColor=vec4(col,alpha*.92*exp(-molten*8.));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
        transparent: true, depthWrite: false,
      }));
    // Clouds use the same rotating body coordinates as the terrain, plus wind.
    p.tilt.add(p.clouds);
  }
  uploadWeather() {
    for (let i = 0; i < this.weather.cloud.length; i++) {
      const k = i * 4, c = Math.min(255, this.weather.cloud[i] * 400);
      this.cloudData[k] = c; this.cloudData[k + 1] = c; this.cloudData[k + 2] = c; this.cloudData[k + 3] = 255;
    }
    this.cloudTexture.needsUpdate = true;
  }
  impact(worldPoint, intensity) {
    this.planet.root.updateMatrixWorld(true);
    this.uniforms.heatPoint.value.copy(this.planet.surface.worldToLocal(worldPoint.clone())).normalize();
    this.uniforms.heat.value = Math.max(this.uniforms.heat.value, intensity);
    this.thermal.impactHeat += intensity * 80;
  }
  update(days, distanceAU, luminosity, sunPosition) {
    this.uniforms.solarIllumination.value=luminosity>0?1:0;
    this.time += days;
    this.uniforms.envTime.value = this.time % 4096;
    this.uniforms.sunWorld.value.copy(sunPosition).sub(this.planet.position).normalize();
    this.thermal.update(days, distanceAU, luminosity);
    this.uniforms.ice.value = this.thermal.ice;
    this.uniforms.molten.value = this.thermal.molten;
    this.uniforms.heat.value *= Math.exp(-Math.abs(days) / 8);
    if (this.weather?.update(days, this.thermal.surfaceTemperature)) this.uploadWeather();
    if (this.planet.clouds) this.planet.clouds.rotation.copy(this.planet.surface.rotation);
  }
  dispose() { this.cloudTexture?.dispose(); }
}
