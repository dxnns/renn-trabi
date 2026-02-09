"use strict";

const path = require("node:path");

function resolveDataPath(rootDir, relativePath) {
  const absolute = path.resolve(rootDir, String(relativePath || ""));
  const rel = path.relative(rootDir, absolute);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("data_path_outside_root");
  }
  return absolute;
}

module.exports = {
  resolveDataPath,
};
