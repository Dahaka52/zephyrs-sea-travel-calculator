class TravelCalculatorUI {
  constructor(calculator) {
    this.calculator = calculator;
    this.dialog = null;
    this.resizeObserver = null;
    this.chatRenderer = new ChatRenderer();
  }

  render() {
    if (this.dialog) {
      this.dialog.close();
      this.dialog = null;
      return;
    }

    const content = this.createDialogContent();
    const windowSettings = this.calculator.windowSettings || { width: 800, height: 600 };

    this.dialog = new Dialog({
      title: "🧭 Калькулятор морского перехода",
      content: content,
      buttons: {
        calculate: {
          label: "<i class='fas fa-ship'></i> Рассчитать и отправить в чат",
          callback: (html) => { this.calculateAndSend(html); return false; }
        },
        close: {
          label: "<i class='fas fa-times'></i> Закрыть",
          callback: () => this.closeDialog()
        }
      },
      render: (html) => this.initializeEventHandlers(html),
      default: "calculate",
      close: () => this.closeDialog()
    }, {
      width: windowSettings.width || 800,
      resizable: true,
      classes: ["zephyr-calculator"]
    });

    this.dialog.render(true);
    this.setupWindowTracking();
  }

  setupWindowTracking() {
    const dialogElement = $('.zephyr-calculator').closest('.app.window-app.dialog');
    if (dialogElement.length) {
      const resizeObserver = new ResizeObserver(() => this.saveWindowPosition());
      resizeObserver.observe(dialogElement[0]);
      dialogElement.on('mouseup', () => setTimeout(() => this.saveWindowPosition(), 100));
      this.resizeObserver = resizeObserver;
    }
  }

  saveWindowPosition() {
    const dialogElement = $('.zephyr-calculator').closest('.app.window-app.dialog');
    if (dialogElement.length) {
      const rect = dialogElement[0].getBoundingClientRect();
      const settings = { 
        width: Math.round(rect.width), 
        height: Math.round(rect.height), 
        top: Math.round(rect.top), 
        left: Math.round(rect.left) 
      };
      if (settings.height > window.innerHeight * 0.9) {
        settings.height = Math.round(window.innerHeight * 0.9);
      }
      this.calculator.saveWindowSettings(settings);
    }
  }

  closeDialog() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.saveWindowPosition();
    this.dialog = null;
  }

  adjustDialogHeight() {
    if (!this.dialog) return;
    const dialogElement = $('.zephyr-calculator').closest('.app.window-app.dialog')[0];
    if (!dialogElement) return;
    const contentEl = dialogElement.querySelector('.calc-container');
    if (!contentEl) return;
    const desired = Math.min(window.innerHeight * 0.9, contentEl.scrollHeight + 120);
    try {
      this.dialog.setPosition({ height: Math.round(desired) });
    } catch (e) {
      console.warn("Zephyr: Could not adjust dialog height", e);
    }
  }

  getAvailableBonusSails(shipId) {
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    if (ship?.sailing?.sailConfig?.bonusSails) return ship.sailing.sailConfig.bonusSails;
    return { "none": { label: "Без дополнительных парусов", bonus: 0 } };
  }

  getShipMaxCargo(shipId) {
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    return ship ? ship.capacity.maxCargo : 0;
  }

  getShipDescription(shipId, cargoTons = 0, crewCount = 0) {
    // Delegated to TravelCalculator helper for consistency
    return this.calculator.getShipDescription(shipId, cargoTons, crewCount);
  }

  calculateShipStateForTurning(shipId, cargoTons, crewCount, crewType) {
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    if (!ship) return null;

    const state = this.calculator.calculateShipState(shipId, cargoTons, crewCount);
    // Apply crew maneuverability modifier
    const crewMod = ZEPHYR_CREW_MODIFIERS?.[crewType];
    let maneuverability = state.maneuverability;
    if (crewMod?.maneuverabilityMultiplier) maneuverability *= crewMod.maneuverabilityMultiplier;
    maneuverability = Math.max(ZEPHYR_MIN_MANEUVERABILITY, maneuverability);

    return {
      maneuverability,
      cargoRatio: state.cargoRatio,
      baseTurnRadiusM: state.baseTurnRadiusM,
      LWL_m: state.LWL_m
    };
  }

  calculateTurningRadius(ship, shipState, currentSpeed, windForce, waves, windAngle) {
    // Delegate to ShipStateCalculator for consistency
    return this.calculator.shipStateCalculator.calculateTurningRadius(ship, shipState, currentSpeed, windForce, waves, windAngle);
  }

  calculateEnhancedSpeed(data) {
    // Delegate to unified TravelCalculator.calculateSpeed via singleton
    try {
      return this.calculator.calculateSpeed(
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
    } catch (e) {
      console.error("calculateEnhancedSpeed failed:", e);
      return 0;
    }
  }

  courseToAngle(windCourse) {
    return this.calculator.courseToAngle(windCourse);
  }

  calculatePolarSpeed(ship, windAngle, maxSpeed, windCourse = null) {
    // To remain backward-compatible, call shipStateCalculator
    return this.calculator.shipStateCalculator.calculatePolarSpeed(ship, windAngle, { windCourse });
  }

  createDialogContent() {
    const data = this.calculator.lastData;
    const ship = ZEPHYR_SHIPS_LIBRARY[data.ship];

    if (!ship) {
      console.error(`Ship not found: ${data.ship}`);
      return `<div class="calc-container"><div class="calc-content">Ошибка: корабль не найден</div></div>`;
    }

    const availableSails = this.getAvailableBonusSails(data.ship);
    const maxCargo = this.getShipMaxCargo(data.ship);
    const shipCourses = (ship.sailing?.availableCourses) ? ship.sailing.availableCourses : Object.keys(ZEPHYR_WIND_COURSES);

    return `
<div class="calc-container">
  <div class="calc-content">
    <div class="calc-row">
      <div class="calc-label">Корабль:</div>
      <div class="calc-control">
        <select id="shipSelect">
          ${Object.values(ZEPHYR_SHIPS_LIBRARY).map(s => 
            `<option value="${s.id}" ${data.ship === s.id ? 'selected' : ''}>${s.name}</option>`
          ).join('')}
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

    <div class="mode-distance" style="display:${data.mode === 'distance' ? 'block' : 'none'}">
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

    <div class="mode-time" style="display:${data.mode === 'time' ? 'block' : 'none'}">
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
            `<option value="${k}" ${data.windCourse === k ? 'selected' : ''}>${ZEPHYR_WIND_COURSES[k]?.label ?? k}</option>`
          ).join('')}
        </select>
      </div>
    </div>

    <div class="calc-row">
      <div class="calc-label">Сила ветра:</div>
      <div class="calc-control">
        <select id="windForce">
          ${Object.entries(ZEPHYR_WIND_FORCES).map(([k, f]) => 
            `<option value="${k}" ${data.windForce === k ? 'selected' : ''}>${f.label}</option>`
          ).join('')}
        </select>
      </div>
    </div>

    <div class="calc-row">
      <div class="calc-label">Волнение:</div>
      <div class="calc-control">
        <select id="waves">
          ${Object.entries(ZEPHYR_WAVES).map(([k, w]) => 
            `<option value="${k}" ${data.waves === k ? 'selected' : ''}>${w.label}</option>`
          ).join('')}
        </select>
      </div>
    </div>

    <div class="calc-row">
      <div class="calc-label">Тип экипажа:</div>
      <div class="calc-control">
        <select id="crewType">
          ${Object.entries(ZEPHYR_CREW_MODIFIERS).map(([k, c]) => 
            `<option value="${k}" ${data.crewType === k ? 'selected' : ''}>${c.label}</option>`
          ).join('')}
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
            `<option value="${k}" ${data.bonusSails === k ? 'selected' : ''}>${s.label}</option>`
          ).join('')}
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
	 <div class="calc-control" style="display: flex; align-items: center; gap: 6px;">
	   <input type="checkbox" id="helm" ${data.helm ? 'checked' : ''} /> 
       <span style="font-size: 1.2em; color:#f0e6d2;">+5 узлов в любых условиях</span>
     </div>
    </div>

    ${ship.sailing?.oars?.available ? `
	 <div class="calc-row oars-row">
     <div class="calc-label">Исп. весла:</div>
     <div class="calc-control" style="display: flex; align-items: center; gap: 6px;">
       <input type="checkbox" id="useOars" ${data.useOars ? 'checked' : ''} /> 
       <span style="font-size: 1.2em; color: #f0e6d2;">
      ${ship.sailing.oars.maxSpeed} узлов в штиль (требуется ${ship.sailing.oars.crewRequired} чел)
      </span>
     </div>
    </div>
    ` : ''}

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
    html.find('#mode').on('change', () => {
      this.updateMode(html);
      this.calculateAndSave(html);
      this.adjustDialogHeight();
    });

    html.find('#windForce').on('change', () => {
      const windForce = html.find('#windForce').val();
      let newWave = 'calm';
      switch (windForce) {
        case 'calm': newWave = 'calm'; break;
        case 'weak': newWave = 'ripple'; break;
        case 'normal': newWave = 'wave'; break;
        case 'strong': newWave = 'stwave'; break;
        case 'storm': newWave = 'storm'; break;
      }
      html.find('#waves').val(newWave);
      this.calculateAndSave(html);
    });

    html.find('#shipSelect').on('change', () => {
      this.updateShip(html);
      this.adjustDialogHeight();
    });

    html.find('#windCourse, #windForce, #waves, #crewType, #bonusSails, #useOars').on('change', () => {
      this.calculateAndSave(html);
    });

    html.find('#cargo').on('input change', () => {
      const cargoValue = parseFloat(html.find('#cargo').val()) || 0;
      html.find('#cargoValue').text(`${cargoValue.toFixed(1)} т`);
      this.updateShipInfo(html);
      this.calculateAndSave(html);
      this.adjustDialogHeight();
    });

    html.find('#crewCount').on('input change', () => {
      this.updateCargoLimits(html);
      this.updateShipInfo(html);
      this.calculateAndSave(html);
      this.adjustDialogHeight();
    });

    html.find('#helm').on('change', () => {
      this.calculateAndSave(html);
    });

    html.find('input[type="number"], select').not('#cargo').not('#crewCount').on('input change', () => {
      this.calculateAndSave(html);
    });

    this.updateMode(html);
    this.updateCargoLimits(html);
    this.calculate(html);
    this.adjustDialogHeight();
  }

  updateMode(html) {
    const mode = html.find('#mode').val();
    html.find('.mode-distance').toggle(mode === 'distance');
    html.find('.mode-time').toggle(mode === 'time');
  }

  updateShip(html) {
    const shipId = html.find('#shipSelect').val();
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    
    if (!ship) return;
    
    const currentCourse = html.find('#windCourse').val();
    const currentBonusSails = html.find('#bonusSails').val();
    const currentUseOars = html.find('#useOars').is(':checked');
    
    const shipCourses = (ship.sailing?.availableCourses) ? ship.sailing.availableCourses : Object.keys(ZEPHYR_WIND_COURSES);
    
    const wsel = html.find('#windCourse');
    wsel.empty();
    shipCourses.forEach(k => {
      wsel.append(`<option value="${k}">${ZEPHYR_WIND_COURSES[k]?.label ?? k}</option>`);
    });

    if (shipCourses.includes(currentCourse)) {
      wsel.val(currentCourse);
    } else {
      wsel.val(shipCourses[0]);
    }

    const availableSails = this.getAvailableBonusSails(shipId);
    const bsels = html.find('#bonusSails');
    bsels.empty();
    Object.entries(availableSails).forEach(([k, s]) => {
      bsels.append(`<option value="${k}">${s.label}</option>`);
    });
    
    if (currentBonusSails in availableSails) {
      bsels.val(currentBonusSails);
    }
    
    this.updateOarsOption(html, shipId);
    
    if (ship.sailing?.oars?.available) {
      html.find('#useOars').prop('checked', currentUseOars);
    }
    
    this.updateCargoLimits(html);
    this.updateShipInfo(html);
    this.calculate(html);
  }

  updateOarsOption(html, shipId) {
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    const hasOars = ship?.sailing?.oars?.available;
    const existingOarsRow = html.find('.oars-row');
    
    if (hasOars && existingOarsRow.length === 0) {
      const oarsHTML = `
      <div class="calc-row oars-row">
        <div class="calc-label">Исп. весла:</div>
        <div class="calc-control">
          <input type="checkbox" id="useOars" /> 
          <small>${ship.sailing.oars.maxSpeed} узлов в штиль (требуется ${ship.sailing.oars.crewRequired} чел)</small>
        </div>
      </div>`;
      html.find('#helm').closest('.calc-row').after(oarsHTML);
      
      html.find('#useOars').on('change', () => {
        this.calculateAndSave(html);
      });
    } else if (!hasOars && existingOarsRow.length > 0) {
      existingOarsRow.remove();
    }
  }

  updateCargoLimits(html) {
    const shipId = html.find('#shipSelect').val();
    const crewCount = parseInt(html.find('#crewCount').val()) || 0;
    const maxCargoTotal = this.getShipMaxCargo(shipId);
    const crewWeight = (crewCount * ZEPHYR_AVG_CREW_WEIGHT_KG) / 1000.0;
    const sliderMax = Math.max(0, (maxCargoTotal - crewWeight));

    const cargoEl = html.find('#cargo');
    cargoEl.attr('max', sliderMax);

    let cargoVal = parseFloat(cargoEl.val() || 0);
    if (cargoVal > sliderMax) {
      cargoVal = sliderMax;
      cargoEl.val(cargoVal);
    }

    if (crewWeight >= maxCargoTotal) {
      cargoEl.prop('disabled', true);
      html.find('#cargoValue').text(`0.0 т`);
    } else {
      cargoEl.prop('disabled', false);
      html.find('#cargoValue').text(`${cargoVal.toFixed(1)} т`);
    }
  }

  updateShipInfo(html) {
    const shipId = html.find('#shipSelect').val();
    const cargo = parseFloat(html.find('#cargo').val()) || 0;
    const crewCount = parseInt(html.find('#crewCount').val()) || 0;
    html.find('#shipInfo').html(this.getShipDescription(shipId, cargo, crewCount));
  }

  getFormData(html) {
    const shipId = html.find('#shipSelect').val();
    const ship = ZEPHYR_SHIPS_LIBRARY[shipId];
    const hasOars = !!(ship?.sailing?.oars?.available);
    
    return {
      ship: html.find('#shipSelect').val(),
      mode: html.find('#mode').val(),
      distance: parseFloat(html.find('#distance').val()) || 0,
      time: parseFloat(html.find('#time').val()) || 0,
      unit: html.find('#unit').val(),
      windCourse: html.find('#windCourse').val(),
      windForce: html.find('#windForce').val(),
      waves: html.find('#waves').val(),
      bonusSails: html.find('#bonusSails').val(),
      crewType: html.find('#crewType').val(),
      crewCount: parseInt(html.find('#crewCount').val()) || 0,
      helm: !!html.find('#helm')[0]?.checked,
      cargo: parseFloat(html.find('#cargo').val()) || 0,
      useOars: hasOars ? !!html.find('#useOars')[0]?.checked : false
    };
  }

  calculateAndSave(html) {
    this.calculate(html);
    this.saveCurrentData(html);
  }

  calculate(html) {
    try {
      const data = this.getFormData(html);
      const speed = this.calculateEnhancedSpeed(data);
      const ftPerRound = speed * ZEPHYR_FT_PER_KNOT_PER_ROUND;
      
      const shipStateForTurning = this.calculateShipStateForTurning(data.ship, data.cargo, data.crewCount, data.crewType);
      const ship = ZEPHYR_SHIPS_LIBRARY[data.ship];
      
      const windAngle = this.courseToAngle(data.windCourse);
      const turningData = this.calculateTurningRadius(
        ship, 
        shipStateForTurning, 
        speed, 
        data.windForce, 
        data.waves, 
        windAngle
      );
      
      let result = {
        speed: speed,
        ftPerRound: ftPerRound,
        shipState: {
          maneuverability: shipStateForTurning.maneuverability,
          turnRadiusFt: turningData.radiusFt,
          effectiveCargo: data.cargo + (data.crewCount * ZEPHYR_AVG_CREW_WEIGHT_KG / 1000),
          crewWeightTons: data.crewCount * ZEPHYR_AVG_CREW_WEIGHT_KG / 1000,
          turningFactors: turningData.factors
        }
      };

      if (data.mode === 'distance') {
        const distNm = data.unit === 'km' ? data.distance/1.852 : data.distance;
        const hours = distNm / Math.max(0.0001, speed);
        const d = Math.floor(hours/24);
        const h = Math.floor(hours%24);
        const m = Math.round((hours*60)%60);
        result.time = { days: d, hours: h, minutes: m };
        result.distance = data.distance;
        result.unit = data.unit;
      } else {
        const distNm = data.time * speed;
        const distanceKm = distNm * 1.852;
        const distanceMi = distNm;
        result.distanceNm = distNm;
        result.distanceKm = distanceKm;
        result.distanceMi = distanceMi;
        result.timeHours = data.time;
      }

      this.displayResultCompact(html, result, data);
    } catch (e) {
      html.find('#calcResult').html(`<div style="color:#ff6b6b;">Ошибка: ${e.message}</div>`);
    }
  }

  displayResultCompact(html, result, data) {
    html.find('#res-speed').text(`${result.speed.toFixed(2)} уз.`);
    html.find('#res-ft').text(`${result.ftPerRound.toFixed(0)} фт/раунд`);
    
    if (data.mode === 'distance') {
      html.find('#res-dist').text(`${data.distance} ${data.unit === 'km' ? 'км' : 'миль'}`);
      html.find('#res-extra').text(`${result.time.days}д ${result.time.hours}ч ${result.time.minutes}м`);
    } else {
      html.find('#res-dist').text(`${result.distanceKm.toFixed(1)} км`);
      html.find('#res-extra').text(`${result.distanceMi.toFixed(1)} миль`);
    }
    
    html.find('#res-mano').text(`${(result.shipState.maneuverability*100).toFixed(0)}%`);
    html.find('#res-radius').text(`≈ ${Math.round(result.shipState.turnRadiusFt)} фт`);
    html.find('#res-cargo').text(`${result.shipState.effectiveCargo.toFixed(2)} т / ${this.getShipMaxCargo(data.ship)} т`);
    html.find('#res-crew').text(`${data.crewCount} чел (≈ ${result.shipState.crewWeightTons.toFixed(2)} т)`);

    this.adjustDialogHeight();
  }

  saveCurrentData(html) {
    const data = this.getFormData(html);
    this.calculator.saveLastInput(data);
  }

  calculateAndSend(html) {
    const wasOpen = !!this.dialog; // флаг - диалог был открыт до отправки
    const data = this.getFormData(html);
    this.calculator.saveLastInput(data);

    const speed = this.calculateEnhancedSpeed(data);
    const ftPerRound = speed * 10;

    const shipStateForTurning = this.calculateShipStateForTurning(data.ship, data.cargo, data.crewCount, data.crewType);
    const ship = ZEPHYR_SHIPS_LIBRARY[data.ship];

    const windAngle = this.courseToAngle(data.windCourse);
    const turningData = this.calculateTurningRadius(
      ship,
      shipStateForTurning,
      speed,
      data.windForce,
      data.waves,
      windAngle
    );

    let result = {
      speed: speed,
      ftPerRound: ftPerRound,
      shipState: {
        maneuverability: shipStateForTurning.maneuverability,
        turnRadiusFt: turningData.radiusFt,
        effectiveCargo: data.cargo + (data.crewCount * ZEPHYR_AVG_CREW_WEIGHT_KG / 1000),
        crewWeightTons: data.crewCount * ZEPHYR_AVG_CREW_WEIGHT_KG / 1000,
        turningFactors: turningData.factors
      }
    };

    if (data.mode === 'distance') {
      const distNm = data.unit === 'km' ? data.distance/1.852 : data.distance;
      const hours = distNm / speed;
      const d = Math.floor(hours/24);
      const h = Math.floor(hours%24);
      const m = Math.round((hours*60)%60);
      result.time = { days: d, hours: h, minutes: m };
      result.distance = data.distance;
      result.unit = data.unit;
    } else {
      const distNm = data.time * speed;
      const distanceKm = distNm * 1.852;
      const distanceMi = distNm;
      result.distanceNm = distNm;
      result.distanceKm = distanceKm;
      result.distanceMi = distanceMi;
      result.timeHours = data.time;
    }

    // Отправляем в чат — главный шаг
    this.chatRenderer.sendToChat(data, result);
    ui.notifications.info("Результаты отправлены в чат!");

    // Небольшая защита: если диалог закрылся (или был удалён) в процессе создания чата,
    // аккуратно восстановим его — но только если до отправки он был открыт.
    if (wasOpen) {
  setTimeout(() => {
    try {
      // ищем уже существующий DOM диалог
      const dialogEl = document.querySelector('.zephyr-calculator, .zephyrs-sea-travel-calculator');
      if (dialogEl) {
        // если найден, просто фокусируем окно
        const appId = dialogEl.dataset.appid;
        const app = Object.values(ui.windows).find(w => w.appId === appId);
        if (app) {
          app.bringToTop();
          console.log("Zephyr: диалог был закрыт системой, но восстановлен (только фокус).");
        }
      } else {
        // диалог реально исчез — создаём заново
        this.render();
        console.log("Zephyr: диалог отсутствовал — создан заново.");
      }
    } catch (e) {
      console.error("Zephyr: ошибка восстановления диалога после чата", e);
    }
  }, 80);
}
  }
}
