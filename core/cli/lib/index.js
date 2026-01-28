"use strict";

module.exports = core;

const path = require("path");
const colors = require("colors/safe");
const semver = require("semver");
const userHome = require("user-home");
const pathExists = require("path-exists").sync;
const pkg = require("../package.json");
const log = require("@yuw-cli-dev/log");
const constants = require("./const");

function core() {
  try {
    checkPkgVersion();
    checkNodeVersion();
    checkRoot();
    checkUserHome();
    checkInputArgs();
    checkEnv();
  } catch (error) {
    log.error(error.message);
  }
}
function checkPkgVersion() {
  log.info("cli", pkg.version);
}

function checkNodeVersion() {
  const currentVersion = process.version;
  const lowestVersion = constants.LOWEST_NODE_VERSION;
  if (!semver.gte(currentVersion, lowestVersion)) {
    throw new Error(
      colors.red(
        `yuw-cli 需要安装 v${lowestVersion} 以上版本的 Node.js，当前版本为 ${currentVersion}，请升级您的 Node.js 版本。`,
      ),
    );
  }
}

function checkRoot() {
  const rootCheck = require("root-check");
  rootCheck();
}

function checkUserHome() {
  console.log(userHome);
  if (!userHome || !pathExists(userHome)) {
    throw new Error(colors.red("当前登录用户主目录不存在！"));
  }
}

function checkInputArgs() {
  const minimist = require("minimist");
  const args = minimist(process.argv.slice(2));
  checkArgs(args);
}

function checkArgs(args) {
  if (args.debug) {
    process.env.LOG_LEVEL = "verbose";
  } else {
    process.env.LOG_LEVEL = "info";
  }
  log.level = process.env.LOG_LEVEL;
}

function checkEnv() {
  const dotenv = require("dotenv");
  const dotenvPath = path.resolve(userHome, ".env");
  if (pathExists(dotenvPath)) {
    dotenv.config({
      path: dotenvPath,
    });
  }
  createDefaultConfig();
  log.verbose("环境变量", process.env.CLI_HOME_PATH);
}

function createDefaultConfig() {
  const cliConfig = {
    home: userHome,
  };
  if (process.env.CLI_HOME_PATH) {
    cliConfig.cliHome = path.join(userHome, process.env.CLI_HOME_PATH);
  } else {
    cliConfig.cliHome = path.join(userHome, constants.DEFAULT_CLI_HOME);
  }
  process.env.CLI_HOME_PATH = cliConfig.cliHome;
}
