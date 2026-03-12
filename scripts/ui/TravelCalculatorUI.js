class TravelCalculatorUI {
  constructor(calculator) {
    this.calculator = calculator;
    this.dialog = null;
    this.resizeObserver = null;
    this.chatRenderer = new ChatRenderer();

    this.saveDebounceMs = 300;
    this.pendingSaveTimer = null;
    this.pendingLastInput = null;

    this.trackedWindowElement = null;
    this.onWindowMouseUp = null;
  }

  getDialogElement() {
    if (!this.dialog?.appId) return null;
    return document.querySelector(`.app.window-app[data-appid="${this.dialog.appId}"]`);
  }

  render() {
    if (this.dialog) {
      this.focusDialog();
      return;
    }

    const content = this.createDialogContent();
    const ws = this.calculator.windowSettings || { width: 800, height: 600, top: null, left: null };
    const options = {
      width: ws.width || 800,
      height: ws.height || 600,
      resizable: true,
      classes: ["zephyr-calculator"]
    };

    if (Number.isFinite(ws.top)) options.top = ws.top;
    if (Number.isFinite(ws.left)) options.left = ws.left;

    this.dialog = new Dialog({
      title: "🧭 Калькулятор морского перехода",
      content,
      buttons: {
        calculate: {
          label: "<i class='fas fa-ship'></i> Рассчитать и отправить в чат",
          callback: html => {
            this.calculateAndSend(html);
            return false;
          }
        },
        close: {
          label: "<i class='fas fa-times'></i> Закрыть",
          callback: () => {
            if (this.dialog) this.dialog.close();
          }
        }
      },
      render: html => this.initializeEventHandlers(html),
      default: "calculate",
      close: () => this.closeDialog()
    }, options);

    this.dialog.render(true);
    setTimeout(() => this.setupWindowTracking(), 0);
  }

  toggle() {
    if (this.dialog) {
      this.dialog.close();
      return;
    }
    this.render();
  }

  focusDialog() {
    if (!this.dialog) return;

    try {
      if (typeof this.dialog.bringToTop === "function") {
        this.dialog.bringToTop();
      }

      const dialogElement = this.getDialogElement();
      if (dialogElement) {
        const focusable = dialogElement.querySelector("input, select, textarea, button, [tabindex]");
        if (focusable && typeof focusable.focus === "function") focusable.focus();
      }
    } catch (e) {
      console.warn("Zephyr: could not focus calculator dialog", e);
    }
  }

  setupWindowTracking() {
    const dialogElement = this.getDialogElement();
    if (!dialogElement) return;

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.saveWindowPosition());
      this.resizeObserver.observe(dialogElement);
    }

    const jqElement = $(dialogElement);
    this.trackedWindowElement = jqElement;
    this.onWindowMouseUp = () => setTimeout(() => this.saveWindowPosition(), 100);
    jqElement.on("mouseup", this.onWindowMouseUp);
  }

  teardownWindowTracking() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.trackedWindowElement && this.onWindowMouseUp) {
      this.trackedWindowElement.off("mouseup", this.onWindowMouseUp);
    }

    this.trackedWindowElement = null;
    this.onWindowMouseUp = null;
  }

  saveWindowPosition() {
    const dialogElement = this.getDialogElement();
    if (!dialogElement) return;

    const rect = dialogElement.getBoundingClientRect();
    const settings = {
      width: Math.round(rect.width),
      height: Math.min(Math.round(rect.height), Math.round(window.innerHeight * 0.9)),
      top: Math.round(rect.top),
      left: Math.round(rect.left)
    };

    this.calculator.saveWindowSettings(settings);
  }

  scheduleSave(html) {
    this.pendingLastInput = this.getFormData(html);

    if (this.pendingSaveTimer) {
      clearTimeout(this.pendingSaveTimer);
    }

    this.pendingSaveTimer = setTimeout(() => {
      this.flushPendingSave();
    }, this.saveDebounceMs);
  }

  flushPendingSave() {
    if (this.pendingSaveTimer) {
      clearTimeout(this.pendingSaveTimer);
      this.pendingSaveTimer = null;
    }

    if (!this.pendingLastInput) return;
    this.calculator.saveLastInput(this.pendingLastInput);
    this.pendingLastInput = null;
  }

  closeDialog() {
    this.flushPendingSave();
    this.saveWindowPosition();
    this.teardownWindowTracking();
    this.dialog = null;
  }

  // adjustDialogHeight() — удалено: с flex-схемой height:100% Foundry
  // сам корректно управляет высотой при ресайзе.
  adjustDialogHeight() {}

  getAvailableBonusSails(shipId) {
    return this.calculator.getAvailableBonusSails(shipId);
  }

  getShipMaxCargo(shipId) {
    return this.calculator.getShipMaxCargo(shipId);
  }

  getShipDescription(shipId, cargoTons = 0, crewCount = 0) {
    return this.calculator.getShipDescription(shipId, cargoTons, crewCount);
  }

  createDialogContent() {
    const data = this.calculator.normalizeInput(this.calculator.lastData || {});
    const ship = ZEPHYR_SHIPS_LIBRARY[data.ship];

    if (!ship) {
      console.error(`Ship not found: ${data.ship}`);
      return `<div class="calc-container"><div class="calc-content">Ошибка: корабль не найден</div></div>`;
    }

    const availableSails = this.getAvailableBonusSails(data.ship);
    const maxCargo = this.getShipMaxCargo(data.ship);
    const shipCourses = ship.sailing?.availableCourses || Object.keys(ZEPHYR_WIND_COURSES);

    return `
<div class="calc-container">
  <div class="calc-content">
    <div class="calc-row">
      <div class="calc-label">Корабль:</div>
      <div class="calc-control">
        <select id="shipSelect">
          ${Object.values(ZEPHYR_SHIPS_LIBRARY).map(s =>
            `<option value="${s.id}" ${data.ship === s.id ? "selected" : ""}>${s.name}</option>`
          ).join("")}
        </select>
      </div>
    </div>

    <div id="shipInfo" class="ship-info">${this.getShipDescription(data.ship, data.cargo, data.crewCount || 0)}</div>

    <div class="calc-row">
      <div class="calc-label">Режим расчета:</div>
      <div class="calc-control">
        <select id="mode">
          <option value="distance" ${data.mode === "distance" ? "selected" : ""}>По дистанции</option>
          <option value="time" ${data.mode === "time" ? "selected" : ""}>По времени</option>
        </select>
      </div>
    </div>

    <div class="mode-distance" style="display:${data.mode === "distance" ? "block" : "none"}">
      <div class="calc-row">
        <div class="calc-label">Дистанция:</div>
        <div class="calc-control">
          <input type="number" id="distance" value="${data.distance}" min="0" step="1" style="width:100px;" />
        </div>
      </div>
      <div class="calc-row">
        <div class="calc-label">Единицы:</div>
        <div class="calc-control">
          <select id="unit">
            <option value="km" ${data.unit === "km" ? "selected" : ""}>Километры</option>
            <option value="mi" ${data.unit === "mi" ? "selected" : ""}>Морские мили</option>
          </select>
        </div>
      </div>
    </div>

    <div class="mode-time" style="display:${data.mode === "time" ? "block" : "none"}">
      <div class="calc-row">
        <div class="calc-label">Время (ч):</div>
        <div class="calc-control">
          <input type="number" id="time" value="${data.time}" min="0" step="0.5" style="width:100px;" />
        </div>
      </div>
    </div>

    <div class="calc-row">
      <div class="calc-label">Курс к ветру:</div>
      <div class="calc-control">
        <select id="windCourse">
          ${shipCourses.map(k =>
            `<option value="${k}" ${data.windCourse === k ? "selected" : ""}>${ZEPHYR_WIND_COURSES[k]?.label ?? k}</option>`
          ).join("")}
        </select>
      </div>
    </div>

    <div class="calc-row">
      <div class="calc-label">Сила ветра:</div>
      <div class="calc-control">
        <select id="windForce">
          ${Object.entries(ZEPHYR_WIND_FORCES).map(([k, f]) =>
            `<option value="${k}" ${data.windForce === k ? "selected" : ""}>${f.label}</option>`
          ).join("")}
        </select>
      </div>
    </div>

    <div class="calc-row">
      <div class="calc-label">Волнение:</div>
      <div class="calc-control">
        <select id="waves">
          ${Object.entries(ZEPHYR_WAVES).map(([k, w]) =>
            `<option value="${k}" ${data.waves === k ? "selected" : ""}>${w.label}</option>`
          ).join("")}
        </select>
      </div>
    </div>

    <div class="calc-row">
      <div class="calc-label">Тип экипажа:</div>
      <div class="calc-control">
        <select id="crewType">
          ${Object.entries(ZEPHYR_CREW_MODIFIERS).map(([k, c]) =>
            `<option value="${k}" ${data.crewType === k ? "selected" : ""}>${c.label}</option>`
          ).join("")}
        </select>
      </div>
    </div>

    <div class="calc-row">
      <div class="calc-label">Кол-во экипажа (чел):</div>
      <div class="calc-control">
        <input type="number" id="crewCount" value="${data.crewCount || 8}" min="0" step="1" style="width:100px;" />
      </div>
    </div>

    <div class="calc-row">
      <div class="calc-label">Доп. паруса:</div>
      <div class="calc-control">
        <select id="bonusSails">
          ${Object.entries(availableSails).map(([k, s]) =>
            `<option value="${k}" ${data.bonusSails === k ? "selected" : ""}>${s.label}</option>`
          ).join("")}
        </select>
      </div>
    </div>

    <div class="calc-row">
      <div class="calc-label">Загрузка (тонны):</div>
      <div class="calc-control">
        <div class="cargo-slider">
          <input type="range" id="cargo" min="0" max="${maxCargo}" step="0.1" value="${data.cargo}">
          <div id="cargoValue" class="cargo-value">${data.cargo} т</div>
        </div>
      </div>
    </div>

    <div class="calc-row">
      <div class="calc-label">Штурвал ветра и воды:</div>
      <div class="calc-control calc-inline-control">
        <input type="checkbox" id="helm" ${data.helm ? "checked" : ""} />
        <span class="calc-inline-note">+5 узлов в любых условиях</span>
      </div>
    </div>

    ${ship.sailing?.oars?.available ? `
    <div class="calc-row oars-row">
      <div class="calc-label">Исп. весла:</div>
      <div class="calc-control calc-inline-control">
        <input type="checkbox" id="useOars" ${data.useOars ? "checked" : ""} />
        <span class="calc-inline-note">${ship.sailing.oars.maxSpeed} узлов в штиль (требуется ${ship.sailing.oars.crewRequired} чел)</span>
      </div>
    </div>
    ` : ""}

    <div id="calcResult" class="result-panel">
      <div class="result-card">
        <div class="label">Скорость</div>
        <div class="value" id="res-speed">—</div>
        <div style="font-size:1em;color:#b0bec5;" id="res-ft">—</div>
      </div>
      <div class="result-card">
        <div class="label">Дистанция / Время</div>
        <div id="res-dist">—</div>
        <div style="font-size:1em;color:#b0bec5;" id="res-extra">—</div>
      </div>
      <div class="result-card">
        <div class="label">Манёвренность</div>
        <div id="res-mano">—</div>
        <div style="font-size:1em;color:#b0bec5;" id="res-radius">—</div>
      </div>
      <div class="result-card">
        <div class="label">Загрузка / Экипаж</div>
        <div id="res-cargo">—</div>
        <div style="font-size:1em;color:#b0bec5;" id="res-crew">—</div>
      </div>
    </div>
  </div>
</div>`;
  }

  initializeEventHandlers(html) {
    const recalcAndQueueSave = () => {
      this.calculate(html);
      this.scheduleSave(html);
    };

    html.find("#mode").on("change", () => {
      this.updateMode(html);
      recalcAndQueueSave();
    });

    html.find("#windForce").on("change", () => {
      const windForce = html.find("#windForce").val();
      let newWave = "calm";

      switch (windForce) {
        case "calm": newWave = "calm"; break;
        case "weak": newWave = "ripple"; break;
        case "normal": newWave = "wave"; break;
        case "strong": newWave = "stwave"; break;
        case "storm": newWave = "storm"; break;
      }

      html.find("#waves").val(newWave);
      recalcAndQueueSave();
    });

    html.find("#shipSelect").on("change", () => {
      this.updateShip(html);
      recalcAndQueueSave();
    });

    html.find("#cargo").on("input change", () => {
      const cargoValue = parseFloat(html.find("#cargo").val()) || 0;
      html.find("#cargoValue").text(`${cargoValue.toFixed(1)} т`);
      this.updateShipInfo(html);
      recalcAndQueueSave();
    });

    html.find("#crewCount").on("input change", () => {
      this.updateCargoLimits(html);
      this.updateShipInfo(html);
      recalcAndQueueSave();
    });

    html.find("#windCourse, #waves, #crewType, #bonusSails, #helm, #distance, #time, #unit")
      .on("input change", () => recalcAndQueueSave());

    html.on("change", "#useOars", () => recalcAndQueueSave());

    this.updateMode(html);
    this.updateCargoLimits(html);
    this.calculate(html);
  }

  updateMode(html) {
    const mode = html.find("#mode").val();
    html.find(".mode-distance").toggle(mode === "distance");
    html.find(".mode-time").toggle(mode === "time");
  }

  updateShip(html) {
    const shipId = html.find("#shipSelect").val();
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];

    if (!ship) return;

    const currentCourse = html.find("#windCourse").val();
    const currentBonusSails = html.find("#bonusSails").val();
    const currentUseOars = html.find("#useOars").is(":checked");
    const shipCourses = ship.sailing?.availableCourses || Object.keys(ZEPHYR_WIND_COURSES);

    const windSelect = html.find("#windCourse");
    windSelect.empty();
    shipCourses.forEach(k => {
      windSelect.append(`<option value="${k}">${ZEPHYR_WIND_COURSES[k]?.label ?? k}</option>`);
    });
    windSelect.val(shipCourses.includes(currentCourse) ? currentCourse : shipCourses[0]);

    const availableSails = this.getAvailableBonusSails(shipId);
    const bonusSailsSelect = html.find("#bonusSails");
    bonusSailsSelect.empty();
    Object.entries(availableSails).forEach(([k, s]) => {
      bonusSailsSelect.append(`<option value="${k}">${s.label}</option>`);
    });
    if (Object.prototype.hasOwnProperty.call(availableSails, currentBonusSails)) {
      bonusSailsSelect.val(currentBonusSails);
    }

    this.updateOarsOption(html, shipId);
    if (ship.sailing?.oars?.available) {
      html.find("#useOars").prop("checked", currentUseOars);
    }

    this.updateCargoLimits(html);
    this.updateShipInfo(html);
  }

  updateOarsOption(html, shipId) {
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    const hasOars = ship?.sailing?.oars?.available;
    const existingOarsRow = html.find(".oars-row");

    if (hasOars && existingOarsRow.length === 0) {
      const oarsHTML = `
      <div class="calc-row oars-row">
        <div class="calc-label">Исп. весла:</div>
        <div class="calc-control calc-inline-control">
          <input type="checkbox" id="useOars" />
          <span class="calc-inline-note">${ship.sailing.oars.maxSpeed} узлов в штиль (требуется ${ship.sailing.oars.crewRequired} чел)</span>
        </div>
      </div>`;

      html.find("#helm").closest(".calc-row").after(oarsHTML);
    } else if (!hasOars && existingOarsRow.length > 0) {
      existingOarsRow.remove();
    }
  }

  updateCargoLimits(html) {
    const shipId = html.find("#shipSelect").val();
    const crewCount = parseInt(html.find("#crewCount").val() || 0, 10);
    const maxCargoTotal = this.getShipMaxCargo(shipId);
    const crewWeight = (crewCount * ZEPHYR_AVG_CREW_WEIGHT_KG) / 1000.0;
    const sliderMax = Math.max(0, maxCargoTotal - crewWeight);

    const cargoEl = html.find("#cargo");
    cargoEl.attr("max", sliderMax);

    let cargoVal = parseFloat(cargoEl.val() || 0);
    if (cargoVal > sliderMax) {
      cargoVal = sliderMax;
      cargoEl.val(cargoVal);
    }

    if (crewWeight >= maxCargoTotal) {
      cargoEl.prop("disabled", true);
      cargoEl.val(0);
      html.find("#cargoValue").text("0.0 т");
    } else {
      cargoEl.prop("disabled", false);
      html.find("#cargoValue").text(`${cargoVal.toFixed(1)} т`);
    }
  }

  updateShipInfo(html) {
    const shipId = html.find("#shipSelect").val();
    const cargo = parseFloat(html.find("#cargo").val()) || 0;
    const crewCount = parseInt(html.find("#crewCount").val() || 0, 10);
    html.find("#shipInfo").html(this.getShipDescription(shipId, cargo, crewCount));
  }

  getFormData(html) {
    const shipId = html.find("#shipSelect").val();
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    const hasOars = !!(ship?.sailing?.oars?.available);

    return {
      ship: shipId,
      mode: html.find("#mode").val(),
      distance: parseFloat(html.find("#distance").val()) || 0,
      time: parseFloat(html.find("#time").val()) || 0,
      unit: html.find("#unit").val(),
      windCourse: html.find("#windCourse").val(),
      windForce: html.find("#windForce").val(),
      waves: html.find("#waves").val(),
      bonusSails: html.find("#bonusSails").val(),
      crewType: html.find("#crewType").val(),
      crewCount: parseInt(html.find("#crewCount").val() || 0, 10),
      helm: !!html.find("#helm")[0]?.checked,
      cargo: parseFloat(html.find("#cargo").val()) || 0,
      useOars: hasOars ? !!html.find("#useOars")[0]?.checked : false
    };
  }

  calculate(html) {
    try {
      const data = this.getFormData(html);
      const result = this.calculator.calculateTravelFromData(data);
      this.displayResultCompact(html, result, result.input);
    } catch (e) {
      html.find("#calcResult").html(`<div style="color:#ff6b6b;">Ошибка: ${e.message}</div>`);
    }
  }

  displayResultCompact(html, result, data) {
    html.find("#res-speed").text(`${result.speed.toFixed(2)} уз.`);
    html.find("#res-ft").text(`${result.ftPerRound.toFixed(0)} фт/раунд`);

    if (data.mode === "distance") {
      html.find("#res-dist").text(`${data.distance} ${data.unit === "km" ? "км" : "миль"}`);
      html.find("#res-extra").text(`${result.time.days}д ${result.time.hours}ч ${result.time.minutes}м`);
    } else {
      html.find("#res-dist").text(`${result.distanceKm.toFixed(1)} км`);
      html.find("#res-extra").text(`${result.distanceMi.toFixed(1)} миль`);
    }

    html.find("#res-mano").text(`${(result.shipState.maneuverability * 100).toFixed(0)}%`);
    html.find("#res-radius").text(`≈ ${Math.round(result.shipState.turnRadiusFt)} фт`);
    html.find("#res-cargo").text(`${result.shipState.effectiveCargo.toFixed(2)} т / ${this.getShipMaxCargo(data.ship)} т`);
    html.find("#res-crew").text(`${data.crewCount} чел (≈ ${result.shipState.crewWeightTons.toFixed(2)} т)`);
  }

  calculateAndSend(html) {
    const data = this.getFormData(html);
    const result = this.calculator.calculateTravelFromData(data);
    this.pendingLastInput = result.input;
    this.flushPendingSave();

    this.chatRenderer.sendToChat(result.input, result);
    ui.notifications.info("Результаты отправлены в чат!");
    this.focusDialog();
  }
}
