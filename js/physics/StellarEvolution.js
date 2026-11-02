import { clamp } from "./PhysicalUnits.js";

// Illustrative keyframes, NOT an interpolated MESA stellar track. Ages are
// billions of years FROM NOW; Earth engulfment is deliberately not prescribed.
export const SOLAR_STAGES = [
  { age:0, mass:1, radius:1, luminosity:1, name:"Sol atual" },
  { age:5, mass:0.99, radius:2, luminosity:2, name:"Fim da sequência principal" },
  { age:7.3, mass:0.95, radius:30, luminosity:150, name:"Ramo das gigantes vermelhas" },
  { age:7.59, mass:0.67, radius:256, luminosity:2730, name:"Gigante vermelha · máximo ilustrativo" },
  { age:7.7, mass:0.63, radius:12, luminosity:60, name:"Queima de hélio · contração" },
  { age:7.8, mass:0.56, radius:200, luminosity:3000, name:"Ramo assintótico · perda de envelope" },
  { age:7.81, mass:0.54, radius:0.013, luminosity:0.01, name:"Anã branca · não forma um buraco negro" },
];
export function solarEvolution(progress) {
  const phase=clamp(progress,0,1)*(SOLAR_STAGES.length-1),i=Math.min(SOLAR_STAGES.length-2,Math.floor(phase));
  const t=phase-i,a=SOLAR_STAGES[i],b=SOLAR_STAGES[i+1];
  const mix=(key)=>a[key]+(b[key]-a[key])*t;
  const logarithmic=key=>Math.exp(Math.log(a[key])*(1-t)+Math.log(b[key])*t);
  const radius=logarithmic("radius"),luminosity=logarithmic("luminosity");
  return { age:mix("age"),mass:mix("mass"),radius,luminosity,
    temperature:5772*(luminosity/(radius*radius))**0.25,name:t===1?b.name:a.name };
}
export const adiabaticOrbit = (a, massFraction) => a/massFraction;
