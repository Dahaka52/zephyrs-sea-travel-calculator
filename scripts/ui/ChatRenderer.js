class ChatRenderer {
  sendToChat(data, result) {
    const windCourseLabel = ZEPHYR_WIND_COURSES?.[data.windCourse]?.label ?? (data.windCourse || "—");
    const windForceLabel = ZEPHYR_WIND_FORCES?.[data.windForce]?.label ?? (data.windForce || "—");
    const wavesLabel = ZEPHYR_WAVES?.[data.waves]?.label ?? (data.waves || "—");
    const crewWeight = result.shipState.crewWeightTons ?? 0;
    const shipName = ZEPHYR_SHIPS_LIBRARY?.[data.ship]?.name ?? data.ship ?? "—";

    const modeLines = data.mode === "distance"
      ? `<div><strong>Дистанция:</strong> ${data.distance} ${data.unit === "km" ? "км" : "миль"}</div>
         <div><strong>Время в пути:</strong> ${result.time?.days ?? 0}д ${result.time?.hours ?? 0}ч ${result.time?.minutes ?? 0}м</div>`
      : `<div><strong>Пройдено:</strong> ${(result.distanceKm ?? 0).toFixed(1)} км (${(result.distanceMi ?? 0).toFixed(1)} миль)</div>`;

    const content = `
<div class="zephyr-chat">
  <div class="zephyr-chat__card">
    <h3 class="zephyr-chat__title">🧭 Отчёт о морском переходе</h3>

    <div class="zephyr-chat__section">
      <div><strong>Корабль:</strong> ${shipName}</div>
      <div><strong>Скорость:</strong> ${result.speed.toFixed(2)} уз. (${result.ftPerRound.toFixed(0)} фт/раунд)</div>
      <div><strong>Радиус разворота:</strong> ${(result.shipState.maneuverability * 100).toFixed(0)}% / ≈ ${Math.round(result.shipState.turnRadiusFt)} фт</div>
      <div><strong>Загрузка:</strong> ${result.shipState.effectiveCargo.toFixed(2)} т (экипаж ${data.crewCount} чел ≈ ${crewWeight.toFixed(2)} т)</div>
    </div>

    <div class="zephyr-chat__section">
      <div><strong>Режим:</strong> ${data.mode === "distance" ? "По дистанции" : `По времени (${data.time} ч)`}</div>
      <div><strong>Условия:</strong> ${windCourseLabel}, ${windForceLabel}, ${wavesLabel}</div>
    </div>

    <div class="zephyr-chat__section">
      ${modeLines}
    </div>

    <div class="zephyr-chat__section">
      <strong>Штурвал:</strong> ${data.helm ? "✅ Да" : "❌ Нет"}
    </div>
  </div>
</div>
`;

    ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker()
    });
  }
}
