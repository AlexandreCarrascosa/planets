import * as THREE from "three";
import { seededRandom } from "../physics/PhysicalUnits.js";
import { fractureVelocities } from "../physics/ImpactModel.js";
import { sweptSphereContact } from "../physics/CollisionSystem.js";

// Weighted self-gravitating material parcels. Not SPH: no equation of state,
// pressure solver or quantitative vapor fraction. Never discard mass by age.
export class EjectaCloud {
  constructor(app) { this.app=app;this.streams=[];this.capacity=768;this.seed=9187;this.dummy=new THREE.Object3D(); }
  get count() {return this.streams.reduce((sum,s)=>sum+s.parts.length,0);}
  get mass() {return this.streams.reduce((sum,s)=>sum+s.parts.reduce((m,p)=>m+p.mass,0),0);}
  coarsen() {
    for(const stream of this.streams) {
      const next=[];
      for(const source of stream.sources) {
        const group=stream.parts.filter(p=>p.source===source);
        for(let i=0;i<group.length;i+=2) {
          const a=group[i],b=group[i+1];if(!b){next.push(a);continue;}
          const mass=a.mass+b.mass,wa=a.mass/mass,wb=b.mass/mass;
          const position=a.position.clone().multiplyScalar(wa).addScaledVector(b.position,wb);
          next.push({...a,mass,mu:a.mu+b.mu,position,previous:position.clone(),
            radius:Math.cbrt(a.radius**3+b.radius**3),velocity:a.velocity.clone().multiplyScalar(wa).addScaledVector(b.velocity,wb),
            kick:a.kick.clone().multiplyScalar((1-a.released)*wa).addScaledVector(b.kick,(1-b.released)*wb),
            delay:stream.age,released:0,color:a.color.clone().lerp(b.color,wb)});
        }
      }
      stream.parts=next;
    }
  }
  add(a,b,event,normal,center) {
    while(this.capacity-this.count<256&&this.count>512)this.coarsen();
    const count=Math.min(256,this.capacity-this.count);
    if(count<16)return false;
    const random=seededRandom(this.seed++),parts=[];
    const sources=[a,b],counts=[Math.round(count*Math.cbrt(a.mass)/(Math.cbrt(a.mass)+Math.cbrt(b.mass))),0];
    counts[0]=Math.max(8,Math.min(count-8,counts[0]));counts[1]=count-counts[0];
    for(let sourceIndex=0;sourceIndex<2;sourceIndex++) {
      const body=sources[sourceIndex],n=counts[sourceIndex],group=[];
      const weights=Array.from({length:n},()=>.2+random()**2),sum=weights.reduce((x,y)=>x+y,0);
      for(let i=0;i<n;i++) {
        const y=2*random()-1,angle=random()*Math.PI*2,r=body.radius*Math.cbrt(random());
        const offset=new THREE.Vector3(Math.sqrt(1-y*y)*Math.cos(angle),y,Math.sqrt(1-y*y)*Math.sin(angle)).multiplyScalar(r);
        const fraction=weights[i]/sum;
        group.push({position:body.position.clone().add(offset),sourceVelocity:body.velocity.clone(),mass:body.mass*fraction,
          mu:body.mu*fraction,radius:body.radius*Math.cbrt(fraction),source:body,offset,release:r/body.radius,
          color:new THREE.Color(sourceIndex?"#8a4934":"#76645a").lerp(new THREE.Color("#ff8a32"),random()*.4)});
      }
      const mean=group.reduce((v,p)=>v.addScaledVector(p.position,p.mass/body.mass),new THREE.Vector3());
      const correction=body.position.clone().sub(mean);group.forEach(p=>p.position.add(correction));parts.push(...group);
    }
    const velocities=fractureVelocities(parts,event,normal,center);
    const contact=a.position.clone().addScaledVector(normal,a.radius*.9);
    parts.forEach((p,i)=>{
      p.kick=velocities[i].clone().sub(event.centerVelocity);p.released=0;
      p.delay=p.position.distanceTo(contact)/(a.radius+b.radius)*.4;
      p.velocity=event.centerVelocity.clone();p.previous=p.position.clone();
    });
    // Smooth volumetric surfaces with continuous noise, not flat polygon cells.
    const geometry=new THREE.SphereGeometry(1,24,16);
    const material=new THREE.MeshStandardMaterial({roughness:1,emissive:"#e84b13",emissiveIntensity:.28});
    material.onBeforeCompile=shader=>{
      shader.vertexShader="varying vec3 parcelPosition;\n"+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
        parcelPosition=position;
        float bump=1.+.045*sin(position.x*4.+position.y*3.)*sin(position.z*4.-position.y*3.);
        transformed*=bump;`);
      shader.fragmentShader="varying vec3 parcelPosition;\n"+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
        float grain=.5+.5*sin(dot(parcelPosition,vec3(31.,17.,23.)))*sin(dot(parcelPosition,vec3(13.,41.,19.)));
        float veins=pow(1.-abs(sin(dot(parcelPosition,vec3(8.,6.,11.)))),8.);
        diffuseColor.rgb*=.45+.55*grain;`);
      shader.fragmentShader=shader.fragmentShader.replace("#include <emissivemap_fragment>","#include <emissivemap_fragment>\ntotalEmissiveRadiance*=.12+.88*veins;");
    };
    material.customProgramCacheKey=()=>"organic-ejecta";
    const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.app.scene.scene.add(mesh);
    this.streams.push({parts,sources,mesh,age:0});
    for(const source of sources) {
      source.root.visible=false;source.impactLocked=true;
      source.environment?.dispose();source.environment=null;
      source.data={...source.data,name:`Material de ${source.data.name}`,description:"Material desprendido: parcelas com massa, gravidade própria e trajetórias independentes. Modelo granular reduzido."};
      if(source.label)source.label.textContent=source.data.name;
    }
    this.render();return true;
  }
  acceleration(stream) {
    const parts=stream.parts,others=this.app.bodies.filter(b=>!stream.sources.includes(b));
    const acceleration=parts.map(p=>this.app.gravity.acceleration(p,others));
    for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++) {
      const a=parts[i],b=parts[j],d=b.position.clone().sub(a.position);
      const r2=d.lengthSq()+(.6*(a.radius+b.radius))**2;
      const f=this.app.gravity.global/(r2*Math.sqrt(r2));
      acceleration[i].addScaledVector(d,f*b.mu);acceleration[j].addScaledVector(d,-f*a.mu);
    }
    return acceleration;
  }
  step(h) {
    if(h<=0)return;
    const holes=this.app.bodies.filter(b=>b.isBlackHole&&!b.destroyed);
    for(const stream of this.streams) {
      stream.age+=h;
      const impulseMean=new THREE.Vector3(),total=stream.parts.reduce((sum,p)=>sum+p.mass,0);
      for(const p of stream.parts) {
        const t=Math.max(0,Math.min(1,(stream.age-p.delay)/.4));
        const released=t*t*(3-2*t),increment=released-p.released;
        p.velocity.addScaledVector(p.kick,increment);impulseMean.addScaledVector(p.kick,increment*p.mass/total);p.released=released;
      }
      stream.parts.forEach(p=>p.velocity.sub(impulseMean));
      let forces=this.acceleration(stream);
      stream.parts.forEach((p,i)=>{p.previous.copy(p.position);p.velocity.addScaledVector(forces[i],h/2);p.position.addScaledVector(p.velocity,h);});
      forces=this.acceleration(stream);
      stream.parts.forEach((p,i)=>p.velocity.addScaledVector(forces[i],h/2));
      stream.parts=stream.parts.filter(p=>{
        const hole=holes.find(b=>sweptSphereContact(p.previous,p.position,b.previous||b.position,b.position,b.radius)!==null);
        if(!hole)return true;
        const total=hole.mass+p.mass;hole.velocity.multiplyScalar(hole.mass/total).addScaledVector(p.velocity,p.mass/total);
        hole.accrete(p.mass);hole.accretion=Math.min(1.5,hole.accretion+.01);return false;
      });
      for(const body of stream.sources) {
        const group=stream.parts.filter(p=>p.source===body),mass=group.reduce((sum,p)=>sum+p.mass,0);
        body.mass=mass;body.mu=group.reduce((sum,p)=>sum+p.mu,0);
        if(!mass){this.app.destroy(body);continue;}
        body.position.copy(group.reduce((v,p)=>v.addScaledVector(p.position,p.mass/mass),new THREE.Vector3()));
        body.velocity.copy(group.reduce((v,p)=>v.addScaledVector(p.velocity,p.mass/mass),new THREE.Vector3()));
      }
    }
  }
  render() {
    for(let i=this.streams.length-1;i>=0;i--) {
      const stream=this.streams[i];
      if(!stream.parts.length){this.dispose(stream);this.streams.splice(i,1);continue;}
      stream.parts.forEach((p,j)=>{
        this.dummy.position.copy(p.position);
        const aspect=1+.12*Math.sin(j*7.13);
        this.dummy.scale.set(p.radius*.72*aspect,p.radius*.72/Math.sqrt(aspect),p.radius*.72/Math.sqrt(aspect));
        this.dummy.rotation.set(j*1.1+stream.age*.1,j*.7,stream.age*.12);this.dummy.updateMatrix();
        stream.mesh.setMatrixAt(j,this.dummy.matrix);stream.mesh.setColorAt(j,p.color);
      });
      stream.mesh.count=stream.parts.length;stream.mesh.instanceMatrix.needsUpdate=true;stream.mesh.instanceColor.needsUpdate=true;
      stream.mesh.material.emissiveIntensity=.28*Math.exp(-stream.age/8);
    }
  }
  dispose(stream){stream.mesh.removeFromParent();stream.mesh.geometry.dispose();stream.mesh.material.dispose();}
  clear(){for(const stream of this.streams)this.dispose(stream);this.streams=[];this.seed=9187;}
}
