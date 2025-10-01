export const SHOT_STATUS_VALUES = ["todo", "in_progress", "complete", "on_hold"];
export const DEFAULT_SHOT_STATUS = "todo";

const STATUS_SET = new Set(SHOT_STATUS_VALUES);

export const isShotStatusValue = (value) =>
  typeof value === "string" && STATUS_SET.has(value);

export const normaliseShotStatus = (value) =>
  isShotStatusValue(value) ? value : DEFAULT_SHOT_STATUS;

export const shotStatusOptions = SHOT_STATUS_VALUES.map((value) => ({
  value,
  label:
    value === "todo"
      ? "To do"
      : value === "in_progress"
      ? "In progress"
      : value === "on_hold"
      ? "On hold"
      : "Complete",
}));
