import { useMemo, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  ALL_MEASUREMENT_OPTIONS,
  MEASUREMENT_LABEL_MAP,
  getMeasurementOptionsForGender,
  orderMeasurementKeys,
} from "./measurementOptions";
import {
  coerceMeasurementNumber,
  getMeasurementInputKind,
  inchesToFeetInches,
} from "../../lib/measurements";

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
      const kind = getMeasurementInputKind(key);
      const nextValue = kind === "height"
        ? { unit: "in", value: "" }
        : kind === "inches"
        ? { unit: "in", value: "" }
        : kind === "us"
        ? { unit: "us", value: "" }
        : "";
      onChange({ ...measurements, [key]: measurements[key] ?? nextValue });
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
            const kind = getMeasurementInputKind(key);
            const rawValue = measurements[key];
            const numericValue = coerceMeasurementNumber(key, measurements[key]);
            const heightParts = kind === "height" ? inchesToFeetInches(numericValue) : null;
            const numericInputValue =
              kind === "inches" || kind === "us"
                ? rawValue && typeof rawValue === "object" && Object.prototype.hasOwnProperty.call(rawValue, "value")
                  ? rawValue.value
                  : rawValue
                : null;
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
                {kind === "height" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Feet
                      </div>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={9}
                        value={heightParts?.feet ?? ""}
                        onChange={(event) => {
                          const nextFeet = event.target.value;
                          const currentInches = heightParts?.inches ?? 0;
                          if (!nextFeet) {
                            handleValueChange(key, { unit: "in", value: "" });
                            return;
                          }
                          const feetNumber = Number(nextFeet);
                          if (!Number.isFinite(feetNumber) || feetNumber <= 0) {
                            handleValueChange(key, { unit: "in", value: "" });
                            return;
                          }
                          handleValueChange(key, { unit: "in", value: feetNumber * 12 + currentInches });
                        }}
                        placeholder="5"
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Inches
                      </div>
                      <select
                        value={heightParts?.inches ?? 0}
                        onChange={(event) => {
                          const currentFeet = heightParts?.feet ?? null;
                          const nextInches = Number(event.target.value);
                          if (currentFeet === null || !Number.isFinite(nextInches)) {
                            handleValueChange(key, { unit: "in", value: "" });
                            return;
                          }
                          handleValueChange(key, { unit: "in", value: currentFeet * 12 + nextInches });
                        }}
                        disabled={disabled || heightParts?.feet === null}
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 dark:border-slate-700 dark:bg-slate-900"
                      >
                        {Array.from({ length: 12 }, (_, idx) => (
                          <option key={idx} value={idx}>
                            {idx}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : kind === "inches" ? (
                  <div className="space-y-1">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.25"
                      min="0"
                      value={numericInputValue ?? ""}
                      onChange={(event) => handleValueChange(key, { unit: "in", value: event.target.value })}
                      placeholder="e.g. 32"
                      disabled={disabled}
                    />
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Inches</div>
                  </div>
                ) : kind === "us" ? (
                  <div className="space-y-1">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      value={numericInputValue ?? ""}
                      onChange={(event) => handleValueChange(key, { unit: "us", value: event.target.value })}
                      placeholder="e.g. 10"
                      disabled={disabled}
                    />
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">US size</div>
                  </div>
                ) : (
                  <Input
                    value={measurements[key] || ""}
                    onChange={(event) => handleValueChange(key, event.target.value)}
                    placeholder="Add value"
                    disabled={disabled}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
