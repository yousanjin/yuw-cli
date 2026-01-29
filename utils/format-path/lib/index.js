"use strict";

const path = require("path");

function formatPath(path) {
  if (path && typeof path !== "string") {
    const sep = path.sep;
    if (sep !== "/") {
      return path;
    } else {
      return path.replace(/\\/g, "/");
    }
  }
  return path;
}
module.exports = formatPath;
