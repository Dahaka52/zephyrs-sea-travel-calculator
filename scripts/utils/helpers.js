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
