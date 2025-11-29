import { useMemo, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  ALL_MEASUREMENT_OPTIONS,
  MEASUREMENT_LABEL_MAP,
  getMeasurementOptionsForGender,
  orderMeasurementKeys,
} from "./measurementOptions";

export default function MeasurementFields({
  gender,
  measurements = {},
  onChange,
  disabled = false,
}) {
  const [pendingKey, setPendingKey] = useState("");
  const optionsForGender = useMemo(() => getMeasurementOptionsForGender(gender), [gender]);
  const selectedKeys = Object.keys(measurements).filter((key) => measurements[key] !== undefined);
  const orderedKeys = useMemo(() => orderMeasurementKeys(measurements, gender), [measurements, gender]);
  const availableOptions = useMemo(() => {
    const selected = new Set(selectedKeys);
    const pool = optionsForGender.length ? optionsForGender : ALL_MEASUREMENT_OPTIONS;
    return pool.filter((entry) => !selected.has(entry.key));
  }, [optionsForGender, selectedKeys]);

  const handleAdd = () => {
    if (!pendingKey) return;
    const key = pendingKey;
    setPendingKey("");
    if (typeof onChange === "function") {
      onChange({ ...measurements, [key]: measurements[key] || "" });
    }
  };

  const handleRemove = (key) => {
    if (typeof onChange !== "function") return;
    const next = { ...measurements };
    delete next[key];
    onChange(next);
  };

  const handleValueChange = (key, value) => {
    if (typeof onChange !== "function") return;
    onChange({ ...measurements, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Measurements</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Add the fields that apply. Options adjust based on the selected gender.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pendingKey}
            onChange={(event) => setPendingKey(event.target.value)}
            disabled={disabled || availableOptions.length === 0}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Add measurement…</option>
            {availableOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <Button type="button" variant="secondary" size="sm" onClick={handleAdd} disabled={!pendingKey || disabled}>
            Add
          </Button>
        </div>
      </div>

      {orderedKeys.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No measurements added yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {orderedKeys.map((key) => {
            const label = MEASUREMENT_LABEL_MAP[key] || key;
            return (
              <div key={key} className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <span>{label}</span>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    onClick={() => handleRemove(key)}
                    disabled={disabled}
                  >
                    Remove
                  </button>
                </div>
                <Input
                  value={measurements[key] || ""}
                  onChange={(event) => handleValueChange(key, event.target.value)}
                  placeholder="Add value"
                  disabled={disabled}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
