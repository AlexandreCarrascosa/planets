import * as THREE from "three";
import { PhysicalOrbits, keplerState, apsidalAdvance, MU_SUN } from "./PhysicalOrbits.js";
import { solarEvolution, adiabaticOrbit } from "./StellarEvolution.js";
import { SOLAR_MASS, schwarzschildRadius } from "./PhysicalUnits.js";
import { SUN, AU } from "../data/planetData.js";
import { orbitalPosition } from "./OrbitalMechanics.js";
import { TrailRenderer } from "../effects/TrailRenderer.js";

export class ScientificScenarios {
  constructor(app, mode) {
    this.app=app;this.mode=mode;this.progress=0;
    app.sun.evolvingStar=mode==="future-sun";
    if(app.sun.evolvingStar) {
      const step=document.getElementById("step-time");step.textContent="+fase";step.setAttribute("aria-label","Avançar fase solar");step.title="Avançar evolução solar condensada";
    }
    this.planets=app.bodies.filter(b=>b.environment);
    this.planets.forEach(b=>b.orbitDisplayRadius=b.data.distanceFromSunKm/AU*30);
    const sun={body:app.sun,mass:1,position:new THREE.Vector3(),velocity:new THREE.Vector3()};
    const states=[sun,...this.planets.map(body=>({body,mass:body.mass/SOLAR_MASS,...keplerState(body.data)}))];
    if(mode==="binary-physical") {
      const companion=app.spawn("star",new THREE.Vector3(240,0,0),new THREE.Vector3(),true);
      this.companion=companion;
      companion.data={...companion.data,radiusKm:SUN.radiusKm*.65,temperature:4300-273.15,category:"Estrela companheira hipotética",luminositySolar:.13};
      companion.light.decay=2;companion.light.intensity=3.6*900*.13;
      states.push({body:companion,mass:.65,position:new THREE.Vector3(8,0,0),velocity:new THREE.Vector3(0,0,Math.sqrt(MU_SUN*1.65/8))});
    }
    const total=states.reduce((sum,p)=>sum+p.mass,0);
    const center=states.reduce((v,p)=>v.addScaledVector(p.position,p.mass/total),new THREE.Vector3());
    const velocity=states.reduce((v,p)=>v.addScaledVector(p.velocity,p.mass/total),new THREE.Vector3());
    states.forEach(p=>{p.position.sub(center);p.velocity.sub(velocity);p.body.free=true;p.body.scientificOrbit=true;});
    states.forEach(p=>p.body.position.copy(p.position).multiplyScalar(30));
    this.engine=new PhysicalOrbits(states,mode==="relativity");
    this.trails=mode==="future-sun"?[]:states.map(state=>({state,trail:new TrailRenderer(app.scene.scene,state.body.data.color)}));
    this.guideData=new Map(this.planets.map(b=>[b,{...b.data,phase:0}]));
    if(mode==="relativity")this.engine.maxStep=0.005;
    this.energy=this.engine.energy();
    this.status="";
    if(mode==="blackhole-orbits") {
      app.sun.hypotheticalHole=true;
      app.sun.material.color.set("black");app.sun.material.emissive.set("black");
      app.sun.glow.visible=app.sun.corona.visible=false;
      app.sun.data={...app.sun.data,name:"Buraco negro · 1 M☉",category:"Buraco negro hipotético",radiusKm:schwarzschildRadius(SUN.massKg)/1000,temperature:0,description:"Experimento hipotético: mesma massa do Sol; órbitas externas permanecem. O Sol real não evolui para um buraco negro."};
      app.sun.label.textContent=app.sun.data.name;app.luminosity=0;
    }
    app.belt.mesh.visible=false;
    document.getElementById("collisions").checked=false;
    document.getElementById("mutual-gravity").checked=mode!=="future-sun";
    document.getElementById("scale-caption").textContent="DINÂMICA EM UA · RAIOS VISUAIS AMPLIADOS";
    document.getElementById("stellar-controls").hidden=mode!=="future-sun";
  }
  update(days) {
    const app=this.app;
    if(this.mode==="future-sun") this.future(days);
    else {
      this.engine.step(days);
      this.engine.states.forEach(p=>p.body.position.copy(p.position).multiplyScalar(30));
      for(const {state,trail} of this.trails){if(days>0)trail.update(state.body.position);trail.line.visible=app.showOrbits;}
      this.engine.states.filter(p=>p.body.corona).forEach(p=>p.body.corona.scale.setScalar(p.body.radius/p.body.data.visualRadius));
      this.status=this.mode==="blackhole-orbits"
        ? "Buraco negro de 1 M☉: mesma atração externa; sem disco luminoso na ausência de alimentação. Horizonte físico ≈ 2,95 km; símbolo ampliado."
        : this.mode==="relativity"
          ? `Correção Schwarzschild 1PN, sem amplificação. Parcela relativística de Mercúrio: ${(apsidalAdvance(0.387,0.2056)*206264.806*36525/87.969).toFixed(1)} segundos de arco/século.`
          : `Gravidade de todos os corpos · AU, dias e massas solares · desvio relativo da energia: ${Math.abs((this.engine.energy()-this.energy)/this.energy).toExponential(1)}. ${app.realScale?"Raios e distâncias na mesma escala":"Raios desenhados ampliados"}; sem colisões neste modo.`;
      if(this.mode==="binary-physical")this.status="Duas estrelas orbitam o centro de massa comum. As órbitas planetárias respondem à atração de ambas; este sistema hipotético pode ser instável.";
      for(const b of this.planets) {
        b.orbit.visible=false;
        const distance=b.position.distanceTo(app.sun.position)/30;
        let luminosity=app.luminosity;
        for(const p of this.engine.states)if(p.body!==app.sun&&p.body.light)
          luminosity+=(p.body.data.luminositySolar||0)*distance**2/Math.max(1e-12,(b.position.distanceTo(p.body.position)/30)**2);
        b.environment.update(days,distance,luminosity,app.sun.position);
      }
    }
    document.getElementById("science-status").textContent=this.status;
    document.getElementById("simulation-status").textContent=this.mode==="future-sun"?"EVOLUÇÃO SOLAR ILUSTRATIVA":"DINÂMICA EM UNIDADES ASTRONÔMICAS";
  }
  setScale(real) {
    for(const p of this.engine.states) {
      const b=p.body;
      if(b.setScale)b.setScale(real);
      else if(this.mode!=="future-sun") {
        b.radius=real?b.data.radiusKm/AU*30:b.data.visualRadius;
        b.tilt.scale.setScalar(b.radius/b.data.visualRadius);
        if(b.glow)b.glow.scale.setScalar(b.radius*7);
      }
    }
  }
  dispose(){for(const {trail} of this.trails)trail.dispose();}
  future(days) {
    const app=this.app;
    app.sun.position.set(0,0,0);
    this.progress=Math.min(1,this.progress+days/400);
    const s=solarEvolution(this.progress),radius=s.radius*SUN.radiusKm/AU*30;
    let sweptEnvelope=0;
    for(let i=0;i<=120;i++) {
      const history=solarEvolution(this.progress*i/120);
      sweptEnvelope=Math.max(sweptEnvelope,history.radius*SUN.radiusKm/AU*history.mass);
    }
    this.solar=s; app.luminosity=s.luminosity;
    this.orbitalPhaseDays=(this.orbitalPhaseDays||0)+days*s.mass*s.mass;
    document.getElementById("sun-mass-value").value=`${s.mass.toFixed(2)} M☉`;
    document.getElementById("solar-flux-value").value=`${s.luminosity<1?s.luminosity.toPrecision(2):s.luminosity.toFixed(1)}×`;
    app.sun.mass=SUN.massKg*s.mass;app.sun.mu=120*s.mass;
    app.sun.radius=radius;app.sun.tilt.scale.setScalar(radius/SUN.visualRadius);
    app.sun.glow.scale.setScalar(Math.max(.4,radius*7));
    app.sun.corona.scale.setScalar(radius/SUN.visualRadius);
    app.sun.light.shadow.camera.near=Math.max(.0001,radius*1.01);
    app.sun.light.shadow.camera.updateProjectionMatrix();
    const color=new THREE.Color(s.temperature<4500?"#ff8d45":s.temperature>10000?"#c8deff":"#fff1c4");
    app.sun.material.color.copy(color);app.sun.material.emissive.copy(color);app.sun.glow.material.color.copy(color);
    app.sun.data={...app.sun.data,radiusKm:SUN.radiusKm*s.radius,massKg:app.sun.mass,temperature:s.temperature-273.15,
      category:s.radius<.05?"Anã branca":s.radius>5?"Gigante · evolução ilustrativa":"Estrela solar · evolução ilustrativa"};
    for(const b of this.planets) {
      const a=adiabaticOrbit(b.data.distanceFromSunKm/AU,s.mass);
      b.orbitDisplayRadius=a*30;
      const p=orbitalPosition(b.data,this.orbitalPhaseDays,a*30);
      b.position.set(p.x,p.y,p.z);b.orbit.visible=false;
      const distance=b.position.length()/30;
      const engulfed=b.data.distanceFromSunKm/AU*(1-b.data.eccentricity)<sweptEnvelope;
      b.simulationHidden=engulfed;
      const row=document.querySelector(`[data-body="${b.id}"]`);if(row)row.disabled=engulfed;
      b.root.visible=!engulfed;if(b.label)b.label.style.visibility=engulfed?"hidden":"";
      b.orbit.visible=app.showOrbits&&!engulfed;
      if(this.progress!==this.lastGuideProgress) {
        const attr=b.orbit.geometry.attributes.position;
        for(let i=0;i<attr.count;i++) {
          const p=orbitalPosition(this.guideData.get(b),b.data.orbitalPeriodDays*i/(attr.count-1),a*30);
          attr.setXYZ(i,p.x,p.y,p.z);
        }
        attr.needsUpdate=true;
      }
      b.environment.thermal.equilibrate(distance,s.luminosity);
      b.environment.update(days,distance,s.luminosity,app.sun.position);
    }
    this.status=`+${s.age.toFixed(2)} bilhões de anos · ${s.name} · ${s.mass.toFixed(2)} M☉ · ${s.radius<1?s.radius.toPrecision(3):s.radius.toFixed(1)} R☉ · ${Math.round(s.temperature)} K. Órbitas a∝1/M; marés estelares não incluídas. Destino da Terra incerto.`;
    document.getElementById("stellar-age").value=this.progress;
    this.lastGuideProgress=this.progress;
  }
}
