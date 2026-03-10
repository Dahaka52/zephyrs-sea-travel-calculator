// TravelCalculator singleton module

var SeaTravelCalculator = (() => {
  function ensureDependencies() {
    const missing = [];

    if (typeof ZEPHYR_MODULE_ID === "undefined") missing.push("ZEPHYR_MODULE_ID");
    if (typeof ZEPHYR_SHIPS_LIBRARY === "undefined") missing.push("ZEPHYR_SHIPS_LIBRARY");
    if (typeof ZEPHYR_WIND_COURSES === "undefined") missing.push("ZEPHYR_WIND_COURSES");
    if (typeof ZEPHYR_WIND_FORCES === "undefined") missing.push("ZEPHYR_WIND_FORCES");
    if (typeof ZEPHYR_WAVES === "undefined") missing.push("ZEPHYR_WAVES");
    if (typeof ZEPHYR_CREW_MODIFIERS === "undefined") missing.push("ZEPHYR_CREW_MODIFIERS");
    if (typeof ShipStateCalculator === "undefined") missing.push("ShipStateCalculator");

    if (missing.length) {
      throw new Error(`Zephyr dependencies are missing: ${missing.join(", ")}`);
    }
  }

  class TravelCalculator {
    constructor() {
      this.shipStateCalculator = new ShipStateCalculator();
      this._lastInputSaveQueue = Promise.resolve();
      this._windowSettingsSaveQueue = Promise.resolve();

      this.ensureSettingsRegistered();
      this.lastData = this.loadLastInput();
      this.windowSettings = this.loadWindowSettings();
    }

    getDefaultShipId() {
      const allShips = Object.keys(ZEPHYR_SHIPS_LIBRARY);
      return allShips.includes("Sloop") ? "Sloop" : (allShips[0] || "");
    }

    getDefaultLastInput() {
      return {
        ship: this.getDefaultShipId(),
        mode: "distance",
        distance: 10,
        time: 1,
        unit: "km",
        windCourse: "90-cross",
        windForce: "normal",
        waves: "calm",
        bonusSails: "none",
        crewType: "experienced",
        crewCount: 8,
        helm: false,
        cargo: 0,
        useOars: false
      };
    }

    getDefaultWindowSettings() {
      return { width: 800, height: 600, top: null, left: null };
    }

    ensureSettingsRegistered() {
      const lastInputKey = `${ZEPHYR_MODULE_ID}.lastInput`;
      if (!game.settings.settings.has(lastInputKey)) {
        game.settings.register(ZEPHYR_MODULE_ID, "lastInput", {
          scope: "client",
          config: false,
          type: Object,
          default: this.getDefaultLastInput()
        });
      }

      const windowSettingsKey = `${ZEPHYR_MODULE_ID}.windowSettings`;
      if (!game.settings.settings.has(windowSettingsKey)) {
        game.settings.register(ZEPHYR_MODULE_ID, "windowSettings", {
          scope: "client",
          config: false,
          type: Object,
          default: this.getDefaultWindowSettings()
        });
      }
    }

    loadLastInput() {
      return this.normalizeInput(game.settings.get(ZEPHYR_MODULE_ID, "lastInput"));
    }

    loadWindowSettings() {
      const raw = game.settings.get(ZEPHYR_MODULE_ID, "windowSettings") || {};
      const defaults = this.getDefaultWindowSettings();
      return {
        width: Number(raw.width) > 0 ? Number(raw.width) : defaults.width,
        height: Number(raw.height) > 0 ? Number(raw.height) : defaults.height,
        top: Number.isFinite(raw.top) ? Number(raw.top) : defaults.top,
        left: Number.isFinite(raw.left) ? Number(raw.left) : defaults.left
      };
    }

    queueSettingSave(queueProp, key, value) {
      this[queueProp] = this[queueProp]
        .catch(() => undefined)
        .then(() => game.settings.set(ZEPHYR_MODULE_ID, key, value))
        .catch(err => {
          console.warn(`Zephyr: failed to save setting '${key}'`, err);
        });
      return this[queueProp];
    }

    saveLastInput(data) {
      const normalized = this.normalizeInput(data);
      this.lastData = normalized;
      return this.queueSettingSave("_lastInputSaveQueue", "lastInput", normalized);
    }

    saveWindowSettings(settings) {
      const defaults = this.getDefaultWindowSettings();
      const normalized = {
        width: Number(settings?.width) > 0 ? Math.round(settings.width) : defaults.width,
        height: Number(settings?.height) > 0 ? Math.round(settings.height) : defaults.height,
        top: Number.isFinite(settings?.top) ? Math.round(settings.top) : defaults.top,
        left: Number.isFinite(settings?.left) ? Math.round(settings.left) : defaults.left
      };
      this.windowSettings = normalized;
      return this.queueSettingSave("_windowSettingsSaveQueue", "windowSettings", normalized);
    }

    toNonNegativeNumber(value, fallback = 0) {
      const n = Number(value);
      if (!isFinite(n)) return fallback;
      return Math.max(0, n);
    }

    normalizeInput(rawData = {}) {
      const defaults = this.getDefaultLastInput();
      const merged = { ...defaults, ...(rawData || {}) };
      const shipId = ZEPHYR_SHIPS_LIBRARY[merged.ship] ? merged.ship : defaults.ship;
      const ship = ZEPHYR_SHIPS_LIBRARY[shipId];

      const shipCourses = (ship?.sailing?.availableCourses && ship.sailing.availableCourses.length)
        ? ship.sailing.availableCourses
        : Object.keys(ZEPHYR_WIND_COURSES);
      const windCourse = shipCourses.includes(merged.windCourse) ? merged.windCourse : (shipCourses[0] || defaults.windCourse);

      const windForce = Object.prototype.hasOwnProperty.call(ZEPHYR_WIND_FORCES, merged.windForce)
        ? merged.windForce
        : defaults.windForce;
      const waves = Object.prototype.hasOwnProperty.call(ZEPHYR_WAVES, merged.waves)
        ? merged.waves
        : defaults.waves;
      const crewType = Object.prototype.hasOwnProperty.call(ZEPHYR_CREW_MODIFIERS, merged.crewType)
        ? merged.crewType
        : defaults.crewType;

      const availableBonusSails = this.getAvailableBonusSails(shipId);
      const bonusSails = Object.prototype.hasOwnProperty.call(availableBonusSails, merged.bonusSails)
        ? merged.bonusSails
        : "none";

      const hasOars = this.hasOars(shipId);

      return {
        ship: shipId,
        mode: merged.mode === "time" ? "time" : "distance",
        distance: this.toNonNegativeNumber(merged.distance, defaults.distance),
        time: this.toNonNegativeNumber(merged.time, defaults.time),
        unit: merged.unit === "mi" ? "mi" : "km",
        windCourse,
        windForce,
        waves,
        bonusSails,
        crewType,
        crewCount: Math.max(0, parseInt(merged.crewCount || 0, 10)),
        helm: !!merged.helm,
        cargo: this.toNonNegativeNumber(merged.cargo, defaults.cargo),
        useOars: hasOars ? !!merged.useOars : false
      };
    }

    calculateShipState(shipId, cargoTons, crewCount) {
      return this.shipStateCalculator.calculate(shipId, cargoTons, crewCount);
    }

    calculateShipStateForTurning(shipId, cargoTons, crewCount, crewType) {
      const state = this.calculateShipState(shipId, cargoTons, crewCount);
      if (!state) return null;

      const crewMod = ZEPHYR_CREW_MODIFIERS?.[crewType];
      const maneuverMultiplier = crewMod?.maneuverabilityMultiplier ?? 1;
      const maneuverability = Math.max(
        ZEPHYR_MIN_MANEUVERABILITY,
        state.maneuverability * maneuverMultiplier
      );

      return {
        ...state,
        maneuverability
      };
    }

    // Unified speed calculation used by UI and API
    calculateSpeed(shipId, windCourse, windForce, waves, bonusSails, crewType, helm, cargoTons, crewCount, useOars = false) {
      const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
      const wind = ZEPHYR_WIND_FORCES[windForce] || { mult: 1 };
      const wave = ZEPHYR_WAVES[waves] || { mult: 1 };
      const crewMod = ZEPHYR_CREW_MODIFIERS[crewType] || { multiplier: 1 };

      if (!ship) throw new Error("Invalid shipId for calculateSpeed");

      const shipState = this.calculateShipState(shipId, cargoTons, crewCount);
      if (!shipState) throw new Error("Unable to calculate ship state");

      // Convert windCourse to angle (0..180)
      const windAngle = this.courseToAngle(windCourse);

      // Base speed from polar diagram
      const basePolarSpeed = this.shipStateCalculator.calculatePolarSpeed(ship, windAngle, { windCourse });

      let speed = basePolarSpeed;

      // Bonus sails handling
      if (bonusSails && bonusSails !== "none") {
        const availableSails = ship.sailing?.sailConfig?.bonusSails || {};
        const bonusSail = availableSails[bonusSails];
        if (bonusSail && Array.isArray(bonusSail.requirements) && bonusSail.requirements.includes(windCourse)) {
          speed += bonusSail.bonus;
        }
      }

      // Oars handling
      if (useOars && ship.sailing?.oars?.available && windForce === "calm") {
        if (crewCount >= ship.sailing.oars.crewRequired) {
          speed = Math.max(speed, ship.sailing.oars.maxSpeed);
        } else {
          const ratio = Math.min(1, crewCount / ship.sailing.oars.crewRequired);
          speed += ship.sailing.oars.speedBonus * ratio;
        }
      }

      // Apply global multipliers
      speed *= wind.mult;
      speed *= wave.mult;
      speed *= crewMod.multiplier;
      speed *= shipState.speedMultiplier;

      // Wave resistance
      const waveHeight = this.getWaveHeight(waves);
      if (typeof ship.modifiers?.waveResistance === "function") {
        speed *= ship.modifiers.waveResistance(waveHeight);
      }

      // Helm gives fixed speed bonus
      if (helm) speed += 5;

      return Math.max(0.01, speed);
    }

    calculateTravelFromData(rawData = {}) {
      const data = this.normalizeInput(rawData);
      const ship = ZEPHYR_SHIPS_LIBRARY[data.ship];

      if (!ship) {
        throw new Error(`Ship '${data.ship}' not found`);
      }

      const speed = this.calculateSpeed(
        data.ship,
        data.windCourse,
        data.windForce,
        data.waves,
        data.bonusSails,
        data.crewType,
        data.helm,
        data.cargo,
        data.crewCount,
        data.useOars
      );
      const ftPerRound = speed * ZEPHYR_FT_PER_KNOT_PER_ROUND;

      const shipState = this.calculateShipStateForTurning(data.ship, data.cargo, data.crewCount, data.crewType);
      if (!shipState) throw new Error("Unable to calculate turning state");

      const windAngle = this.courseToAngle(data.windCourse);
      const turningData = this.shipStateCalculator.calculateTurningRadius(
        ship,
        shipState,
        speed,
        data.windForce,
        data.waves,
        windAngle
      );

      shipState.turnRadiusFt = turningData.radiusFt;
      shipState.turnRadiusM = turningData.radiusM;
      shipState.turningFactors = turningData.factors;

      const result = { speed, ftPerRound, shipState, turningData, input: data };

      if (data.mode === "distance") {
        const distNm = data.unit === "km" ? (data.distance / 1.852) : data.distance;
        const hours = distNm / Math.max(0.0001, speed);
        const d = Math.floor(hours / 24);
        const h = Math.floor(hours % 24);
        const m = Math.round((hours * 60) % 60);
        result.time = { days: d, hours: h, minutes: m };
        result.distance = data.distance;
        result.unit = data.unit;
      } else {
        const distNm = data.time * speed;
        result.distanceNm = distNm;
        result.distanceKm = distNm * 1.852;
        result.distanceMi = distNm;
        result.timeHours = data.time;
      }

      return result;
    }

    // Legacy signature kept for API compatibility
    calculateTravel(shipId, mode, distance, time, unit, windCourse, windForce, waves, bonusSails, crewType, helm, cargoTons, crewCount, useOars = false) {
      return this.calculateTravelFromData({
        ship: shipId,
        mode,
        distance,
        time,
        unit,
        windCourse,
        windForce,
        waves,
        bonusSails,
        crewType,
        helm,
        cargo: cargoTons,
        crewCount,
        useOars
      });
    }

    // Helper conversions and small accessors
    courseToAngle(windCourse) {
      const angleMap = {
        "45-close": 45,
        "60-close": 60,
        "90-cross": 90,
        "90-cross-sq": 90,
        "135-broad": 135,
        "180-run": 180
      };
      return angleMap[windCourse] ?? 90;
    }

    getWaveHeight(waves) {
      const heightMap = {
        "calm": 0.2,
        "ripple": 0.75,
        "wave": 1.5,
        "stwave": 3.0,
        "storm": 6.0
      };
      return heightMap[waves] ?? 0.5;
    }

    getAvailableBonusSails(shipId) {
      const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
      if (ship?.sailing?.sailConfig?.bonusSails) return ship.sailing.sailConfig.bonusSails;
      return { "none": { label: "Без дополнительных парусов", bonus: 0 } };
    }

    getShipDescription(shipId, cargoTons = 0, crewCount = 0) {
      const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
      if (!ship) return "";

      const state = this.calculateShipState(shipId, cargoTons, crewCount);
      if (!state) return "";

      const cargoPercent = Math.round((state.effectiveCargo / (ship.capacity.maxCargo || 1)) * 100);

      let features = "";
      if (ship.features) {
        features = `<br>• Особенности: ${ship.features.rigging || ""} ${ship.features.oars || ""}`;
      }

      let armament = "";
      if (ship.armament) {
        armament = `<br>• Вооружение: ${ship.armament.mainBattery?.count || 0}×${ship.armament.mainBattery?.caliber || ""}`;
      }

      let oarsInfo = "";
      if (ship.sailing?.oars?.available) {
        oarsInfo = `<br>• Весла: до ${ship.sailing.oars.maxSpeed} узлов в штиль (требуется ${ship.sailing.oars.crewRequired} гребцов)`;
      }

      return `
        <div style="font-size:1.3em;line-height:1.5;">
          <strong>${ship.name}</strong> <br><em>${ship.description}</em>
          <div style="margin-top:6px;">
            <strong>Характеристики:</strong><br>
            • Длина: ${ship.hull.length?.gundeck?.toFixed(1) ?? ship.hull.length?.toFixed?.(1) ?? "N/A"} м, Ширина: ${ship.hull.beam} м<br>
            • Осадка: ${state.currentDraft.toFixed(2)} м (порожняя: ${ship.hull.draft.empty} м, полная: ${ship.hull.draft.full} м)<br>
            • Водоизмещение: ${state.currentDisplacement.toFixed(0)} т<br>
            • Загруженность: ${state.effectiveCargo.toFixed(2)} т (включая экипаж ${state.crewWeightTons.toFixed(2)} т) — ${cargoPercent}%<br>
            • Экипаж: ${crewCount} / ${ship.capacity.crew?.optimal ?? ship.capacity.crew} (оптимальный)${features}${armament}${oarsInfo}
          </div>
        </div>
      `;
    }

    getShipMaxCargo(shipId) {
      const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
      return ship ? ship.capacity.maxCargo : 0;
    }

    hasOars(shipId) {
      const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
      return !!(ship?.sailing?.oars?.available);
    }
  }

  // Public API wrapper (singleton)
  return {
    _calculatorInstance: null,
    _uiInstance: null,

    registerSettings: function() {
      const calc = this.getInstance();
      calc.ensureSettingsRegistered();
      return calc;
    },

    getInstance: function() {
      ensureDependencies();
      if (!this._calculatorInstance) this._calculatorInstance = new TravelCalculator();
      return this._calculatorInstance;
    },

    // initialize returns singleton UI (does not create a new one each time)
    initialize: function() {
      const calc = this.getInstance();
      if (!this._uiInstance) {
        this._uiInstance = new TravelCalculatorUI(calc);
      }
      return this._uiInstance;
    },

    openCalculator: function() {
      const ui = this.initialize();
      ui.render();
      return ui;
    },

    toggleCalculator: function() {
      const ui = this.initialize();
      ui.toggle();
      return ui;
    },

    focusCalculator: function() {
      const ui = this.initialize();
      ui.focusDialog();
      return ui;
    },

    calculateShipSpeed: function(shipId, conditions = {}) {
      const calc = this.getInstance();
      const input = calc.normalizeInput({ ship: shipId, ...conditions });
      return calc.calculateSpeed(
        input.ship,
        input.windCourse,
        input.windForce,
        input.waves,
        input.bonusSails,
        input.crewType,
        input.helm,
        input.cargo,
        input.crewCount,
        input.useOars
      );
    },

    calculateTravel: function(conditions = {}) {
      const calc = this.getInstance();
      return calc.calculateTravelFromData(conditions);
    },

    getShip: function(shipId) { return ZEPHYR_SHIPS_LIBRARY[shipId]; },
    getAllShips: function() { return ZEPHYR_SHIPS_LIBRARY; }
  };
})();
