export const allowedNoteColors = ["#1f2937", "#6366f1", "#10b981", "#f43f5e", "#0f172a"];

const allowedTags = new Set(["strong", "em", "span", "p", "br", "ul", "ol", "li"]);

const normalizeColor = (value) => value?.toString().trim().toLowerCase() || "";

const removeElementKeepChildren = (element) => {
  while (element.firstChild) {
    element.parentNode.insertBefore(element.firstChild, element);
  }
  element.remove();
};

const replaceTag = (element, tagName) => {
  const doc = element.ownerDocument || document;
  const replacement = doc.createElement(tagName);
  while (element.firstChild) {
    replacement.appendChild(element.firstChild);
  }
  element.parentNode.replaceChild(replacement, element);
  return replacement;
};

const sanitizeElement = (element) => {
  const childNodes = Array.from(element.childNodes);
  for (let child of childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }

    let tag = child.tagName.toLowerCase();
    if (tag === "b") {
      child = replaceTag(child, "strong");
      tag = "strong";
    } else if (tag === "i") {
      child = replaceTag(child, "em");
      tag = "em";
    } else if (tag === "font") {
      child = replaceTag(child, "span");
      tag = "span";
    } else if (tag === "div") {
      child = replaceTag(child, "p");
      tag = "p";
    }

    if (!allowedTags.has(tag)) {
      removeElementKeepChildren(child);
      continue;
    }

    // Remove all attributes before adding back safe ones.
    while (child.attributes.length > 0) {
      child.removeAttribute(child.attributes[0].name);
    }

    if (tag === "span") {
      const style = child.style?.color;
      const attrColor = child.getAttribute?.("color");
      const dataColor = child.getAttribute?.("data-color");
      const colour = normalizeColor(style || attrColor || dataColor);
      if (allowedNoteColors.includes(colour)) {
        child.style.color = colour;
      } else {
        child.removeAttribute("style");
      }
    }

    sanitizeElement(child);
  }
};

export const sanitizeNotesHtml = (input) => {
  if (!input) return "";
  if (typeof window === "undefined") return String(input);
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${input}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";
  sanitizeElement(root);
  return root.innerHTML.replace(/\s+$/, "");
};

export const formatNotesForDisplay = (input) => {
  const source = input ? input.toString() : "";
  const enriched = source.includes("<") ? source : source.replace(/\n/g, "<br />");
  const sanitized = sanitizeNotesHtml(enriched);
  return sanitized || "";
};
