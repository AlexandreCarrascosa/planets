import * as THREE from "three";
import { C, DAY, SOLAR_MASS, schwarzschildRadius, seededRandom, clamp } from "./PhysicalUnits.js";
import { sweptSphereContact } from "./CollisionSystem.js";
import { TrailRenderer } from "../effects/TrailRenderer.js";

const SCENE_PER_RS=2;
export function tidalRadiusInHorizons(massKg,radiusKm,holeMassKg) {
  return radiusKm*1000/schwarzschildRadius(holeMassKg)*Math.cbrt(2*holeMassKg/massKg);
}
export function centralAcceleration(position,massRatio=1) {
  const r=Math.max(position.length(),1e-8);
  return position.clone().multiplyScalar(-.5*massRatio/(r*r*r));
}

// Central test-particle approximation in units Rs and Rs/c. Gravity and tides
// use physical mass/radii; displayed body sizes/near-horizon appearance are
// illustrative. This is not a relativistic geodesic or hydrodynamic solver.
export class MassiveEncounter {
  constructor(app,profile) {
    this.app=app;this.mode="massive-attraction";this.thermalDisabled=true;
    this.initialMass=profile.solarMasses*SOLAR_MASS;
    this.timeUnit=schwarzschildRadius(this.initialMass)/C;
    this.elapsed=0;this.capturedMass=0;this.capturedBodies=0;this.profile=profile;
    const startFactor=clamp(1-(Math.log10(profile.solarMasses)-6)*.15,.4,1);
    this.baseSpeed=30*startFactor**1.5*this.timeUnit/DAY;
    this.maxSpeed=Math.min(100,this.baseSpeed*4);this.stepDays=this.baseSpeed*.5;
    const bodies=app.bodies.filter(b=>!b.isBlackHole&&!b.destroyed);
    this.hole=app.spawn("blackhole",new THREE.Vector3(),new THREE.Vector3(),true,
      {...profile,visualRadius:SCENE_PER_RS,linearHorizon:true});
    // Thin visual locator for an otherwise dark horizon, not emitted light.
    this.horizonMarker=new THREE.Mesh(new THREE.SphereGeometry(SCENE_PER_RS*1.04,48,24),
      new THREE.MeshBasicMaterial({color:"#acbccc",side:THREE.BackSide,transparent:true,opacity:.45}));
    this.hole.tilt.add(this.horizonMarker);
    this.records=bodies.map((body,i)=>{
      const position=new THREE.Vector3(-(42+8*Math.floor(i/3))*startFactor,((i%3)-1)*4*startFactor,((i%3)-1)*19*startFactor);
      const velocity=new THREE.Vector3(0,0,.006*(i%2?1:-1));
      const physicalRadius=body.data.radiusKm*1000/schwarzschildRadius(this.initialMass);
      const record={body,position,velocity,physicalRadius,tidalRadius:tidalRadiusInHorizons(body.mass,body.data.radiusKm,this.initialMass),
        visualRadius:clamp(.45+.3*Math.log10(Math.max(1,body.data.radiusKm/1000)),.45,1.4),
        initialMass:body.mass,damage:0,parts:null,captured:false,trail:new TrailRenderer(app.scene.scene,body.data.color)};
      body.free=true;body.encounterOnly=true;body.scientificOrbit=true;body.distance=0;
      for(const moon of body.moons||[])moon.mesh.visible=false;
      return record;
    });
    this.reference={position:new THREE.Vector3(),radius:2};
    this.update(0);
    this.frame();
    app.select(this.hole,false);
    const step=document.getElementById("step-time");step.textContent="+passo";step.setAttribute("aria-label","Avançar encontro");step.title="Avançar meio segundo do encontro visual";
    document.getElementById("scale-caption").textContent="ENCONTRO EM RAIOS DO HORIZONTE · CORPOS AMPLIADOS";
    document.getElementById("collisions").checked=false;
  }
  get speedLabel(){return `${(this.app.clock.speed/this.baseSpeed).toFixed(1)}× encontro`;}
  frame(){const alive=this.records.filter(r=>!r.captured).sort((a,b)=>b.position.lengthSq()-a.position.lengthSq());if(alive.length)this.app.camera.frameEncounter(alive[0].body,this.hole);else this.app.camera.focus(this.hole);}
  setScale(real){this.real=real;}
  drift(p,h,ratio) {
    const previous=p.position.clone();p.velocity.addScaledVector(centralAcceleration(p.position,ratio),h/2);
    p.position.addScaledVector(p.velocity,h);p.velocity.addScaledVector(centralAcceleration(p.position,ratio),h/2);
    return sweptSphereContact(previous,p.position,new THREE.Vector3(),new THREE.Vector3(),ratio)!==null;
  }
  capture(mass,velocity) {
    this.capturedMass+=mass;this.hole.accrete(mass);
    this.hole.accretion=Math.min(1.5,this.hole.accretion+Math.min(.2,Math.cbrt(mass/this.initialMass)*10));
    // Recoil is neglected in this central-field approximation (M >= 10^6 Msun).
    this.hole.capturedMomentum ||= new THREE.Vector3();
    this.hole.capturedMomentum.addScaledVector(velocity,mass*C);
  }
  disrupt(record) {
    const random=seededRandom(8127+this.records.indexOf(record)),count=32;
    const weights=Array.from({length:count},()=>.3+random()),sum=weights.reduce((a,b)=>a+b,0);
    record.parts=weights.map(weight=>{
      const direction=new THREE.Vector3(random()-.5,random()-.5,random()-.5).normalize();
      const offset=direction.multiplyScalar(record.physicalRadius*Math.cbrt(random()));
      return {position:record.position.clone().add(offset),velocity:record.velocity.clone(),mass:record.initialMass*weight/sum,fraction:weight/sum};
    });
    const mean=record.parts.reduce((v,p)=>v.addScaledVector(p.position,p.mass/record.initialMass),new THREE.Vector3());
    const correction=record.position.clone().sub(mean);record.parts.forEach(p=>p.position.add(correction));
    record.mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,16,10),new THREE.MeshStandardMaterial({color:record.body.data.color||"#a28369",roughness:1,emissive:"#d64a17",emissiveIntensity:.1}),count);
    record.mesh.frustumCulled=false;record.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.app.scene.scene.add(record.mesh);record.body.root.visible=false;
    this.app.log.add(`${record.body.data.name}: marés excederam a ligação do corpo; o material segue em direção ao horizonte.`);
  }
  update(days) {
    const app=this.app;let remaining=days*DAY/this.timeUnit;
    this.elapsed+=days*DAY;
    while(remaining>1e-10) {
      let nearest=100;
      for(const record of this.records)if(!record.captured) {
        if(record.parts){for(const p of record.parts)nearest=Math.min(nearest,p.position.length());}
        else nearest=Math.min(nearest,record.position.length());
      }
      const ratio=this.hole.mass/this.initialMass;
      const h=Math.min(remaining,.5,.025*Math.sqrt(Math.max(1,nearest)**3/(.5*ratio)));
      for(const record of this.records) {
        if(record.captured)continue;
        if(record.parts) {
          record.parts=record.parts.filter(p=>{if(!this.drift(p,h,ratio))return true;this.capture(p.mass,p.velocity);return false;});
          const mass=record.parts.reduce((s,p)=>s+p.mass,0);record.body.mass=mass;
          if(mass) {
            record.position.copy(record.parts.reduce((v,p)=>v.addScaledVector(p.position,p.mass/mass),new THREE.Vector3()));
          } else this.finishBody(record);
        } else {
          if(this.drift(record,h,ratio)){this.capture(record.body.mass,record.velocity);record.body.mass=0;this.finishBody(record);continue;}
          const r=record.position.length(),load=(record.tidalRadius/r)**3;
          const response=Math.max(.2,.25*Math.sqrt(record.tidalRadius**3));
          record.body.tidal.direction.copy(record.position).normalize().negate();
          record.body.tidal.strain+=(Math.min(.65,.22*load)-record.body.tidal.strain)*-Math.expm1(-h/response);
          record.damage+=Math.max(0,load-1)*h/(response*2);
          if(record.damage>=1&&r>ratio)this.disrupt(record);
        }
      }
      remaining-=h;
      if(this.capturedBodies===this.records.length)break;
    }
    this.render();this.hole.update(days,app.elapsed||0);
    const time=this.elapsed<86400?`${(this.elapsed/3600).toFixed(2)} h`:`${(this.elapsed/86400).toFixed(2)} dias`;
    const status=`${this.profile.label} · ${this.capturedBodies}/${this.records.length} corpos capturados · ${(this.capturedMass/SOLAR_MASS).toFixed(4)} M☉ incorporadas · tempo físico: ${time}. Gravidade e marés aproximadas; aparência e relógio visual condensados. Hipermassivos podem capturar corpos inteiros.`;
    document.getElementById("science-status").textContent=status;
    document.getElementById("impact-status").textContent=this.capturedBodies===this.records.length?"Encontro concluído: a massa capturada foi incorporada ao buraco negro.":"Acompanhe o movimento. Use +passo ou pause para observar a aproximação.";
    document.getElementById("simulation-status").textContent="ENCONTRO COM BURACO NEGRO · MODELO REDUZIDO";
    if(this.capturedBodies===this.records.length&&days>0){app.clock.paused=true;app.ui.syncPlay();}
  }
  finishBody(record){record.captured=true;this.capturedBodies++;record.body.simulationHidden=true;this.app.destroy(record.body);record.trail.line.visible=false;}
  render() {
    const dummy=new THREE.Object3D(),ratio=this.hole.mass/this.initialMass;
    for(const record of this.records) {
      if(record.captured){if(record.mesh)record.mesh.count=0;continue;}
      const body=record.body,r=record.position.length();
      body.position.copy(record.position).multiplyScalar(SCENE_PER_RS);
      const fade=Math.sqrt(clamp((r/ratio-1)/3,0,1));
      const radius=(this.real?record.physicalRadius*SCENE_PER_RS:record.visualRadius)*fade;
      body.radius=Math.max(radius,1e-6);body.tilt.scale.setScalar(radius/body.data.visualRadius);body.updateTidalShape();
      if(body.corona)body.corona.scale.setScalar(radius/body.data.visualRadius);
      if(body.glow)body.glow.scale.setScalar(Math.max(1e-5,radius*7));
      if(body.label)body.label.hidden=!this.app.showLabels;
      record.trail.line.visible=this.app.showOrbits;
      if(this.elapsed!==record.lastTrailTime){record.trail.update(body.position);record.lastTrailTime=this.elapsed;}
      if(record.parts) {
        const amplification=this.real?1:Math.max(1,record.visualRadius/Math.max(1e-12,record.physicalRadius*SCENE_PER_RS));
        record.parts.forEach((p,i)=>{
          dummy.position.copy(p.position).sub(record.position).multiplyScalar(SCENE_PER_RS*amplification*fade).add(body.position);
          dummy.scale.setScalar(Math.max(1e-7,radius*Math.cbrt(p.fraction)*.7));dummy.rotation.set(i*.7,i*1.1,0);dummy.updateMatrix();record.mesh.setMatrixAt(i,dummy.matrix);
        });
        record.mesh.count=record.parts.length;record.mesh.instanceMatrix.needsUpdate=true;
      }
    }
  }
  dispose(){for(const r of this.records){r.trail.dispose();if(r.mesh){r.mesh.removeFromParent();r.mesh.geometry.dispose();r.mesh.material.dispose();}}}
}
