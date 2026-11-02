// Reference conditions, not a climate forecast. Cloud species and wind profiles
// differ by world; cloud transport is a reduced, prescribed-circulation model.
export const ENVIRONMENTS = {
  mercury: { albedo: 0.088, baselineK: 440, inertiaDays: 20, atmosphere: 0, kind: "rock", label: "Regolito · exosfera tênue" },
  venus: { albedo: 0.77, baselineK: 737, inertiaDays: 120, atmosphere: 1, kind: "acid", wind: -1.5, haze: 0.9, label: "CO₂ · nuvens de ácido sulfúrico" },
  earth: { albedo: 0.30, baselineK: 288, inertiaDays: 30, atmosphere: 0.65, kind: "water", wind: 0.16, haze: 0.12, label: "N₂ / O₂ · ciclo da água reduzido" },
  mars: { albedo: 0.25, baselineK: 210, inertiaDays: 8, atmosphere: 0.22, kind: "dust", wind: 0.25, haze: 0.25, label: "CO₂ rarefeito · poeira e gelo" },
  jupiter: { albedo: 0.50, baselineK: 163, inertiaDays: 90, atmosphere: 0.55, kind: "bands", wind: 0.6, haze: 0.15, label: "H₂ / He · jatos e nuvens de amônia" },
  saturn: { albedo: 0.34, baselineK: 133, inertiaDays: 90, atmosphere: 0.50, kind: "bands", wind: 0.8, haze: 0.3, label: "H₂ / He · faixas e névoa" },
  uranus: { albedo: 0.30, baselineK: 78, inertiaDays: 150, atmosphere: 0.40, kind: "methane", wind: -0.35, haze: 0.65, label: "H₂ / He / CH₄ · névoa e nuvens altas" },
  neptune: { albedo: 0.29, baselineK: 73, inertiaDays: 120, atmosphere: 0.45, kind: "methane", wind: 0.9, haze: 0.3, label: "H₂ / He / CH₄ · jatos e vórtices" },
};
