// Utility functions and small helpers for Zephyr module

/**
 * Create a travel macro (only one canonical implementation).
 * This file is loaded early (module.json order). main.js will call this.
 */
async function createTravelMacro() {
  try {
    const existingMacro = game.macros?.find(m => m.name === "Zephyr's Sea Travel Calculator");
    if (existingMacro) return;
    if (game.user?.isGM) {
      await Macro.create({
        name: "Zephyr's Sea Travel Calculator",
        type: "script",
        command: `if (game.seaTravelCalculator && game.seaTravelCalculator.toggleCalculator) {
  game.seaTravelCalculator.toggleCalculator();
} else {
  ui.notifications.error("Sea Travel Calculator не инициализирован");
}`,
        img: "icons/skills/trades/profession-sailing-ship.webp",
        flags: {}
      });
      console.log("Zephyr's Sea Travel Calculator | Travel macro created");
    }
  } catch (err) {
    console.error("Zephyr macro creation failed:", err);
  }
}

/**
 * Создаёт макрос генератора морской погоды (один раз при установке модуля).
 * Код макроса берётся из глобальной переменной ZEPHYR_WEATHER_MACRO_COMMAND
 * (определена в scripts/weather-macro.js, загружается раньше через module.json).
 */
async function createWeatherMacro() {
  try {
    const MACRO_NAME = "Генератор морской погоды";
    if (game.macros?.find(m => m.name === MACRO_NAME)) return;
    if (!game.user?.isGM) return;
    if (typeof ZEPHYR_WEATHER_MACRO_COMMAND === "undefined") {
      console.warn("Zephyr: ZEPHYR_WEATHER_MACRO_COMMAND не определён, weather-macro.js не загружен?");
      return;
    }
    await Macro.create({
      name: MACRO_NAME,
      type: "script",
      command: ZEPHYR_WEATHER_MACRO_COMMAND,
      img: "icons/magic/air/weather-clouds-rainbow.webp",
      flags: {}
    });
    console.log("Zephyr's Sea Travel Calculator | Weather macro created");
  } catch (err) {
    console.error("Zephyr weather macro creation failed:", err);
  }
}
