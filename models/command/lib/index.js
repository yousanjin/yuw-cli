"use strict";

const colors = require("colors/safe");
const semver = require("semver");
const log = require("@yuw-cli-dev/log");
const LOWEST_NODE_VERSION = "16.0.0";

class Command {
  constructor(argv) {
    if (!argv) {
      throw new Error("参数不能为空");
    }
    if (!Array.isArray(argv)) {
      throw new Error("参数必须为数组");
    }
    if (argv.length < 1) {
      throw new Error("参数列表不能为空");
    }
    this._argv = argv;
    this.runner = new Promise((resolve, reject) => {
      let chain = Promise.resolve();
      chain = chain.then(() => this.checkNodeVersion());
      chain = chain.then(() => this.initArgv());
      chain = chain.then(() => this.init());
      chain = chain.then(() => this.exec());
      chain.then(() => {
        resolve();
      });
      chain.catch((error) => {
        log.error(error.message);
      });
    });
  }
  initArgv() {
    this._cmd = this._argv[this._argv.length - 1];
    this._argv = this._argv.slice(0, this._argv.length - 1);
  }
  init() {
    throw new Error("init必须实现");
  }
  exec() {
    throw new Error("exec必须实现");
  }
  checkNodeVersion() {
    const currentVersion = process.version;
    const lowestVersion = LOWEST_NODE_VERSION;
    if (!semver.gte(currentVersion, lowestVersion)) {
      throw new Error(
        colors.red(
          `yuw-cli 需要安装 v${lowestVersion} 以上版本的 Node.js，当前版本为 ${currentVersion}，请升级您的 Node.js 版本。`,
        ),
      );
    }
  }
}

module.exports = Command;
