// core/utils.js — FIAT v1 (helpers lògics)

// -----------------------------
// BULL / BEAR / BODY
// -----------------------------
export function isBull(o, c) {
  return c > o;
}

export function isBear(o, c) {
  return c < o;
}

export function body(o, c) {
  return Math.abs(c - o);
}

// -----------------------------
// DATE HELPERS FIAT v1 (robustos)
// -----------------------------
export function formatSpainTime(tsMs) {
  if (tsMs === null || tsMs === undefined) return "-";

  // Convertir a número de forma segura
  const n = Number(String(tsMs).trim());
  if (!Number.isFinite(n)) return "-";

  const d = new Date(n);
  if (isNaN(d.getTime())) return "-";

  return d.toLocaleTimeString("es-ES", {
    hour12: false,
    timeZone: "Europe/Madrid"
  });
}


export function splitSpainDate(tsMs) {
  const n = Number(String(tsMs).trim());
  const d = new Date(n);

  if (isNaN(d.getTime())) {
    return {
      date_es: "-",
      hora_es: "-",
      timestamp_es: n
    };
  }

  const dateFormatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const timeFormatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const dateParts = dateFormatter.formatToParts(d);
  const day   = dateParts.find(p => p.type === "day").value;
  const month = dateParts.find(p => p.type === "month").value;
  const year  = dateParts.find(p => p.type === "year").value;

  const timeParts = timeFormatter.formatToParts(d);
  const hour   = timeParts.find(p => p.type === "hour").value;
  const minute = timeParts.find(p => p.type === "minute").value;
  const second = timeParts.find(p => p.type === "second").value;

  return {
    date_es: `${day}/${month}/${year}`,
    hora_es: `${hour}:${minute}:${second}`,
    timestamp_es: n
  };
}


export function getDay(tsMs) {
  const n = Number(String(tsMs).trim());
  const d = new Date(n);
  if (isNaN(d.getTime())) return null;
  return d.getDay();
}

export function calcSimpleTrend(candles30m, lookback = 20) {
  if (!candles30m || candles30m.length < lookback + 1) {
    return 0; // sense dades
  }

  const slice = candles30m.slice(-lookback - 1);
  let higherHighs = 0;
  let lowerLows = 0;

  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1];
    const curr = slice[i];

    if (curr.high > prev.high) higherHighs++;
    if (curr.low < prev.low) lowerLows++;
  }

  // tendència clara alcista
  if (higherHighs >= lookback * 0.6 && lowerLows <= lookback * 0.3) {
    return +1;
  }

  // tendència clara baixista
  if (lowerLows >= lookback * 0.6 && higherHighs <= lookback * 0.3) {
    return -1;
  }

  return 0; // rang / mixt
}
