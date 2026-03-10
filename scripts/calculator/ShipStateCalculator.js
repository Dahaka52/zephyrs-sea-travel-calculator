class ShipStateCalculator {
  constructor() {
    // stateless helper class: uses global ZEPHYR_* constants and ZEPHYR_SHIPS_LIBRARY
  }

  /**
   * Calculate static ship state from inputs: cargo (tons) and crewCount.
   * Returns object with drafted depth, displacement, cargo ratios, maneuverability, etc.
   */
  calculate(shipId, cargoTons, crewCount) {
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    if (!ship) return null;

    cargoTons = Number(cargoTons) || 0;
    crewCount = Math.max(0, parseInt(crewCount || 0, 10));

    // Crew weight in tonnes
    const crewWeightTons = (crewCount * ZEPHYR_AVG_CREW_WEIGHT_KG) / 1000.0;

    // Effective cargo includes declared cargo plus crew weight (design choice)
    const effectiveCargo = Math.max(0, cargoTons + crewWeightTons);

    const maxCargo = ship.capacity?.maxCargo || 1;

    // Cargo ratio (0..inf) used for many modifiers
    const cargoRatio = effectiveCargo / maxCargo;
    const cargoRatioForHull = Math.min(Math.max(cargoRatio, 0), 2.0);

    // Draft per ton: ship-specific fallback to module default
    const draftPerTon = ship.hull.draftPerTon || ZEPHYR_DRAFT_PER_TON;

    // Draft computed using explicit per-ton coefficient
    const currentDraft = ship.hull.draft?.empty + (effectiveCargo * draftPerTon);

    // Displacement: interpolate between displacement and maxDisplacement using cargo ratio clamped
    const displacementRange = (ship.hull.maxDisplacement || ship.hull.displacement) - (ship.hull.displacement || 0);
    let computedDisp = (ship.hull.displacement || 0) + (displacementRange * cargoRatioForHull);
    const currentDisplacement = Math.min(ship.hull.maxDisplacement || computedDisp, Math.max(ship.hull.displacement || 0, computedDisp));

    // Speed penalty from cargo (ensure reasonable minimum)
    let speedMultiplier = 1.0;
    if (ship.modifiers && typeof ship.modifiers.cargoSpeedPenalty === 'function') {
      speedMultiplier = ship.modifiers.cargoSpeedPenalty(cargoRatio);
    } else {
      speedMultiplier = Math.max(0.01, 1 - (cargoRatio * 0.2));
    }
    if (!isFinite(speedMultiplier) || speedMultiplier <= 0) speedMultiplier = 0.01;

    // Maneuverability: use ship modifier and crew modifier applied later
    let maneuverability = ZEPHYR_MIN_MANEUVERABILITY;
    if (ship.modifiers && typeof ship.modifiers.maneuverability === 'function') {
      maneuverability = Math.max(ZEPHYR_MIN_MANEUVERABILITY, ship.modifiers.maneuverability(Math.min(Math.max(cargoRatio, 0), 1.5)));
    }

    // Basic LWL and base turn radius
    const LWL_m = ship.hull.LWL || ship.hull.length?.gundeck || ship.hull.length || 10;
    const baseTurnRadiusM = LWL_m * (ship.sailing?.turningRadius?.base || 1.0);

    return {
      currentDraft,
      currentDisplacement,
      speedMultiplier,
      maneuverability,
      cargoRatio,
      crewWeightTons,
      effectiveCargo,
      baseTurnRadiusM,
      LWL_m,
      draftPerTon
    };
  }

  /**
   * Calculate polar speed given ship, wind angle (0..180), and optional conditions object.
   * Supports both flat polar object and {standard, square} variants.
   */
  calculatePolarSpeed(ship, windAngle, conditions = {}) {
    if (!ship || typeof ship.sailing === 'undefined') return 0;

    let polar = ship.sailing.polarDiagram;
    // Support variant object: { standard: {...}, square: {...} }
    if (polar && polar.standard && polar.square) {
      polar = (conditions.windCourse || "").includes("sq") ? polar.square : polar.standard;
    }
    // If polar is nested but not variant, handle gracefully
    if (!polar || typeof polar !== 'object') return 0;

    // Normalize angles array (numbers)
    const angles = Object.keys(polar).map(Number).filter(n => !isNaN(n)).sort((a,b) => a - b);
    if (!angles.length) return 0;

    // Out-of-range handling
    if (windAngle <= angles[0]) return (ship.sailing.maxTheoreticalSpeed || 0) * polar[angles[0]];
    if (windAngle >= angles[angles.length - 1]) return (ship.sailing.maxTheoreticalSpeed || 0) * polar[angles[angles.length - 1]];

    // Find lower/upper neighbors for interpolation
    let lowerIndex = 0;
    while (lowerIndex < angles.length - 1 && angles[lowerIndex + 1] < windAngle) lowerIndex++;
    const a0 = angles[lowerIndex];
    const a1 = angles[lowerIndex + 1];
    const v0 = polar[a0];
    const v1 = polar[a1];
    const t = (windAngle - a0) / (a1 - a0);
    const coeff = v0 + t * (v1 - v0);

    return (ship.sailing.maxTheoreticalSpeed || 0) * coeff;
  }

  /**
   * Calculate turning radius using ship, precomputed shipState, currentSpeed (knots),
   * windForce key string, waves key string, and windAngle (degrees).
   */
  calculateTurningRadius(ship, shipState, currentSpeed, windForce, waves, windAngle) {
    if (!shipState) return { radiusM: 0, radiusFt: 0, factors: {} };

    const turningConfig = ship.sailing?.turningRadius || {};
    const LWL_m = shipState.LWL_m || (ship.hull?.LWL || 10);

    // Start from base radius in meters
    let radius = shipState.baseTurnRadiusM || (LWL_m * (turningConfig.base || 1.0));

    // Speed factor: find matching band
    let speedMultiplier = 1.0;
    if (turningConfig.speedFactors) {
      for (const cfg of Object.values(turningConfig.speedFactors)) {
        const [minS, maxS] = cfg.speed;
        if (currentSpeed >= minS && currentSpeed <= maxS) { speedMultiplier = cfg.multiplier; break; }
      }
    }

    const windMultiplier = turningConfig.windFactors?.[windForce] ?? 1.0;
    const waveMultiplier = turningConfig.waveFactors?.[waves] ?? 1.0;
    const cargoMultiplier = 1 + (shipState.cargoRatio * (turningConfig.cargoFactor ?? 0.1));
    const courseMultiplier = (windAngle <= 60) ? 1.2 : 1.0;

    // Avoid extremely small maneuverability
    const maneuver = Math.max(ZEPHYR_MIN_MANEUVERABILITY, shipState.maneuverability || ZEPHYR_MIN_MANEUVERABILITY);

    radius = radius * speedMultiplier * windMultiplier * waveMultiplier * cargoMultiplier * courseMultiplier / maneuver;

    // Safety clamp to avoid NaN or Infinity
    if (!isFinite(radius) || radius < 0) radius = shipState.baseTurnRadiusM;

    return {
      radiusM: radius,
      radiusFt: radius * 3.28084,
      factors: {
        speed: speedMultiplier,
        wind: windMultiplier,
        wave: waveMultiplier,
        cargo: cargoMultiplier,
        course: courseMultiplier
      }
    };
  }
}
