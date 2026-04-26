const APP_LOCALE = "es-ES";
export const APP_TIME_ZONE = "Europe/Madrid";

type DateValue = Date | string | number;

function toDate(value: DateValue) {
  return value instanceof Date ? value : new Date(value);
}

export function formatMadridDateTime(
  value: DateValue,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
  },
) {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    ...options,
  }).format(toDate(value));
}

export function formatMadridDate(
  value: DateValue,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
  },
) {
  return formatMadridDateTime(value, options);
}

export function formatMadridTime(
  value: DateValue,
  options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  },
) {
  return formatMadridDateTime(value, options);
}
