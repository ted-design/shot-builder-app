export function normalizeHumanName(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function splitFullName(fullName) {
  const normalized = normalizeHumanName(fullName);
  if (!normalized) return { firstName: "", lastName: "" };

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1] || "",
  };
}

export function joinNameParts(firstName, lastName) {
  const first = normalizeHumanName(firstName);
  const last = normalizeHumanName(lastName);
  return `${first} ${last}`.trim();
}

