"use strict";

const log = require("npmlog");

log.level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : "info"; // debug显示

log.heading = "yuw-cli"; // 修改前缀
log.headingStyle = { fg: "red", bg: "white", bold: true }; // 前缀样式
log.addLevel("success", 2000, { fg: "green", bold: true }); // 添加自定义命令

module.exports = log;
