// Weather and condition constants
var ZEPHYR_WIND_COURSES = {
  "0-dead": { label: "Встречный 0°", label_en: "Headwind 0°", description: "Мертвая зона", description_en: "No-go zone", angle: 0 },
  "15-close": { label: "Крутой бейдевинд 15°", label_en: "Close-hauled 15°", description: "Очень острый курс", description_en: "Very tight course", angle: 15 },
  "30-close": { label: "Бейдевинд 30°", label_en: "Close-hauled 30°", description: "Острый курс", description_en: "Tight course", angle: 30 },
  "45-close": { label: "Бейдевинд 45°", label_en: "Close-hauled 45°", description: "Острый курс", description_en: "Tight course", angle: 45 },
  "60-close": { label: "Бейдевинд 60°", label_en: "Close reach 60°", description: "Низкая скорость", description_en: "Lower speed", angle: 60 },
  "75-close": { label: "Бейдевинд 75°", label_en: "Close reach 75°", description: "Переход к галфвинду", description_en: "Transition to beam reach", angle: 75 },
  "90-cross": { label: "Галфвинд 90°", label_en: "Beam reach 90°", description: "Средняя скорость", description_en: "Medium speed", angle: 90 },
  "90-cross-sq": { label: "Галфвинд 90° (с прямыми)", label_en: "Beam reach 90° (square)", description: "Боковой, с разными парусами", description_en: "Beam reach, mixed sails", angle: 90 },
  "105-broad": { label: "Полубакштаг 105°", label_en: "Broad reach 105°", description: "Переход к бакштагу", description_en: "Transition to broad reach", angle: 105 },
  "120-broad": { label: "Бакштаг 120°", label_en: "Broad reach 120°", description: "Хорошая скорость", description_en: "Good speed", angle: 120 },
  "135-broad": { label: "Бакштаг 135°", label_en: "Broad reach 135°", description: "Хорошая скорость", description_en: "Good speed", angle: 135 },
  "150-run": { label: "Полный 150°", label_en: "Run 150°", description: "Переход к фордевинду", description_en: "Transition to run", angle: 150 },
  "165-run": { label: "Фордевинд 165°", label_en: "Run 165°", description: "Попутный ветер", description_en: "Following wind", angle: 165 },
  "180-run": { label: "Фордевинд 180°", label_en: "Run 180°", description: "Полный попутный", description_en: "Full following wind", angle: 180 }
};

var ZEPHYR_WIND_FORCES = {
  "calm": { label: "Штиль (<5 узлов)", label_en: "Calm (<5 kn)", mult: 0.1, description: "Практически нет ветра", description_en: "Little to no wind" },
  "weak": { label: "Лёгкий бриз (5–10 узлов)", label_en: "Light breeze (5–10 kn)", mult: 0.5, description: "Слабый ветер", description_en: "Light wind" },
  "normal": { label: "Свежий бриз (10–20 узлов)", label_en: "Fresh breeze (10–20 kn)", mult: 1, description: "Идеальные условия", description_en: "Ideal conditions" },
  "strong": { label: "Крепкий бриз (20–40 узлов)", label_en: "Strong breeze (20–40 kn)", mult: 1.3, description: "Мощный ветер", description_en: "Strong wind" },
  "storm": { label: "Шторм (>40 узлов)", label_en: "Storm (>40 kn)", mult: 0.5, description: "Опасно", description_en: "Dangerous" }
};

var ZEPHYR_WAVES = {
  "calm": { label: "Рябь (до 0,5 м)", label_en: "Ripples (up to 0.5 m)", mult: 1, description: "Идеальная поверхность", description_en: "Ideal surface" },
  "ripple": { label: "Барашки (0,5–1 м)", label_en: "Whitecaps (0.5–1 m)", mult: 0.95, description: "Небольшие волны", description_en: "Small waves" },
  "wave": { label: "Волнение (1-2 м)", label_en: "Seas (1–2 m)", mult: 0.85, description: "Снижение скорости", description_en: "Speed reduction" },
  "stwave": { label: "Неспокойное море (2–4 м)", label_en: "Rough sea (2–4 m)", mult: 0.7, description: "Сильно влияет", description_en: "Strong impact" },
  "storm": { label: "Шторм (4–8+ м)", label_en: "Storm (4–8+ m)", mult: 0.3, description: "Очень опасно", description_en: "Very dangerous" }
};

var ZEPHYR_CREW_MODIFIERS = {
  "novice": { 
    label: "Салаги", 
    label_en: "Novice", 
    multiplier: 0.8, 
    maneuverabilityMultiplier: 0.7, 
    description: "Неопытный экипаж",
    description_en: "Inexperienced crew"
  },
  "experienced": { 
    label: "Опытные", 
    label_en: "Experienced",
    multiplier: 1.0, 
    maneuverabilityMultiplier: 1.0, 
    description: "Хорошие матросы",
    description_en: "Skilled crew"
  }
};
