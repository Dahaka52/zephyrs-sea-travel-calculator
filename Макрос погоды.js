// == Морская погода (Флеймрул) с учётом времени суток ==

(async () => {
  const timesOfDay = ["Утро", "День", "Вечер", "Ночь"];
  const months = { "F": "Флеймрул" };

  // Направления ветра
  const windDirections = [
    { dir: "Северный", weight: 35, arrow: "↓" },
    { dir: "Северо-восточный", weight: 20, arrow: "↙" },
    { dir: "Восточный", weight: 15, arrow: "←" },
    { dir: "Юго-восточный", weight: 20, arrow: "↖" },
    { dir: "Южный", weight: 30, arrow: "↑" },
    { dir: "Юго-западный", weight: 80, arrow: "↗" },
    { dir: "Западный", weight: 100, arrow: "→" },
    { dir: "Северо-западный", weight: 70, arrow: "↘" }
  ];

  // Шкала ветра
  const windTableF = [
    { range: "<5 уз.", label: "Штиль", weight: 4, waves: "0–0.5 м", icon: "🌫️", max: 1 },
    { range: "5–10 уз.", label: "Лёгкий бриз", weight: 10, waves: "0.5–1 м", icon: "🍃", max: 2 },
    { range: "10–20 уз.", label: "Свежий бриз", weight: 20, waves: "1–2 м", icon: "💨", max: 3 },
    { range: "20–40 уз.", label: "Крепкий ветер", weight: 30, waves: "2–4 м", icon: "🌬️", max: 4 },
    { range: ">40 уз.", label: "Шторм", weight: 2, waves: "4–8+ м", icon: "⛈️", max: 5 }
  ];

  // Базовые месячные веса погоды
  const monthWeatherWeights = {
    "Ясно": 18,
    "Облачно": 5,
    "Туман": 5,
    "Лёгкий дождь": 10,
    "Сильный дождь": 2,
    "Гроза": 2
  };

  // Пересчёт вероятности погоды по времени суток (множители)
  //    Утро: часто туман/рассеянная облачность; тихий ветер чаще.
  //    День: больше ясных часов; в тёплый день вероятность грозы выше (особенно после полудня).
  //    Вечер: охлаждение — туманы и облачность часто растёт.
  //    Ночь: туман и ясность/звёздное небо, меньше гроз.
  const weatherByTime = {
    "Утро":   { "Ясно":1.0,"Облачно":1.0,"Туман":2.5,"Лёгкий дождь":0.8,"Сильный дождь":0.4,"Гроза":0.1 },
    "День":   { "Ясно":2.2,"Облачно":1.2,"Туман":0.2,"Лёгкий дождь":1.1,"Сильный дождь":0.6,"Гроза":1.8 },
    "Вечер":  { "Ясно":1.1,"Облачно":1.3,"Туман":1.8,"Лёгкий дождь":1.1,"Сильный дождь":1.0,"Гроза":0.8 },
    "Ночь":   { "Ясно":0.9,"Облачно":1.1,"Туман":2.2,"Лёгкий дождь":0.9,"Сильный дождь":0.6,"Гроза":0.3 }
  };

  // Минимальная требуемая сила ветра (по шкале max в windTableF) для определённых погод,
  //    чтобы избежать несовместимых сочетаний вроде "штиль + гроза".
  //    Правила простые: гроза требует хотя бы свежего бриза (max >= 3), сильный дождь — min 2 и т.д.
  const weatherWindMin = {
    "Ясно": 1,
    "Облачно": 1,
    "Туман": 1,
    "Лёгкий дождь": 2,
    "Сильный дождь": 3,
    "Гроза": 3
  };

  // Длительность выпавшей погоды в часах — реалистичные диапазоны (рандомайзер)
  //    — дневная ясная погода может держаться дольше; гроза обычно кратка (несколько часов).
  const weatherDurationHours = {
    "Ясно": { min:4, max:6 },
    "Облачно": { min:2, max:6 },
    "Туман": { min:1, max:6 },
    "Лёгкий дождь": { min:1, max:6 },
    "Сильный дождь": { min:1, max:6 },
    "Гроза": { min:1, max:4 }
  };

  // Модификаторы ветра по времени (веса для windTableF элементов)
  //    — оставлена исходная идея, немного подогнана для правдоподобия.
  //    Формат: массив множителей длиной равно числу элементов windTableF.
  const windModifiersByTime = {
    "Утро":  [2.0,1.6,1.0,0.6,0.2],
    "День":  [0.6,0.9,1.3,1.6,1.0],
    "Вечер": [1.2,1.4,1.0,0.8,0.4],
    "Ночь":  [1.8,1.2,0.8,0.5,0.2]
  };

  // Вспомогательная функция — взвешенный выбор из таблицы с полем weight
  function weightedChoice(table) {
    const total = table.reduce((a,b)=>a+(b.weight||0),0);
    let roll = Math.random()*total, sum=0;
    for (let e of table) { sum+=(e.weight||0); if (roll<=sum) return e; }
    return table[0];
  }

  // Генерация содержимого диалога
  let content = `
  <form>
    <div style="margin-bottom:8px;">
      <label><b>Выберите время суток:</b></label>
      <select id="time" style="width:100%; color:black; background:white; margin-top:6px;">
        ${timesOfDay.map(t=>`<option value="${t}">${t}</option>`).join("")}
      </select>
    </div>
    <div style="margin-bottom:6px;">
      <label><input type="checkbox" id="gmOnly"> Выводить только ГМ</label>
    </div>
  </form>`;

  // Рендер диалога
  new Dialog({
    title: "🌊 Генератор морской погоды (Флеймрул)",
    content: content,
    buttons: {
      ok: {
        label: "Сгенерировать",
        callback: async (html) => {
          const time = html.find("#time").val();
          const gmOnly = html.find("#gmOnly")[0].checked;

          // Подготовка таблицы погод с учетом месячных весов и множителей по времени
          let weightedWeatherTable = Object.entries(monthWeatherWeights).map(([cond, base]) => {
            const mult = (weatherByTime[time] && weatherByTime[time][cond]) || 1;
            return { cond, weight: Math.max(0.01, base * mult) }; // предотвращаем нулевые веса
          });

          // Выбор погоды — но учитываем совместимость с ветром; поэтому цикл: выбираем погоду, затем пытаемся подобрать ветер
          // Если не удаётся за N попыток — делаем повторный выбор погоды.
          const MAX_TRIES = 8;
          let chosen = null;

          for (let attempt = 0; attempt < MAX_TRIES && !chosen; attempt++) {
            const weatherPick = weightedChoice(weightedWeatherTable);
            const weatherCond = weatherPick.cond;

            // Вычисляем ограничение по ветру для этой погоды (min)
            const requiredWindMin = weatherWindMin[weatherCond] || 1;

            // Формируем допустимые варианты ветра: сначала фильтруем windTableF по минимальным требованиям
            let windOptions = windTableF.filter(w => w.max >= requiredWindMin);

            // Также дополнительно фильтруем по weatherWindMax (раньше был mapping; мы оставляем логику простую — уже покрыто выше)
            // Применяем суточные модификаторы к весам ветров
            const mods = windModifiersByTime[time] || windModifiersByTime["День"];
            let adjustedOptions = windOptions.map((w, i) => {
              return { ...w, weight: (w.weight || 1) * (mods[i] || 1) };
            });

            // Выбираем направление (оно зависит от месячных/климатических весов — сохраняем)
            let directionObj = weightedChoice(windDirections);
            // Выбираем ветер
            let wind = null;
            // Попробуем несколько раз подобрать ветер (если из-за модификаторов некоторые веса очень малы)
            for (let i = 0; i < 6; i++) {
              wind = weightedChoice(adjustedOptions);
              // Дополнительная логика: не разрешать (штиль + гроза) — гроза требует хотя бы moderate ветер
              if (weatherCond === "Гроза" && wind.max < 3) {
                // не подходит — продолжим выбор ветра
                continue;
              }
              // Для тумана — предпочитаем слабый ветер; если выбран сильный — отвергаем
              if (weatherCond === "Туман" && wind.max >= 4) continue;
              // Если прошли все проверки — принимаем
              break;
            }

            // Если в итоге ветер не определился (маловероятно) — переходим к следующей попытке по погоде
            if (!wind) continue;

            // Всё ок — фиксируем выбор
            chosen = {
              weatherCond,
              weatherLabel: {
                "Ясно": "Ясно ☀️",
                "Облачно": "Облачно ☁️",
                "Туман": "Туман 🌫️",
                "Лёгкий дождь": "Мелкий дождь 🌦️",
                "Сильный дождь": "Сильный дождь 🌧️",
                "Гроза": "Гроза ⛈️"
              }[weatherCond] || weatherCond,
              wind,
              directionObj
            };
          } // конец цикла попыток

          // Если не удалось ничего выбрать (крайне маловероятно), то выберем самый вероятный погодный вариант простым способом
          if (!chosen){
            const fallback=weightedChoice(weightedWeatherTable);
            chosen={
              weatherCond:fallback.cond,
              weatherLabel:fallback.cond,
              wind:weightedChoice(windTableF),
              directionObj:weightedChoice(windDirections)
            };
          }

          // Рандомайзер длительности (часы) для выбранной погоды
          const durRange=weatherDurationHours[chosen.weatherCond]||{min:1,max:6};
          const durationHours=Math.floor(Math.random()*(durRange.max-durRange.min+1))+durRange.min;

          // Формируем читаемое сообщение (HTML)
          const arrow=chosen.directionObj.arrow||"→";
          const arrowHtml=`<span style="font-size:22px; font-weight:700; display:inline-block; width:32px; text-align:center; transform:translateY(4px);">${arrow}</span>`;

          const msg=`
          <div style="background:linear-gradient(180deg,#0f1724,#11121a); color:#e6eef6; padding:14px; border-radius:12px; font-family:Inter, system-ui; border:1px solid rgba(160,180,200,0.06);">
            <h2 style="margin:0 0 6px 0; font-size:18px; color:#9be7ff;">🌤️ Погода — ${months["F"]}</h2>
            <div style="font-size:12px; color:#9aa7b2; margin-bottom:10px;">
              Сгенерировано для: <b>${time}</b>
            </div>
            <hr style="border:none; height:1px; background:rgba(255,255,255,0.08); margin:8px 0 12px 0;">
            <p style="margin:0 0 8px 0; font-size:14px;">
              <b>🧭 Направление ветра:</br> ${arrowHtml}</br> <b style="color:#ffd380;">${chosen.directionObj.dir}</b>
            </p>
            <p style="margin:0 0 8px 0; font-size:15px;">
              <b>🌦️ Условия:</b> ${chosen.weatherLabel}
            </p>
            <p style="margin:0 0 8px 0; font-size:14px;">
              <b>💨 Ветер:</b> ${chosen.wind.icon} <b> ${chosen.wind.label}</br> (${chosen.wind.range})
            </p>
            <p style="margin:0 0 8px 0; font-size:14px;">
              <b>🌊 Волны:</b> ${chosen.wind.waves}
            </p>
            <p style="margin:0; font-size:14px;">
              <b>⏳ Длительность:</b> ${durationHours} ч.
            </p>
          </div>`;

          try {
            if (gmOnly){
              const gmIds=game.users.contents.filter(u=>u.isGM).map(u=>u.id);
              if (gmIds.length){
                await ChatMessage.create({content:msg, whisper:gmIds});
              } else {
                await ChatMessage.create({content:msg});
              }
            } else {
              await ChatMessage.create({content:msg});
            }
          } catch (err){
            console.error("Ошибка отправки сообщения погоды:",err);
            ChatMessage.create({content:`<pre>Ошибка генерации: ${err}</pre>`});
          }
        }
      },
      cancel:{label:"Отмена"}
    },
    default:"ok"
  }).render(true);
})();