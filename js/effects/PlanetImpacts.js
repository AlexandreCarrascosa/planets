import * as THREE from "three";
import { fractureBody } from "../physics/FractureGeometry.js";
import { estimateMergerHeat, fractureVelocities } from "../physics/ImpactModel.js";
import { clamp } from "../physics/PhysicalUnits.js";

const smooth = x => x*x*x*(10 + x*(-15 + x*6));
const slope = x => 30*x*x*(1-x)*(1-x);
const axisX = new THREE.Vector3(1, 0, 0);

function materialsFor(source, part) {
  const crust = Array.isArray(source.material) ? source.material[0] : source.material;
  const materials = [
    new THREE.MeshStandardMaterial({ map: crust.map, color: crust.color, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: "#5d382b", roughness: 1, emissive: "#f87525", emissiveIntensity: 0.7 }),
  ];
  const offset = part.position.clone().sub(source.position), sourceRadius = source.radius;
  materials[1].onBeforeCompile = shader => {
    shader.uniforms.cutOffset = { value: offset };
    shader.uniforms.sourceRadius = { value: sourceRadius };
    shader.vertexShader = `varying vec3 cutPosition; uniform vec3 cutOffset;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\ncutPosition=position+cutOffset;");
    shader.fragmentShader = `varying vec3 cutPosition; uniform float sourceRadius;
      float cutHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float cutNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(cutHash(i),cutHash(i+vec3(1,0,0)),f.x),mix(cutHash(i+vec3(0,1,0)),cutHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(cutHash(i+vec3(0,0,1)),cutHash(i+vec3(1,0,1)),f.x),mix(cutHash(i+vec3(0,1,1)),cutHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      vec3 rockPosition=cutPosition/max(sourceRadius,.001);
      float grain=cutNoise(rockPosition*23.)*.6+cutNoise(rockPosition*65.)*.4;
      float veins=pow(1.-abs(2.*cutNoise(rockPosition*12.)-1.),12.);
      float interior=1.-smoothstep(.45,1.05,length(rockPosition));
      diffuseColor.rgb*=.35+grain*.9;`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      totalEmissiveRadiance*=.06+veins*.7+interior*.3;`);
  };
  materials[1].customProgramCacheKey = () => "impact-interior";
  return materials;
}

// A contact has duration in laboratory time (0.1 per simulated day). Intact
// bodies stay on screen until closed, textured solid cells replace their volume.
// The contact/merger motion is dissipative and illustrative, not hydrodynamics.
export class PlanetImpacts {
  constructor(app) { this.app = app; this.active = []; this.seed = 4127; }
  get status() {
    const record = this.active[0];
    if (!record) return null;
    return record.phase === "contact"
      ? `${record.names} · contato e compressão · ${Math.round(record.age / record.duration * 100)}%`
      : `${record.names} · incorporação gradual · ${record.parts.length} porções de material`;
  }
  begin(a, b, event, contact) {
    if (a.impactLocked || b.impactLocked) return false;
    const center = a.position.clone().multiplyScalar(a.mass / event.mass).addScaledVector(b.position, b.mass / event.mass);
    const record = { a, b, event, center, position: center, velocity: event.centerVelocity.clone(),
      normal: contact.normal.clone(), distance: a.position.distanceTo(b.position),
      names: `${a.data.name} × ${b.data.name}`, age: 0, phase: "contact",
      totalMu: a.mu + b.mu,
      duration: clamp((a.radius + b.radius) / Math.max(event.speed, 1e-8) * 0.3, 0.75, 1.4),
      originalVelocities: [a.velocity.clone(), b.velocity.clone()], parts: [],
      followed: this.app.camera.tracking === a || this.app.camera.tracking === b,
    };
    a.impactLocked = b.impactLocked = true;
    a.free = b.free = true;
    if (record.followed) {
      this.app.camera.tracking = record;
      this.app.camera.lastTarget.copy(center);
      this.app.camera.followImpact?.(record, a, b);
    }
    a.environment?.impact(contact.point, 2);
    b.environment?.impact(contact.point, 2);
    this.app.particles.burst(contact.point, "#ffc583", 0.45, {
      normal: contact.normal, atmosphere: !!a.environment?.profile.atmosphere, atmosphereBody: a,
    });
    this.active.push(record);
    return true;
  }
  step(h) {
    if (h <= 0) return;
    for (const record of [...this.active]) {
      const others = this.app.bodies.filter(body => body !== record.a && body !== record.b);
      const acceleration = this.app.gravity.acceleration(record, others);
      record.velocity.addScaledVector(acceleration, h / 2);
      record.center.addScaledVector(record.velocity, h);
      record.velocity.addScaledVector(this.app.gravity.acceleration(record, others), h / 2);
      record.age += h;
      if (record.phase === "contact") this.contact(record);
      else this.transfer(record);
    }
  }
  contact(record) {
    const { a, b, event, normal } = record;
    const t = clamp(record.age / record.duration, 0, 1), compression = 0.1 * smooth(t);
    const distance = record.distance * (1 - compression);
    a.position.copy(record.center).addScaledVector(normal, -distance * b.mass / event.mass);
    b.position.copy(record.center).addScaledVector(normal, distance * a.mass / event.mass);
    const rate = -record.distance * 0.1 * slope(t) / record.duration;
    a.velocity.copy(record.velocity).addScaledVector(normal, -rate * b.mass / event.mass);
    b.velocity.copy(record.velocity).addScaledVector(normal, rate * a.mass / event.mass);
    a.updateImpactShape(normal, compression); b.updateImpactShape(normal, compression);
    if (t < 1) return;
    // Preserve pre-impact relative motion for the fragmentation energy/flow.
    const gravityKick = record.velocity.clone().sub(event.centerVelocity);
    a.velocity.copy(record.originalVelocities[0]).add(gravityKick);
    b.velocity.copy(record.originalVelocities[1]).add(gravityKick);
    if (event.regime === "merge") this.startTransfer(record);
    else this.shatter(record);
  }
  shatter(record) {
    const { a, b, event, normal } = record;
    if(this.app.ejecta?.add(a,b,{...event,centerVelocity:record.velocity},normal,record.center)) {
      this.finish(record,a.mass>=b.mass?a:b);
      this.app.log.add("Ruptura granular: material dos dois corpos se desprende com trajetórias próprias e atração entre as parcelas. Modelo reduzido, sem hidrodinâmica SPH.");
      return;
    }
    const capacity = Math.max(2, 98 - this.app.bodies.filter(body => !body.destroyed).length);
    const count = Math.min(24, capacity);
    const weight = Math.sqrt(a.mass) / (Math.sqrt(a.mass) + Math.sqrt(b.mass));
    const countA = clamp(Math.round(count * weight), 1, count - 1), countB = count - countA;
    const larger = a.mass >= b.mass ? a : b;
    const retained = clamp(event.largestFraction * event.mass / larger.mass, 0.05, 0.97);
    const partsA = fractureBody(a, countA, this.seed++, larger === a ? retained : null, normal);
    const partsB = fractureBody(b, countB, this.seed++, larger === b ? retained : null, normal.clone().negate());
    const parts = [...partsA, ...partsB];
    const updatedEvent = { ...event, centerVelocity: record.velocity };
    const velocities = fractureVelocities(parts, updatedEvent, normal, record.center);
    const prepared = parts.map((part, i) => ({ ...part, sourceName: part.source.data.name, materials: materialsFor(part.source, part),
      velocity: velocities[i], spin: normal.clone().cross(part.position.clone().sub(record.center)).multiplyScalar(0.08) }));
    // All replacement geometry exists before either original surface is removed.
    // Reuse both source objects, so even a full body pool retains all mass.
    prepared.forEach((part, i) => {
      const sourceParts = part.source === a ? partsA : partsB;
      const body = i === 0 ? a : i === partsA.length ? b
        : this.app.spawn("debris", part.position, part.velocity, true);
      if (!body) throw new Error("Impact fragment capacity was not reserved");
      const name = sourceParts[0].mass === part.mass ? `Remanescente de ${part.sourceName}` : "Fragmento de impacto";
      body.replaceWithFragment(part, part.materials, name);
    });
    const largest = [a, b].sort((x, y) => y.mass - x.mass)[0];
    this.finish(record, largest);
    this.app.log.add(`Ruptura: os dois corpos originaram ${parts.length} fragmentos sólidos, com crosta e interior exposto. Massa e momento linear preservados.`);
  }
  startTransfer(record) {
    const target = record.a.mass >= record.b.mass ? record.a : record.b;
    const victim = target === record.a ? record.b : record.a;
    // Merger cells are temporary render/transport objects, independent of the
    // free-body capacity. The victim retains exactly their remaining mass.
    const parts = fractureBody(victim, 32, this.seed++);
    for(const part of parts) {
      // A merging planetary mantle flows as hot material. Do not display the
      // planar partition cells used internally to allocate its mass/centroid.
      part.geometry.dispose();part.radius=Math.cbrt(part.visualVolume);
      part.geometry=new THREE.SphereGeometry(part.radius,16,10);
    }
    record.target = target; record.victim = victim; record.parts = parts;
    record.phase = "transfer"; record.age = 0; record.duration = 3.2;
    record.targetVolume = target.visualVolume || target.radius ** 3;
    record.targetPhysicalVolume = target.data.radiusKm ** 3;
    if (target.data.type === "Rochoso" && victim.data.type === "Rochoso") {
      const heat = estimateMergerHeat(target, victim, record.event);
      heat.energyJ += (victim.environment?.thermal.bulkHeat || 0) * (victim.environment?.thermal.heatCapacity || 0);
      target.environment?.thermal.addMergerHeat(heat);
    }
    const outward = victim.position.clone().sub(target.position).normalize();
    const range = target.radius + victim.radius;
    for (const part of parts) {
      part.start = part.position.clone().sub(record.center);
      part.travel = record.duration * (0.65 + 0.35 * clamp(part.position.clone().sub(target.position).dot(outward) / range, 0, 1));
      part.materials = materialsFor(victim, part);
      part.materials[0].map=null;part.materials[0].color.set(victim.data.color||"#a36342");
      part.materials[0].emissive.set("#d9420d");part.materials[0].emissiveIntensity=.3;
      part.mesh = new THREE.Mesh(part.geometry, part.materials);
      part.mesh.position.copy(part.position); part.mesh.castShadow = true;
      this.app.scene.scene.add(part.mesh);
      part.velocity = record.velocity.clone();
    }
    victim.root.visible = false;
    target.environment?.impact(victim.position, 6);
  }
  transfer(record) {
    const { target, victim, event } = record;
    for (const part of record.parts) {
      const t = clamp(record.age / part.travel, 0, 1), blend = smooth(t);
      part.offset = part.start.clone().multiplyScalar(1 - blend);
      part.relativeVelocity = part.start.clone().multiplyScalar(-slope(t) / part.travel);
      part.position.copy(record.center).add(part.offset);
      part.velocity.copy(record.velocity).add(part.relativeVelocity);
      part.mesh.position.copy(part.position);
      part.materials[1].emissiveIntensity = 0.8 * Math.exp(-record.age / 5);
      part.materials[0].emissiveIntensity = 0.3 * Math.exp(-record.age / 5);
    }
    const placeTarget = () => {
      const weightedPosition = new THREE.Vector3(), weightedVelocity = new THREE.Vector3();
      for (const part of record.parts) {
        weightedPosition.addScaledVector(part.offset, part.mass / event.mass);
        weightedVelocity.addScaledVector(part.relativeVelocity, part.mass / event.mass);
      }
      target.position.copy(record.center).addScaledVector(weightedPosition, -event.mass / target.mass);
      target.velocity.copy(record.velocity).addScaledVector(weightedVelocity, -event.mass / target.mass);
    };
    placeTarget();
    // A piece is retired only after its entire bounding sphere is occluded by
    // the remnant. No opacity animation or lifetime can remove exposed mass.
    for (let i = record.parts.length - 1; i >= 0; i--) {
      const part = record.parts[i];
      const inscribedRadius = target.radius * (1 - 0.1 * Math.exp(-record.age / 0.6));
      if (part.position.distanceTo(target.position) + part.radius > inscribedRadius * 0.98) continue;
      const mass = target.mass + part.mass;
      target.setMass(mass);
      record.targetVolume += part.visualVolume;
      record.targetPhysicalVolume += part.physicalVolume;
      const radius = Math.cbrt(record.targetVolume);
      target.tilt.scale.multiplyScalar(radius / target.radius); target.radius = radius;
      target.visualVolume = record.targetVolume;
      target.data = { ...target.data, radiusKm: Math.cbrt(record.targetPhysicalVolume) };
      record.parts.splice(i, 1); this.disposePart(part);
      placeTarget();
    }
    // Set the two gravitational source masses from the transport ledger.
    const remainingMass = record.parts.reduce((sum, p) => sum + p.mass, 0);
    const remainingMu = record.parts.reduce((sum, p) => sum + p.mu, 0);
    target.mu = record.totalMu - remainingMu;
    victim.mass = remainingMass; victim.mu = remainingMu;
    victim.data = { ...victim.data, massKg: remainingMass,
      radiusKm: Math.cbrt(record.parts.reduce((sum, p) => sum + p.physicalVolume, 0)) };
    if (remainingMass > 0) {
      victim.position.copy(record.parts.reduce((v, p) => v.addScaledVector(p.position, p.mass / remainingMass), new THREE.Vector3()));
      victim.velocity.copy(record.parts.reduce((v, p) => v.addScaledVector(p.velocity, p.mass / remainingMass), new THREE.Vector3()));
    }
    target.updateImpactShape(record.normal, 0.1 * Math.exp(-record.age / 0.6));
    if (record.parts.length) return;
    target.updateImpactShape(axisX, 0); target.impactLocked = false;
    target.velocity.copy(record.velocity); target.position.copy(record.center);
    victim.impactLocked = false;
    const followedVictim = this.app.selected === victim;
    const followedMaterial = this.app.camera.tracking === record || this.app.camera.tracking === victim;
    this.app.destroy(victim);
    if (followedVictim) this.app.select(target, false);
    if (followedMaterial) {
      this.app.camera.tracking = target; this.app.camera.lastTarget.copy(target.position);
    }
    this.finish(record, target);
    this.app.log.add("Fusão concluída: todo o material foi incorporado ao remanescente. Massa e momento linear preservados.");
  }
  finish(record, body) {
    if (this.app.camera.tracking === record) {
      this.app.camera.tracking = body; this.app.camera.lastTarget.copy(body.position);
    }
    this.active.splice(this.active.indexOf(record), 1);
  }
  disposePart(part) {
    part.mesh.removeFromParent(); part.geometry.dispose(); part.materials.forEach(material => material.dispose());
  }
  clear() {
    for (const record of this.active) {
      for (const part of record.parts) this.disposePart(part);
      record.a.impactLocked = record.b.impactLocked = false;
      record.a.updateImpactShape(axisX, 0); record.b.updateImpactShape(axisX, 0);
    }
    this.active = []; this.seed = 4127;
  }
}
