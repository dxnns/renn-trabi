"use strict";

const crypto = require("node:crypto");

function hashSensitive(value, salt) {
  return crypto
    .createHash("sha256")
    .update(`${salt}:${String(value || "")}`)
    .digest("hex")
    .slice(0, 24);
}

function timingSafeEqualText(a, b) {
  const aDigest = crypto.createHash("sha256").update(String(a)).digest();
  const bDigest = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(aDigest, bDigest);
}

module.exports = {
  hashSensitive,
  timingSafeEqualText,
};
