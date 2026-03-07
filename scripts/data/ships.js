// Ships data library
var ZEPHYR_SHIPS_LIBRARY = {
  "Sloop": {
    id: "Sloop",
    name: "Шлюп 8-пушечный",
    description: "Типичное малое каботажное судно с преимущественно косым парусным вооружением.",
    type: "sloop",
    era: "17th century",
    hull: {
      length: { gundeck: 12.2, keel: 10.5 },
      LWL: 10.5,
      beam: 4.4,
      depthInHold: 2.1,
      draft: { empty: 1.8, full: 2.4, current: 1.8 },
      displacement: 28,
      maxDisplacement: 45,
      draftPerTon: 0.02 // м/тонну для шлюпа
    },
    sailing: {
      maxTheoreticalSpeed: 10,
      availableCourses: ["45-close", "60-close", "90-cross", "90-cross-sq", "135-broad", "180-run"],
      sailConfig: {
        bonusSails: {
          "none": { label: "Без дополнительных парусов", bonus: 0, requirements: [] },
          "mainsail": { label: "Марсель", bonus: 1.2, requirements: ["90-cross", "135-broad", "180-run"] },
          "topsail": { label: "Брамсель", bonus: 1.5, requirements: ["135-broad", "180-run"] },
          "staysail": { label: "Стаксель", bonus: 0.8, requirements: ["45-close", "60-close", "90-cross"] }
        }
      },
      polarDiagram: {
        "standard": {
          "0": 0.00, "15": 0.20, "30": 0.35, "45": 0.40,
          "60": 0.50, "75": 0.60, "90": 0.65, "105": 0.70,
          "120": 0.75, "135": 0.85, "150": 0.90, "165": 0.95, "180": 1.00
        },
        "square": {
          "0": 0.00, "15": 0.15, "30": 0.35, "45": 0.50,
          "60": 0.40, "75": 0.55, "90": 0.80, "105": 0.85,
          "120": 0.90, "135": 1.00, "150": 1.00, "165": 0.95, "180": 0.90
        }
      },
      turningRadius: {
        base: 1.2,
        speedFactors: {
          "light": { speed: [2, 4], multiplier: 1.0 },
          "moderate": { speed: [4, 6], multiplier: 1.3 },
          "strong": { speed: [6, 8], multiplier: 1.6 },
          "storm": { speed: [8, Number.POSITIVE_INFINITY], multiplier: 2.0 }
        },
        windFactors: {
          "calm": 0.9, "weak": 1.0, "normal": 1.1, "strong": 1.3, "storm": 1.6
        },
        waveFactors: {
          "calm": 1.0, "ripple": 1.05, "wave": 1.15, "stwave": 1.25, "storm": 1.4
        },
        cargoFactor: 0.1
      },
      oars: {
        available: true,
        maxSpeed: 4,
        crewRequired: 8,
        speedBonus: 2
      }
    },
    capacity: { 
      maxCargo: 17, 
      crew: { min: 4, optimal: 8, max: 12 },
      supplies: 2, 
      water: 1.5, 
      currentCargo: 0 
    },
	armament: {
      mainBattery: { count: 8, caliber: "6-ти фунтовых орудия" }
    },
    modifiers: {
      cargoSpeedPenalty: (cargoRatio) => { 
        return Math.max(0.01, 1 - (cargoRatio * 0.2) - (Math.pow(cargoRatio, 2) * 0.1)); 
      },
      draftResistance: (draftRatio) => { 
        return 1 + (draftRatio * 0.15); 
      },
      maneuverability: (cargoRatio) => { 
        return Math.max(0, 0.8 - (cargoRatio * 0.3)); 
      },
      waveResistance: (waveHeight) => {
        if (waveHeight <= 0.5) return 1.0;
        if (waveHeight <= 1.0) return 0.95;
        if (waveHeight <= 2.0) return 0.85;
        if (waveHeight <= 4.0) return 0.7;
        return 0.5;
      }
    }
  },
  "leRequinXebec": {
    id: "leRequinXebec",
    name: "Шебека 24-пушечная",
    description: "Крупная шебека с косым парусным вооружением.",
    type: "xebec",
    era: "mid-18th century",
    hull: {
      length: { gundeck: 37.338, keel: 30.861 },
      LWL: 34.0,
      beam: 8.458,
      depthInHold: 2.794,
      draft: { empty: 2.0, full: 2.75, current: 2.4 },
      displacement: 260,
      maxDisplacement: 360,
      draftPerTon: 0.012
    },
    sailing: {
      maxTheoreticalSpeed: 12.5,
      availableCourses: ["45-close", "60-close", "90-cross", "135-broad", "180-run"],
      polarDiagram: {
        "0": 0.00, "15": 0.25, "30": 0.60, "45": 0.90,
        "60": 1.00, "75": 0.95, "90": 0.90, "105": 0.85,
        "120": 0.80, "135": 0.75, "150": 0.70, "165": 0.55, "180": 0.40
      },
      turningRadius: {
        base: 1.0,
        speedFactors: {
          "light": { speed: [3, 4], multiplier: 1.0 },
          "moderate": { speed: [5, 6], multiplier: 1.3 },
          "strong": { speed: [6, 7], multiplier: 1.7 },
          "storm": { speed: [7, Number.POSITIVE_INFINITY], multiplier: 2.0 }
        },
        windFactors: {
          "calm": 0.8, "weak": 1.0, "normal": 1.1, "strong": 1.4, "storm": 1.8
        },
        waveFactors: {
          "calm": 1.0, "ripple": 1.1, "wave": 1.2, "stwave": 1.35, "storm": 1.6
        },
        cargoFactor: 0.08
      },
      oars: {
        available: true,
        maxSpeed: 3,
        crewRequired: 40,
        speedBonus: 2
      }
    },
    capacity: { 
      maxCargo: 80, 
      crew: { min: 120, optimal: 220, max: 350 },
      supplies: 10, 
      water: 5, 
      currentCargo: 0 
    },
    armament: {
      mainBattery: { count: 24, caliber: "8-ми фунтовых орудия" },
      secondary: { count: 8, caliber: "4 фунта" },
      swivelGuns: { count: 14, caliber: "2.5 фунтовых фальконетов" }
    },
    modifiers: {
      cargoSpeedPenalty: (cargoRatio) => { 
        return Math.max(0.01, 1 - (cargoRatio * 0.15) - (Math.pow(cargoRatio, 2) * 0.08)); 
      },
      draftResistance: (draftRatio) => { 
        return 1 + (draftRatio * 0.12); 
      },
      maneuverability: (cargoRatio) => { 
        return Math.max(0, 0.85 - (cargoRatio * 0.25)); 
      },
      waveResistance: (waveHeight) => {
        if (waveHeight <= 0.5) return 1.0;
        if (waveHeight <= 1.0) return 0.9;
        if (waveHeight <= 2.0) return 0.7;
        if (waveHeight <= 3.0) return 0.5;
        return 0.3;
      }
    },
  }
};
