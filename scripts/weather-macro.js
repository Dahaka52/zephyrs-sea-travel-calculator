// Zephyr's Sea Travel Calculator — Weather Macro Command
// Macro now delegates to module UI instead of embedding the full dialog code.

var ZEPHYR_WEATHER_MACRO_COMMAND = `
if (game.seaTravelCalculator && game.seaTravelCalculator.openWeatherGenerator) {
  game.seaTravelCalculator.openWeatherGenerator();
} else {
  ui.notifications.error("Генератор погоды не инициализирован");
}
`;
