"use strict";

function normalizeSingleLine(value, maxLength) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeMultiline(value, maxLength) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r/g, "")
    .trim()
    .slice(0, maxLength);
}

function sanitize(value) {
  return String(value || "")
    .replace(/[\r\n]/g, " ")
    .slice(0, 300);
}

module.exports = {
  normalizeSingleLine,
  normalizeMultiline,
  sanitize,
};
