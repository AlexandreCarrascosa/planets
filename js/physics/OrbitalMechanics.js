// Kepler equation solved with Newton-Raphson; distances in scene units and time in days.
export function solveKepler(meanAnomaly, eccentricity) {
  const m = ((meanAnomaly % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let e = eccentricity < 0.8 ? m : Math.PI;
  for (let i = 0; i < 12; i++) {
    const step =
      (e - eccentricity * Math.sin(e) - m) / (1 - eccentricity * Math.cos(e));
    e -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  return e;
}
export function orbitalPosition(data, days, a = data.visualDistance) {
  const angle = solveKepler(
    data.phase + (days * 2 * Math.PI) / data.orbitalPeriodDays,
    data.eccentricity,
  );
  const x = a * (Math.cos(angle) - data.eccentricity),
    z = a * Math.sqrt(1 - data.eccentricity ** 2) * Math.sin(angle);
  const inclination = (data.inclination * Math.PI) / 180;
  return { x, y: z * Math.sin(inclination), z: z * Math.cos(inclination) };
}
export function circularSpeed(mu, distance) {
  return Math.sqrt(mu / Math.max(distance, 0.01));
}
