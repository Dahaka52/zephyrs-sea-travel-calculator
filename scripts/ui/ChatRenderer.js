class ChatRenderer {
  sendToChat(data, result) {
    const windCourseLabel = ZEPHYR_WIND_COURSES?.[data.windCourse]?.label ?? (data.windCourse || '—');
    const windForceLabel = ZEPHYR_WIND_FORCES?.[data.windForce]?.label ?? (data.windForce || '—');
    const wavesLabel = ZEPHYR_WAVES?.[data.waves]?.label ?? (data.waves || '—');
    const crewWeight = result.shipState.crewWeightTons ?? 0;
    const shipName = ZEPHYR_SHIPS_LIBRARY?.[data.ship]?.name ?? data.ship ?? "—";

    const modeLines = data.mode === 'distance'
      ? `<div><strong>Дистанция:</strong> ${data.distance} ${data.unit==='km'?'км':'миль'}</div>
         <div><strong>Время в пути:</strong> ${result.time?.days ?? 0}д ${result.time?.hours ?? 0}ч ${result.time?.minutes ?? 0}м</div>`
      : `<div><strong>Пройдено:</strong><br> ${(result.distanceKm ?? 0).toFixed(1)} км (${(result.distanceMi ?? 0).toFixed(1)} миль)</div>`;

    const content = `
<div class="zephyr-chat" style="
  background: url('modules/zephyrs-sea-travel-calculator/assets/sea-map.jpg') center/cover no-repeat;
  color: #072033;
  font-family: 'Cinzel', serif;
  font-size: 1.3em;
  line-height: 1.4em;
  padding: 14px;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(2,12,30,0.3);
">
  <div style="
    background: rgba(240,240,230,0.92);
    padding: 12px;
    border-radius: 8px;
    border: 1px solid rgba(10,30,50,0.08);
  ">
    <h3 style="margin-top:0;margin-bottom:10px;color:#0b3b57;font-size:1.2em;">🧭 Отчёт о морском переходе</h3>

    <div style="margin-bottom:10px;">
      <div><strong>Корабль:</strong><br> ${shipName}</div>
	  <div><strong>Скорость:</strong><br> ${result.speed.toFixed(2)} уз. (${result.ftPerRound.toFixed(0)} фт/раунд)</div>
      <div><strong>Радиус разворота:</strong><br> ${(result.shipState.maneuverability*100).toFixed(0)}% / ≈ ${Math.round(result.shipState.turnRadiusFt)} фт</div>
      <div><strong>Загрузка:</strong><br> ${result.shipState.effectiveCargo.toFixed(2)} т (экипаж ${data.crewCount} чел ≈ ${crewWeight.toFixed(2)} т)</div>
    </div>

    <div style="margin-bottom:10px;">
      <strong>Режим:</strong> ${data.mode==='distance'?'По дистанции':`По времени (${data.time} ч)`}<br>
      <strong>Условия:</strong> ${windCourseLabel}, ${windForceLabel}, ${wavesLabel}
    </div>

    <div style="margin-bottom:10px;">
      ${modeLines}
    </div>

    <div>
      <strong>Штурвал:</strong> ${data.helm ? '✅ Да' : '❌ Нет'}
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
