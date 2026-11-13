const numbers = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 });

export function formatPrice(price) {
  return `NT$ ${numbers.format(price)}`;
}

export function formatDate(date) {
  return date.replaceAll("-", "/");
}

export function attachChartHover(canvas, guide, tooltip, date, price) {
  let plot;
  function hide() {
    guide.hidden = true;
    tooltip.hidden = true;
  }

  canvas.addEventListener("pointermove", event => {
    if (!plot) return;
    const { points, left, right, top, bottom } = plot;
    const { offsetX, offsetY } = event;
    if (offsetX < left - 5 || offsetX > right + 5 || offsetY < top - 5 || offsetY > bottom) {
      hide();
      return;
    }

    const point = points.reduce((nearest, candidate) => {
      const dx = Math.abs(candidate.x - offsetX);
      const nearestDx = Math.abs(nearest.x - offsetX);
      const closerVertically = Math.abs(candidate.y - offsetY) < Math.abs(nearest.y - offsetY);
      return dx < nearestDx || (dx === nearestDx && closerVertically) ? candidate : nearest;
    });

    guide.style.left = `${point.x}px`;
    guide.style.top = `${top}px`;
    guide.style.height = `${bottom - top}px`;
    guide.style.setProperty("--point-y", `${point.y - top}px`);
    guide.hidden = false;

    date.textContent = formatDate(point.date);
    date.dateTime = point.date.replace(" ", "T");
    price.textContent = formatPrice(point.price);
    tooltip.hidden = false;
    const tooltipWidth = tooltip.offsetWidth;
    const rightSide = point.x + 10;
    const tooltipLeft = rightSide + tooltipWidth <= canvas.clientWidth
      ? rightSide
      : Math.max(0, point.x - tooltipWidth - 10);
    tooltip.style.left = `${tooltipLeft}px`;
  });
  canvas.addEventListener("pointerleave", hide);
  canvas.addEventListener("pointercancel", hide);

  return nextPlot => {
    plot = nextPlot;
    hide();
  };
}

export function drawChart(canvas, { prices, lowest, latest }) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.setAttribute("aria-label", `價格走勢圖，最低 ${formatPrice(lowest.price)}，最新 ${formatPrice(latest.price)}`);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.font = '10px "Microsoft JhengHei", system-ui, sans-serif';
  ctx.textBaseline = "middle";

  const top = 9;
  const bottom = height - 26;
  const right = width - 5;
  const maximum = prices.reduce((max, entry) => Math.max(max, entry.price), lowest.price);
  const span = maximum - lowest.price;
  const padding = Math.max(span * .12, 1);
  const lowerBound = Math.max(0, lowest.price - padding);
  const upperBound = maximum + padding;
  const ticks = [upperBound, (upperBound + lowerBound) / 2, lowerBound];
  const left = Math.max(...ticks.map(value => ctx.measureText(numbers.format(value)).width)) + 9;

  const firstTime = prices[0].timestamp;
  const duration = latest.timestamp - firstTime;
  const x = timestamp => duration ? left + (timestamp - firstTime) / duration * (right - left) : (left + right) / 2;
  const y = price => top + (upperBound - price) / (upperBound - lowerBound) * (bottom - top);
  const points = prices.map(point => ({
    date: point.date,
    price: point.price,
    x: x(point.timestamp),
    y: y(point.price),
  }));

  for (const tick of ticks) {
    const line = y(tick);
    ctx.strokeStyle = "#34433b";
    ctx.beginPath();
    ctx.moveTo(left, line);
    ctx.lineTo(right, line);
    ctx.stroke();
    ctx.fillStyle = "#aab8af";
    ctx.fillText(numbers.format(tick), 0, line);
  }

  const firstDay = prices[0].date.slice(0, 10);
  const lastDay = latest.date.slice(0, 10);
  const middleDay = new Date(firstTime + duration / 2).toISOString().slice(0, 10);
  ctx.fillStyle = "#aab8af";
  ctx.textAlign = "center";
  if (firstDay === lastDay || (middleDay !== firstDay && middleDay !== lastDay)) {
    ctx.fillText(formatDate(middleDay), (left + right) / 2, bottom + 13);
  }
  if (firstDay !== lastDay) {
    ctx.textAlign = "left";
    ctx.fillText(formatDate(firstDay), left, bottom + 13);
    ctx.textAlign = "right";
    ctx.fillText(formatDate(lastDay), right, bottom + 13);
  }

  ctx.strokeStyle = "#74ad8c";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(left, y(lowest.price));
  ctx.lineTo(right, y(lowest.price));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#9cebc0";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.fillStyle = "#9cebc0";
  ctx.beginPath();
  ctx.arc(points.at(-1).x, points.at(-1).y, 3, 0, Math.PI * 2);
  ctx.fill();
  return { points, left, right, top, bottom };
}
