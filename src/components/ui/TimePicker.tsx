import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "../../lib/utils";

type Period = "AM" | "PM";

export type TimePickerValue = string | null;

interface TimePickerProps {
  value?: TimePickerValue;
  onChange: (value: TimePickerValue) => void;
  label: string;
  className?: string;
  disabled?: boolean;
}

function parseTime(value: string | null | undefined): { hour: number; minute: number; period: Period } {
  if (!value) return { hour: 7, minute: 0, period: "AM" };
  const [h, m] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { hour: 7, minute: 0, period: "AM" };
  const period: Period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return {
    hour: Math.min(12, Math.max(1, hour)),
    minute: Math.min(59, Math.max(0, m)),
    period,
  };
}

function formatTime(hour: number, minute: number, period: Period): string {
  let hour24 = hour;
  if (period === "AM" && hour === 12) hour24 = 0;
  else if (period === "PM" && hour !== 12) hour24 = hour + 12;
  return `${hour24.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export function TimePicker({ value, onChange, label, className, disabled = false }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseTime(value), [value]);
  const hour = parsed.hour;
  const minute = parsed.minute;
  const period = parsed.period;

  const updateTime = (nextHour: number, nextMinute: number, nextPeriod: Period) => {
    if (disabled) return;
    onChange(formatTime(nextHour, nextMinute, nextPeriod));
  };

  const incrementHour = () => updateTime(hour === 12 ? 1 : hour + 1, minute, period);
  const decrementHour = () => updateTime(hour === 1 ? 12 : hour - 1, minute, period);
  const incrementMinute = () => updateTime(hour, minute === 55 ? 0 : minute + 5, period);
  const decrementMinute = () => updateTime(hour, minute === 0 ? 55 : minute - 5, period);
  const togglePeriod = (next: Period) => updateTime(hour, minute, next);

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (disabled) return;
    onChange(null);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const display = value ? `${hour}:${minute.toString().padStart(2, "0")} ${period}` : "--:-- --";
  const isFilled = Boolean(value);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <label
        className={cn(
          "absolute left-3 transition-all pointer-events-none",
          isOpen || isFilled
            ? "top-0 -translate-y-1/2 bg-white dark:bg-slate-900 px-1 text-xs text-blue-600"
            : "top-1/2 -translate-y-1/2 text-sm text-slate-500"
        )}
      >
        {label}
      </label>

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(true)}
        aria-label={label}
        aria-expanded={isOpen}
        className={cn(
          "w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-left",
          "flex items-center justify-between gap-2",
          isOpen && "ring-2 ring-blue-500 border-blue-500",
          disabled && "cursor-not-allowed opacity-70"
        )}
      >
        <span className={cn("font-medium", value ? "text-slate-900 dark:text-slate-100" : "text-slate-400")}>
          {display}
        </span>
        <span className="flex items-center gap-2">
          {value ? (
            <X
              className="h-4 w-4 text-slate-400 hover:text-slate-600"
              onClick={handleClear}
              aria-label="Clear time"
            />
          ) : null}
        </span>
      </button>

      {isOpen ? (
        <div
          className="absolute top-full left-0 mt-1 z-50 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          role="dialog"
          aria-label={`${label} picker`}
        >
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={incrementHour}
              className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Increase hour"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-2xl font-semibold tabular-nums">{hour}</span>
            <button
              type="button"
              onClick={decrementHour}
              className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Decrease hour"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <span className="text-2xl font-semibold text-slate-700 dark:text-slate-200">:</span>

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={incrementMinute}
              className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Increase minutes"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-2xl font-semibold tabular-nums">
              {minute.toString().padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={decrementMinute}
              className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Decrease minutes"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div className="ml-2 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => togglePeriod("AM")}
              className={cn(
                "rounded px-2 py-1 text-sm font-medium",
                period === "AM"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              )}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => togglePeriod("PM")}
              className={cn(
                "rounded px-2 py-1 text-sm font-medium",
                period === "PM"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              )}
            >
              PM
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

