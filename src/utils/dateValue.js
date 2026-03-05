const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateValue(value, options = {}) {
  const { endOfDay = false } = options;

  if (!value) return null;

  let date;

  if (value instanceof Date) {
    date = new Date(value.getTime());
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    const match = DATE_ONLY_RE.exec(trimmed);

    if (match) {
      const [, year, month, day] = match;
      date = new Date(Number(year), Number(month) - 1, Number(day));
    } else {
      date = new Date(trimmed);
    }
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}
