import type { Route } from "next";
import Link from "next/link";

type PeriodMode = "month" | "year";

type PeriodSelectorProps = {
  action: string;
  hiddenFields?: Record<string, string | number | undefined>;
  mode: PeriodMode;
  month: number;
  monthHref: Route;
  title?: string;
  year: number;
  yearHref: Route;
  years: number[];
};

const MONTH_OPTIONS = [
  { label: "Enero", value: 1 },
  { label: "Febrero", value: 2 },
  { label: "Marzo", value: 3 },
  { label: "Abril", value: 4 },
  { label: "Mayo", value: 5 },
  { label: "Junio", value: 6 },
  { label: "Julio", value: 7 },
  { label: "Agosto", value: 8 },
  { label: "Septiembre", value: 9 },
  { label: "Octubre", value: 10 },
  { label: "Noviembre", value: 11 },
  { label: "Diciembre", value: 12 },
];

function getPeriodLabel(mode: PeriodMode, month: number, year: number) {
  if (mode === "year") {
    return String(year);
  }

  const monthLabel = MONTH_OPTIONS.find((option) => option.value === month)?.label ?? "Mes";
  return `${monthLabel} ${year}`;
}

export function PeriodSelector({
  action,
  hiddenFields,
  mode,
  month,
  monthHref,
  title = "Periodo activo",
  year,
  yearHref,
  years,
}: PeriodSelectorProps) {
  return (
    <section className="period-selector" aria-label="Selector de periodo">
      <div className="period-selector-header">
        <div>
          <p className="card-label">{title}</p>
          <strong>{getPeriodLabel(mode, month, year)}</strong>
        </div>
        <div className="period-selector-toggle">
          <Link
            href={monthHref}
            className={`button ${mode === "month" ? "button-primary" : "button-secondary"}`}
          >
            Mes
          </Link>
          <Link
            href={yearHref}
            className={`button ${mode === "year" ? "button-primary" : "button-secondary"}`}
          >
            Año
          </Link>
        </div>
      </div>

      <form action={action} method="get" className="period-selector-form">
        {hiddenFields
          ? Object.entries(hiddenFields).map(([name, value]) =>
              value == null || value === "" ? null : (
                <input key={name} type="hidden" name={name} value={String(value)} />
              ),
            )
          : null}
        <input type="hidden" name="mode" value={mode} />
        <label>
          <span>Año</span>
          <select name="year" defaultValue={String(year)}>
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Mes</span>
          <select name="month" defaultValue={String(month)} disabled={mode === "year"}>
            {MONTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-primary" type="submit">
          Aplicar
        </button>
      </form>
    </section>
  );
}
