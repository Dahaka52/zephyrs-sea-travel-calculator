// Weather and condition constants
var ZEPHYR_WIND_COURSES = {
  "45-close": { label: "Крутой бейдевинд ≈45°", description: "Минимальная скорость" },
  "60-close": { label: "Бейдевинд ≈60°", description: "Низкая скорость" },
  "90-cross": { label: "Галфвинд 90°", description: "Средняя скорость" },
  "90-cross-sq": { label: "Галфвинд 90° (с прямыми)", description: "Боковой, с разными парусами" },
  "135-broad": { label: "Бакштаг ≈135°", description: "Хорошая скорость" },
  "180-run": { label: "Фордевинд 180°", description: "Максимальная скорость" }
};

var ZEPHYR_WIND_FORCES = {
  "calm": { label: "Штиль (<5 узлов)", mult: 0.1, description: "Практически нет ветра" },
  "weak": { label: "Лёгкий бриз (5–10 узлов)", mult: 0.5, description: "Слабый ветер" },
  "normal": { label: "Свежий бриз (10–20 узлов)", mult: 1, description: "Идеальные условия" },
  "strong": { label: "Крепкий бриз (20–40 узлов)", mult: 1.3, description: "Мощный ветер" },
  "storm": { label: "Шторм (>40 узлов)", mult: 0.5, description: "Опасно" }
};

var ZEPHYR_WAVES = {
  "calm": { label: "Рябь (до 0,5 м)", mult: 1, description: "Идеальная поверхность" },
  "ripple": { label: "Барашки (0,5–1 м)", mult: 0.95, description: "Небольшие волны" },
  "wave": { label: "Волнение (1-2 м)", mult: 0.85, description: "Снижение скорости" },
  "stwave": { label: "Неспокойное море (2–4 м)", mult: 0.7, description: "Сильно влияет" },
  "storm": { label: "Шторм (4–8+ м)", mult: 0.3, description: "Очень опасно" }
};

var ZEPHYR_CREW_MODIFIERS = {
  "novice": { 
    label: "Салаги", 
    multiplier: 0.8, 
    maneuverabilityMultiplier: 0.7, 
    description: "Неопытный экипаж" 
  },
  "experienced": { 
    label: "Опытные", 
    multiplier: 1.0, 
    maneuverabilityMultiplier: 1.0, 
    description: "Хорошие матросы" 
  }
};
