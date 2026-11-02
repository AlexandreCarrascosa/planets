import { SOLAR_MASS, schwarzschildRadius, AU_METERS } from "../physics/PhysicalUnits.js";

export const BLACK_HOLE_PROFILES = [
  { id:"stellar",name:"Estelar",solarMasses:100,label:"Estelar · 100 sóis" },
  { id:"intermediate",name:"Intermediário",solarMasses:1e4,label:"Intermediário · 10 mil sóis" },
  { id:"supermassive",name:"Supermassivo",solarMasses:1e6,label:"Supermassivo · 1 milhão de sóis" },
  { id:"galactic",name:"Centro galáctico",solarMasses:4.3e6,label:"Centro galáctico · 4,3 milhões de sóis" },
  { id:"m87",name:"Supermassivo gigante",solarMasses:6.5e9,label:"Supermassivo gigante · 6,5 bilhões de sóis" },
  { id:"hypermassive",name:"Hipermassivo",solarMasses:1e10,label:"Hipermassivo · 10 bilhões de sóis" },
];
export const blackHoleProfile=id=>BLACK_HOLE_PROFILES.find(p=>p.id===id)||BLACK_HOLE_PROFILES[0];
export const labHoleRadius=mass=>1.5+Math.max(0,Math.log10(mass/100))*.5;
export const labTimeFactor=mass=>Math.min(1,Math.sqrt(100/Math.max(100,mass)));
export const horizonAU=mass=>schwarzschildRadius(mass*SOLAR_MASS)/AU_METERS;
export function profileDescription(profile) {
  return `${profile.solarMasses.toLocaleString("pt-BR")} massas solares · horizonte físico ${horizonAU(profile.solarMasses).toLocaleString("pt-BR",{maximumSignificantDigits:3})} UA. O desenho é ampliado; “Ver atração” prepara o encontro.`;
}
