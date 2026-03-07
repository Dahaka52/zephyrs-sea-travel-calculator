# Zephyr's Sea Travel Calculator

Техническая документация модуля Foundry VTT для расчёта движения парусных судов в морских переходах (ориентирован на Foundry VTT v13 и настольные кампании DnD 5e).

## 1. Назначение

Модуль рассчитывает:

- текущую скорость судна в узлах;
- скорость в футах за раунд (6 секунд);
- время перехода по заданной дистанции или дистанцию по заданному времени;
- манёвренность и радиус разворота;
- влияние загрузки, состава экипажа, ветра, волнения, доп. парусов, вёсел и «штурвала».

Результаты показываются в интерфейсе калькулятора и отправляются в чат Foundry.

## 2. Совместимость и метаданные

- Идентификатор модуля: `zephyrs-sea-travel-calculator`
- Версия: `1.0.0`
- `module.json`:
  - `compatibility.minimum = 10`
  - `compatibility.verified = 13`

Фактически код проверен под современным API Foundry (диалоги, `Hooks`, `game.settings`, `ChatMessage`) и в первую очередь рассчитан на Foundry 13.

## 3. Структура проекта

```text
zephyrs-sea-travel-calculator/
├─ module.json                         # Манифест и порядок загрузки скриптов
├─ scripts/
│  ├─ constants.js                     # Глобальные константы (вес экипажа, конверсии и т.д.)
│  ├─ main.js                          # Hooks init/ready, экспорт API, создание макроса
│  ├─ data/
│  │  ├─ conditions.js                 # Курсы, сила ветра, волны, модификаторы экипажа
│  │  └─ ships.js                      # Библиотека кораблей и формулы по каждому судну
│  ├─ calculator/
│  │  ├─ ShipStateCalculator.js        # Расчёт состояния корпуса/груза/манёвренности
│  │  └─ TravelCalculator.js           # Основной singleton/API, расчёт скорости и перехода
│  ├─ ui/
│  │  ├─ TravelCalculatorUI.js         # Dialog UI, обработчики формы, live-расчёт
│  │  └─ ChatRenderer.js               # HTML-рендер отчёта и отправка в чат
│  └─ utils/
│     └─ helpers.js                    # Создание макроса для быстрого открытия калькулятора
├─ styles/
│  ├─ styles.css                       # Стили диалога и визуала
│  └─ sea-map.jpg                      # Фон интерфейса
└─ assets/                             # Доп. изображения для UI/чата
```

## 4. Порядок загрузки и жизненный цикл

Скрипты грузятся строго в порядке, указанном в `module.json`. Это критично, так как архитектура основана на глобальных переменных `var`:

1. `constants.js` -> базовые константы;
2. `conditions.js` + `ships.js` -> справочники;
3. `helpers.js` -> утилиты (макрос);
4. `ShipStateCalculator.js` -> вычислитель состояния;
5. `TravelCalculator.js` -> основной API;
6. `ChatRenderer.js`, `TravelCalculatorUI.js` -> UI и чат;
7. `main.js` -> инициализация через `Hooks`.

### Hooks

- `init`: лог и потенциальная точка расширения под регистрацию настроек/локализации.
- `ready`:
  - публикует API в `game.modules.get(id).api`, `window.SeaTravelCalculator`, `game.seaTravelCalculator`;
  - пытается создать макрос `Zephyr's Sea Travel Calculator` (только для GM).

## 5. Архитектура и взаимодействие компонентов

Архитектура слоистая:

- `data` слой: справочники условий и кораблей;
- `calculator` слой: физическая модель и математика;
- `ui` слой: сбор входных данных, live-перерасчёт, вывод в чат;
- `main` слой: встраивание в Foundry.

Главный поток:

1. Пользователь открывает UI через API/макрос.
2. `TravelCalculatorUI` читает текущие значения формы из `game.settings`.
3. UI вызывает `TravelCalculator.calculateSpeed()` и вспомогательные расчёты состояния.
4. Результат показывается в карточках интерфейса.
5. По кнопке отправки UI передаёт объект в `ChatRenderer.sendToChat()`.
6. `ChatRenderer` формирует HTML-отчёт и делает `ChatMessage.create()`.

## 6. Данные и доменная модель

## 6.1 Глобальные константы (`constants.js`)

- `ZEPHYR_AVG_CREW_WEIGHT_KG = 65`
- `ZEPHYR_DRAFT_PER_TON = 0.015`
- `ZEPHYR_FT_PER_KNOT_PER_ROUND = 6076.12 * (6/3600) ≈ 10.1269`
- `ZEPHYR_MIN_MANEUVERABILITY = 0.05`

## 6.2 Условия (`conditions.js`)

- `ZEPHYR_WIND_COURSES`: курсы к ветру (`45-close`, `90-cross`, `180-run` и т.п.).
- `ZEPHYR_WIND_FORCES`: мультипликатор скорости по силе ветра (`mult`).
- `ZEPHYR_WAVES`: мультипликатор скорости по волнению (`mult`).
- `ZEPHYR_CREW_MODIFIERS`:
  - `multiplier` влияет на скорость;
  - `maneuverabilityMultiplier` влияет на манёвренность.

## 6.3 Библиотека кораблей (`ships.js`)

Каждый корабль содержит:

- `hull`: геометрия, осадка, водоизмещение, `draftPerTon`;
- `sailing`: теоретическая скорость, полярная диаграмма, доступные курсы, радиус разворота, опциональные вёсла;
- `capacity`: груз, экипаж, запасы;
- `armament` и `features` (если есть);
- `modifiers`: функции-модификаторы (`cargoSpeedPenalty`, `maneuverability`, `waveResistance` и др.).

Поддерживаются как обычные полярные диаграммы, так и вариантные (`standard/square`) для разных типов парусов на том же курсе.

## 7. Расчётная модель

## 7.1 ShipStateCalculator.calculate()

Вход: `shipId`, `cargoTons`, `crewCount`.

Ключевые шаги:

1. `crewWeightTons = crewCount * 65 / 1000`
2. `effectiveCargo = cargoTons + crewWeightTons`
3. `cargoRatio = effectiveCargo / maxCargo`
4. `currentDraft = draft.empty + effectiveCargo * draftPerTon`
5. `currentDisplacement` интерполируется между `displacement` и `maxDisplacement`
6. `speedMultiplier`:
   - из `ship.modifiers.cargoSpeedPenalty(cargoRatio)`, если функция задана;
   - иначе fallback `1 - cargoRatio * 0.2` с ограничением минимумом.
7. `maneuverability`:
   - из `ship.modifiers.maneuverability(cargoRatio)`, если есть;
   - иначе минимум `ZEPHYR_MIN_MANEUVERABILITY`.

Выход: сводное состояние корпуса/груза/манёвренности.

## 7.2 Полярная скорость

`calculatePolarSpeed(ship, windAngle, { windCourse })`:

- выбирает нужную полярную диаграмму (`standard`/`square`, если применимо);
- ищет соседние углы и делает линейную интерполяцию коэффициента;
- возвращает `maxTheoreticalSpeed * polarCoeff`.

## 7.3 Итоговая скорость (TravelCalculator.calculateSpeed)

Порядок применения:

1. базовая полярная скорость;
2. бонус доп. парусов (если выбран и разрешён на текущем курсе);
3. вёсла в штиль:
   - либо форсированный минимум до `oars.maxSpeed` при достаточном экипаже;
   - либо частичный бонус при нехватке гребцов;
4. глобальные множители:
   - ветер (`ZEPHYR_WIND_FORCES[...].mult`);
   - волны (`ZEPHYR_WAVES[...].mult`);
   - тип экипажа (`ZEPHYR_CREW_MODIFIERS[...].multiplier`);
   - груз/состояние корпуса (`shipState.speedMultiplier`);
5. сопротивление волны через `ship.modifiers.waveResistance(waveHeight)`;
6. флаг `helm` добавляет `+5` узлов;
7. итог ограничивается минимумом `0.01`.

## 7.4 Радиус разворота

`calculateTurningRadius()` использует:

- базу: `LWL * turningRadius.base`;
- множители по диапазону скорости, ветру, волне, загрузке, курсу;
- деление на манёвренность;
- защита от `NaN/Infinity`.

Возвращается радиус в метрах и футах + набор факторов для диагностики.

## 7.5 Режимы перехода

- `mode = distance`: по дистанции (`км` или морские мили) считает время.
- `mode = time`: по времени в часах считает пройденную дистанцию (км и морские мили).

Конверсия в боевую шкалу:

- `ftPerRound = speed * ZEPHYR_FT_PER_KNOT_PER_ROUND` (в UI live-расчёта).

## 8. UI-слой (`TravelCalculatorUI`)

Функции интерфейса:

- рендер `Dialog` с полями параметров;
- динамическая адаптация доступных курсов и доп. парусов при смене корабля;
- отдельное отображение/включение блока вёсел только для судов, где они есть;
- автоматическая синхронизация волнения при смене силы ветра;
- live-обновление карточек результата;
- сохранение размеров/позиции окна через `ResizeObserver`.

Ключевые методы:

- `render()` / `closeDialog()`
- `initializeEventHandlers()`
- `getFormData()`
- `calculate()` и `displayResultCompact()`
- `calculateAndSend()` -> отправка в чат через `ChatRenderer`

## 9. Чат-отчёт (`ChatRenderer`)

Формирует HTML-карточку с:

- кораблём;
- скоростью и футами за раунд;
- манёвренностью и радиусом разворота;
- загрузкой/весом экипажа;
- режимом расчёта и условиями моря;
- итогом по дистанции/времени.

Отправка: `ChatMessage.create({ content, speaker })`.

## 10. Хранилище настроек (`game.settings`)

Модуль хранит:

- `lastInput` (`scope: world`) — последние входные параметры формы;
- `windowSettings` (`scope: client`) — размеры/позиция окна калькулятора.

Регистрация делается лениво внутри `TravelCalculator` при первом обращении.

## 11. Публичный API

После `ready` доступны:

- `game.seaTravelCalculator`
- `window.SeaTravelCalculator`
- `game.modules.get("zephyrs-sea-travel-calculator").api`

Методы API:

- `initialize()`
- `openCalculator()`
- `toggleCalculator()`
- `calculateShipSpeed(shipId, conditions)`
- `getShip(shipId)`
- `getAllShips()`
- `getInstance()` (доступ к экземпляру `TravelCalculator`)

Пример вызова из макроса:

```js
game.seaTravelCalculator.toggleCalculator();
```

Пример прямого вычисления:

```js
const speed = game.seaTravelCalculator.calculateShipSpeed("Sloop", {
  windCourse: "90-cross",
  windForce: "normal",
  waves: "wave",
  crewType: "experienced",
  crewCount: 8,
  cargo: 5,
  bonusSails: "mainsail",
  helm: false,
  useOars: false
});
```

## 12. Расширение модуля

### Добавление нового корабля

1. Добавить объект в `ZEPHYR_SHIPS_LIBRARY`:
   - уникальный `id`;
   - `hull`, `sailing`, `capacity`;
   - при необходимости `oars`, `bonusSails`, `modifiers`.
2. Проверить, что `availableCourses` согласованы с ключами `ZEPHYR_WIND_COURSES`.
3. Протестировать оба режима (`distance`/`time`) и отправку в чат.

### Добавление условий

- новые ключи ветра/волн/экипажа добавляются в `conditions.js`;
- UI подхватит их автоматически через `Object.entries(...)`.

### Изменение физической модели

- базовая математика: `ShipStateCalculator.js`, `TravelCalculator.js`;
- визуальное отображение: `TravelCalculatorUI.js`, `ChatRenderer.js`.

## 13. Технические нюансы и ограничения

- Архитектура на глобальных `var` чувствительна к порядку загрузки.
- В `calculateAndSend()` используется `ftPerRound = speed * 10`, а в live-расчёте — точная константа `ZEPHYR_FT_PER_KNOT_PER_ROUND`; это небольшая внутренняя несогласованность.
- Позиция окна (`top/left`) сохраняется, но при `render()` явно используется только `width` (высота и позиция применяются частично/косвенно).
- В репозитории есть дубли изображений карты (`sea-map.jpg` в нескольких папках), что можно оптимизировать.

## 14. Быстрая проверка после изменений

Рекомендуемый smoke-тест:

1. Открыть калькулятор макросом и через `game.seaTravelCalculator.toggleCalculator()`.
2. Проверить пересчёт при смене:
   - корабля;
   - силы ветра (и автоподстановки волнения);
   - загрузки и численности экипажа;
   - режима `distance/time`.
3. Отправить отчёт в чат и убедиться, что все поля заполнены корректно.
4. Перезайти в мир и проверить восстановление `lastInput`.

