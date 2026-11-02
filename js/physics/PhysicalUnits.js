export const G = 6.67430e-11;
export const C = 299792458;
export const SIGMA = 5.670374419e-8;
export const AU_METERS = 149597870700;
export const SOLAR_MASS = 1.9885e30;
export const SOLAR_LUMINOSITY = 3.828e26;
export const DAY = 86400;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const schwarzschildRadius = (mass) => 2 * G * mass / C ** 2;
export const tidalAcceleration = (mass, radius, distance) =>
  2 * G * mass * radius / Math.max(distance, 1) ** 3;
export function seededRandom(seed = 1942) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
