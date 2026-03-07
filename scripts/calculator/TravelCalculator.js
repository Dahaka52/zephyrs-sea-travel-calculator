// TravelCalculator singleton module
if (typeof ZEPHYR_SHIPS_LIBRARY === 'undefined') {
  console.error("ZEPHYR_SHIPS_LIBRARY is not defined. Check loading order in module.json");
  var ZEPHYR_SHIPS_LIBRARY = {};
}

if (typeof ZEPHYR_WIND_COURSES === 'undefined') {
  var ZEPHYR_WIND_COURSES = {};
}
if (typeof ZEPHYR_WIND_FORCES === 'undefined') {
  var ZEPHYR_WIND_FORCES = {};
}
if (typeof ZEPHYR_WAVES === 'undefined') {
  var ZEPHYR_WAVES = {};
}
if (typeof ZEPHYR_CREW_MODIFIERS === 'undefined') {
  var ZEPHYR_CREW_MODIFIERS = {};
}

var SeaTravelCalculator = (() => {
  // Singleton instance of TravelCalculator
  let _calculatorInstance = null;

  class TravelCalculator {
    constructor() {
      this.shipStateCalculator = new ShipStateCalculator();
      this.lastData = this.loadLastInput();
      this.windowSettings = this.loadWindowSettings();
    }

    loadLastInput() {
      const key = `${ZEPHYR_MODULE_ID}.lastInput`;
      if (!game.settings.settings.has(key)) {
        game.settings.register(ZEPHYR_MODULE_ID, "lastInput", {
          scope: "world",
          config: false,
          type: Object,
          default: {
            ship: "Sloop",
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
          }
        });
      }
      return game.settings.get(ZEPHYR_MODULE_ID, "lastInput");
    }

    loadWindowSettings() {
      const key = `${ZEPHYR_MODULE_ID}.windowSettings`;
      if (!game.settings.settings.has(key)) {
        game.settings.register(ZEPHYR_MODULE_ID, "windowSettings", {
          scope: "client",
          config: false,
          type: Object,
          default: { width: 800, height: 600, top: null, left: null }
        });
      }
      return game.settings.get(ZEPHYR_MODULE_ID, "windowSettings");
    }

    saveLastInput(data) {
      game.settings.set(ZEPHYR_MODULE_ID, "lastInput", data);
      this.lastData = data;
    }

    saveWindowSettings(settings) {
      game.settings.set(ZEPHYR_MODULE_ID, "windowSettings", settings);
      this.windowSettings = settings;
    }

    calculateShipState(shipId, cargoTons, crewCount) {
      return this.shipStateCalculator.calculate(shipId, cargoTons, crewCount);
    }

    // Unified speed calculation used by UI and API
    calculateSpeed(shipId, windCourse, windForce, waves, bonusSails, crewType, helm, cargoTons, crewCount, useOars = false) {
      const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
      const wind = ZEPHYR_WIND_FORCES[windForce] || { mult: 1 };
      const wave = ZEPHYR_WAVES[waves] || { mult: 1 };
      const crewMod = ZEPHYR_CREW_MODIFIERS[crewType] || { multiplier: 1, maneuverabilityMultiplier: 1 };

      if (!ship) throw new Error("Invalid shipId for calculateSpeed");

      const shipState = this.calculateShipState(shipId, cargoTons, crewCount);

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
      if (useOars && ship.sailing?.oars?.available) {
        if (windForce === 'calm' && crewCount >= ship.sailing.oars.crewRequired) {
          speed = Math.max(speed, ship.sailing.oars.maxSpeed);
        } else if (windForce === 'calm') {
          speed += ship.sailing.oars.speedBonus * Math.min(1, (crewCount / ship.sailing.oars.crewRequired));
        }
      }

      // Apply global multipliers
      speed *= wind.mult;
      speed *= wave.mult;
      speed *= crewMod.multiplier;
      speed *= shipState.speedMultiplier;

      // Wave resistance (more complex function)
      const waveHeight = this.getWaveHeight(waves);
      if (typeof ship.modifiers?.waveResistance === 'function') {
        speed *= ship.modifiers.waveResistance(waveHeight);
      }

      // Helm gives fixed speed bonus (tuneable)
      if (helm) speed += 5;

      return Math.max(0.01, speed);
    }

    // Main travel calculation (distance or time mode)
    calculateTravel(shipId, mode, distance, time, unit, windCourse, windForce, waves, bonusSails, crewType, helm, cargoTons, crewCount, useOars = false) {
      const speed = this.calculateSpeed(shipId, windCourse, windForce, waves, bonusSails, crewType, helm, cargoTons, crewCount, useOars);
      const ftPerRound = speed * ZEPHYR_FT_PER_KNOT_PER_ROUND;

      const shipState = this.calculateShipState(shipId, cargoTons, crewCount);

      // Turning radius
      const windAngle = this.courseToAngle(windCourse);
      const turningData = this.shipStateCalculator.calculateTurningRadius(
        ZEPHYR_SHIPS_LIBRARY[shipId],
        shipState,
        speed,
        windForce,
        waves,
        windAngle
      );

      shipState.turnRadiusFt = turningData.radiusFt;
      shipState.turnRadiusM = turningData.radiusM;
      shipState.turningFactors = turningData.factors;

      let result = { speed, ftPerRound, shipState, turningData };

      if (mode === 'distance') {
        const distNm = unit === 'km' ? (distance / 1.852) : distance;
        const hours = distNm / speed;
        const d = Math.floor(hours / 24);
        const h = Math.floor(hours % 24);
        const m = Math.round((hours * 60) % 60);
        result.time = { days: d, hours: h, minutes: m };
        result.distance = distance;
        result.unit = unit;
      } else {
        const distNm = time * speed;
        const distanceKm = distNm * 1.852;
        const distanceMi = distNm;
        result.distanceNm = distNm;
        result.distanceKm = distanceKm;
        result.distanceMi = distanceMi;
        result.timeHours = time;
      }

      return result;
    }

    // Helper conversions and small accessors
    courseToAngle(windCourse) {
      const angleMap = {
        "45-close": 45, "60-close": 60, "90-cross": 90,
        "90-cross-sq": 90, "135-broad": 135, "180-run": 180
      };
      return angleMap[windCourse] ?? 90;
    }

    getWaveHeight(waves) {
      const heightMap = {
        "calm": 0.2, "ripple": 0.75, "wave": 1.5, 
        "stwave": 3.0, "storm": 6.0
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
      const cargoPercent = Math.round((state.effectiveCargo / (ship.capacity.maxCargo || 1)) * 100);

      let features = "";
      if (ship.features) {
        features = `<br>• Особенности: ${ship.features.rigging || ''} ${ship.features.oars || ''}`;
      }

      let armament = "";
      if (ship.armament) {
        armament = `<br>• Вооружение: ${ship.armament.mainBattery?.count || 0}×${ship.armament.mainBattery?.caliber || ''}`;
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
            • Длина: ${ship.hull.length?.gundeck?.toFixed(1) ?? ship.hull.length?.toFixed?.(1) ?? 'N/A'} м, Ширина: ${ship.hull.beam} м<br>
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
    // internal holders
    _calculatorInstance: null,
    _uiInstance: null,

    getInstance: function() {
      if (!this._calculatorInstance) this._calculatorInstance = new TravelCalculator();
      return this._calculatorInstance;
    },

    // initialize возвращает singleton UI (не создаёт новый каждый раз)
    initialize: function() {
      const calc = this.getInstance();
      if (!this._uiInstance) {
        this._uiInstance = new TravelCalculatorUI(calc);
      }
      return this._uiInstance;
    },

    openCalculator: function() {
      const ui = this.initialize();
      // render() уже проверяет this.dialog и закроет/переключит при необходимости
      ui.render();
    },

    toggleCalculator: function() {
      // Получаем singleton UI — если уже есть dialog — фокусируем, иначе открываем
      const ui = this.initialize();

      try {
        // Если диалог уже существует в UI — поднимаем окно и фокусируем
        if (ui && ui.dialog) {
          // Найдём обёртку window-app для этого диалога
          const dialogEl = document.querySelector('.zephyr-calculator, .zephyrs-sea-travel-calculator');
          const winApp = dialogEl?.closest?.('.app.window-app');
          if (winApp) {
            // Выясним текущий max z-index среди окон и поднимем это окно выше
            const allWindowApps = Array.from(document.querySelectorAll('.app.window-app'));
            let maxZ = allWindowApps.reduce((m, w) => {
              const z = parseInt(window.getComputedStyle(w).zIndex) || 0;
              return Math.max(m, z);
            }, 0);
            winApp.style.zIndex = (maxZ + 1).toString();
            const focusable = winApp.querySelector('input, select, textarea, button, [tabindex]');
            if (focusable && typeof focusable.focus === 'function') focusable.focus();
            return;
          }
        }

        // Иначе — просто открыть UI (render создаст диалог)
        ui.render();
      } catch (e) {
        console.error("Zephyr: toggleCalculator error", e);
        // На случай ошибки — попытаемся открыть заново
        try { ui.render(); } catch (e2) { console.error("Zephyr: fallback render failed", e2); }
      }
    },

    // convenience wrappers unchanged...
    calculateShipSpeed: function(shipId, conditions = {}) {
      const calc = this.getInstance();
      return calc.calculateSpeed(
        shipId,
        conditions.windCourse || '90-cross',
        conditions.windForce || 'normal',
        conditions.waves || 'calm',
        conditions.bonusSails || 'none',
        conditions.crewType || 'experienced',
        conditions.helm || false,
        conditions.cargo || 0,
        conditions.crewCount || 0,
        conditions.useOars || false
      );
    },

    getShip: function(shipId) { return ZEPHYR_SHIPS_LIBRARY[shipId]; },
    getAllShips: function() { return ZEPHYR_SHIPS_LIBRARY; }
  };
})();
