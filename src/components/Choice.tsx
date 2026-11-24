"use client";

import { useId } from "react";

/** A group of tap-to-choose chips. Native radios underneath, so keyboard and screen readers work as expected. */
export function ChipGroup<V extends string>({
  legend,
  value,
  options,
  onChange,
  hint,
  hideLegend = false,
}: {
  legend: string;
  value: V;
  options: ReadonlyArray<{ value: V; label: string }>;
  onChange: (value: V) => void;
  hint?: string;
  hideLegend?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="chips-field">
      <legend className={hideLegend ? "sr-only" : undefined}>{legend}</legend>
      <div className="chip-row">
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          return (
            <span className="chip-opt" key={o.value}>
              <input id={id} type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
              <label htmlFor={id}>{o.label}</label>
            </span>
          );
        })}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </fieldset>
  );
}

/** An on/off switch with a visible text label. */
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="toggle">
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
