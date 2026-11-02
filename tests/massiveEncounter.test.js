import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { BlackHole } from "../js/bodies/BlackHole.js";
import { CelestialBody } from "../js/bodies/CelestialBody.js";
import { BLACK_HOLE_PROFILES, labTimeFactor } from "../js/data/blackHoleProfiles.js";
import { MassiveEncounter, centralAcceleration, tidalRadiusInHorizons } from "../js/physics/MassiveEncounter.js";
import { SOLAR_MASS, schwarzschildRadius } from "../js/physics/PhysicalUnits.js";

globalThis.document={getElementById:()=>({setAttribute(){}})};

test("black hole profiles retain physical masses and horizons with bounded drawings",()=>{
  for(const profile of BLACK_HOLE_PROFILES){
    const hole=new BlackHole("test",profile);
    assert.equal(hole.mass,profile.solarMasses*SOLAR_MASS);
    assert.ok(Math.abs(hole.data.radiusKm*1000/schwarzschildRadius(hole.mass)-1)<1e-12);
    assert.ok(hole.radius>=1.5&&hole.radius<10);
    assert.ok(Math.abs(profile.solarMasses*labTimeFactor(profile.solarMasses)**2-100)<1e-10);
    hole.dispose();
  }
  assert.throws(()=>new BlackHole("bad",{solarMasses:Infinity}),RangeError);
});

test("central force follows inverse square; increasing hole mass puts the tidal radius inside the horizon",()=>{
  const position=new THREE.Vector3(4,0,0),a=centralAcceleration(position);
  assert.ok(a.x<0);assert.ok(a.y===0);
  assert.equal(a.length()/centralAcceleration(position.clone().multiplyScalar(2)).length(),4);
  const small=tidalRadiusInHorizons(SOLAR_MASS,696340,1e6*SOLAR_MASS);
  const huge=tidalRadiusInHorizons(SOLAR_MASS,696340,1e10*SOLAR_MASS);
  assert.ok(small>1&&huge<1);
  assert.ok(Math.abs(small/huge-1e4**(2/3))<1e-10);
});

function fixture(profile){
  const scene=new THREE.Scene();
  const bodies=[{name:"Sol",massKg:SOLAR_MASS,radiusKm:696340},{name:"Terra",massKg:5.972e24,radiusKm:6371}].map((data,i)=>{
    const b=new CelestialBody({...data,id:String(i),type:"Rochoso",color:"#aaa",visualRadius:1,axialTilt:0});
    b.createSurface(new THREE.MeshStandardMaterial());scene.add(b.root);return b;
  });
  const app={bodies,scene:{scene},clock:{speed:1,paused:false},camera:{frameEncounter(){},focus(){}},ui:{syncPlay(){}},log:{add(){}},
    select(){},destroy(b){b.destroyed=true;b.root.visible=false;},
    spawn(type,pos,velocity,quiet,options){const b=new BlackHole("hole",options);bodies.push(b);scene.add(b.root);return b;}};
  return {app,encounter:new MassiveEncounter(app,profile)};
}

for(const mass of [1e6,1e10])test(`${mass} solar mass encounter captures material without losing its mass ledger`,()=>{
  const {app,encounter:e}=fixture({solarMasses:mass,label:"Teste"});
  const initial=e.records.reduce((s,r)=>s+r.initialMass,0),position=e.records[0].position.clone();
  e.update(0);assert.deepEqual(e.records[0].position,position);assert.equal(e.capturedMass,0);
  for(let i=0;i<240&&!app.clock.paused;i++)e.update(e.baseSpeed*.25);
  assert.equal(e.capturedBodies,2);
  assert.ok(Math.abs(e.capturedMass/initial-1)<1e-12);
  assert.equal(app.clock.paused,true);
  assert.ok(e.records.every(r=>Number.isFinite(r.position.length())));
  if(mass===1e10)assert.ok(e.records.every(r=>r.parts===null),"large horizon captures intact bodies");
  else assert.ok(e.records.some(r=>r.parts!==null),"stellar material is disrupted outside the smaller horizon");
  e.dispose();assert.equal(app.scene.scene.children.length,3);
  app.bodies.forEach(b=>b.dispose());
});
