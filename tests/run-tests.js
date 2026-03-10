const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

function createSettingsMock() {
  const defs = new Map();
  const values = new Map();

  return {
    settings: defs,
    register(moduleId, key, config) {
      const fullKey = `${moduleId}.${key}`;
      if (!defs.has(fullKey)) defs.set(fullKey, config);
      if (!values.has(fullKey)) values.set(fullKey, structuredClone(config.default));
    },
    get(moduleId, key) {
      const fullKey = `${moduleId}.${key}`;
      if (!values.has(fullKey)) {
        const def = defs.get(fullKey);
        return def ? structuredClone(def.default) : undefined;
      }
      return structuredClone(values.get(fullKey));
    },
    set(moduleId, key, value) {
      const fullKey = `${moduleId}.${key}`;
      values.set(fullKey, structuredClone(value));
      return Promise.resolve(value);
    }
  };
}

function loadCalculatorContext() {
  const context = {
    console,
    Math,
    Number,
    parseInt,
    parseFloat,
    isFinite,
    Object,
    Array,
    Promise,
    structuredClone,
    setTimeout,
    clearTimeout,
    game: {
      settings: createSettingsMock(),
      modules: new Map(),
      user: { isGM: true },
      macros: [],
      seaTravelCalculator: null
    },
    window: {},
    document: {
      querySelector: () => null,
      querySelectorAll: () => []
    },
    ui: {
      windows: {},
      notifications: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined
      }
    },
    Dialog: function DialogStub() {
      throw new Error("Dialog should not be used in unit tests");
    },
    ChatMessage: {
      create: () => undefined,
      getSpeaker: () => ({})
    },
    Macro: {
      create: async () => undefined
    }
  };

  vm.createContext(context);

  const scripts = [
    "scripts/constants.js",
    "scripts/data/conditions.js",
    "scripts/data/ships.js",
    "scripts/calculator/ShipStateCalculator.js",
    "scripts/calculator/TravelCalculator.js"
  ];

  for (const relPath of scripts) {
    const absPath = path.resolve(__dirname, "..", relPath);
    const code = fs.readFileSync(absPath, "utf8");
    vm.runInContext(code, context, { filename: relPath });
  }

  return context;
}

const ctx = loadCalculatorContext();
const api = ctx.SeaTravelCalculator;
const calc = api.getInstance();

test("settings are registered in client scope", () => {
  const key = `${ctx.ZEPHYR_MODULE_ID}.lastInput`;
  const setting = ctx.game.settings.settings.get(key);
  assert.equal(setting.scope, "client");
});

test("calculatePolarSpeed interpolates coefficients correctly", () => {
  const ship = ctx.ZEPHYR_SHIPS_LIBRARY.leRequinXebec;
  const speed = calc.shipStateCalculator.calculatePolarSpeed(ship, 52.5, {});
  assert.ok(Math.abs(speed - 11.875) < 0.0001);
});

test("calculateSpeed returns stable baseline value for Sloop", () => {
  const speed = calc.calculateSpeed(
    "Sloop",
    "90-cross",
    "normal",
    "calm",
    "none",
    "experienced",
    false,
    0,
    8,
    false
  );
  assert.ok(Math.abs(speed - 6.4596) < 0.01);
});

test("calculateTravelFromData supports both distance and time modes", () => {
  const distanceResult = calc.calculateTravelFromData({
    ship: "Sloop",
    mode: "distance",
    distance: 18.52,
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
  });

  assert.ok(distanceResult.time);
  assert.equal(distanceResult.input.mode, "distance");
  assert.equal(distanceResult.input.unit, "km");

  const timeResult = calc.calculateTravelFromData({
    ship: "Sloop",
    mode: "time",
    time: 3,
    windCourse: "90-cross",
    windForce: "normal",
    waves: "calm",
    bonusSails: "none",
    crewType: "experienced",
    crewCount: 8,
    helm: false,
    cargo: 0,
    useOars: false
  });

  assert.equal(timeResult.input.mode, "time");
  assert.ok(Math.abs(timeResult.distanceNm - (timeResult.speed * 3)) < 0.0001);
});

test("novice crew has lower speed and larger turn radius than experienced crew", () => {
  const experienced = calc.calculateTravelFromData({
    ship: "Sloop",
    mode: "distance",
    distance: 10,
    unit: "km",
    windCourse: "90-cross",
    windForce: "normal",
    waves: "wave",
    bonusSails: "none",
    crewType: "experienced",
    crewCount: 8,
    helm: false,
    cargo: 5,
    useOars: false
  });

  const novice = calc.calculateTravelFromData({
    ship: "Sloop",
    mode: "distance",
    distance: 10,
    unit: "km",
    windCourse: "90-cross",
    windForce: "normal",
    waves: "wave",
    bonusSails: "none",
    crewType: "novice",
    crewCount: 8,
    helm: false,
    cargo: 5,
    useOars: false
  });

  assert.ok(novice.speed < experienced.speed);
  assert.ok(novice.shipState.turnRadiusFt > experienced.shipState.turnRadiusFt);
});
