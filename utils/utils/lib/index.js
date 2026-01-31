"use strict";

function isObject(o) {
  return Object.prototype.toString.call(o) === "[object Object]";
}

function normalizePath(path) {
  return path.replace(/[\\/]+/g, "/");
}

module.exports = { isObject, normalizePath };
