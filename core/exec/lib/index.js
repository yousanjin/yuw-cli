"use strict";

const path = require("path");
const slash = require("slash");
const cp = require("child_process");
const Package = require("@yuw-cli-dev/package");
const log = require("@yuw-cli-dev/log");
const { normalizePath } = require("@yuw-cli-dev/utils");

const SETTINGS = {
  init: "@yuw-cli-dev/init",
};
const CACHE_DIR = "dependencies";

async function exec() {
  let targetPath = process.env.CLI_TARGET_PATH;
  let storeDir = "";
  let pkg;
  const homePath = process.env.CLI_HOME_PATH;

  log.verbose("targetPath", targetPath);
  log.verbose("homePath", homePath);

  const cmdObj = arguments[arguments.length - 1];
  const cmdName = cmdObj.name();
  const packageName = SETTINGS[cmdName];
  const packageVersion = "latest";

  if (!targetPath) {
    targetPath = path.resolve(homePath, CACHE_DIR);
    storeDir = path.resolve(targetPath, "node_modules");

    log.verbose("storeDir", storeDir);
    log.verbose("targetPath", targetPath);

    pkg = new Package({
      targetPath,
      storeDir,
      packageName,
      packageVersion,
    });

    if (await pkg.exists()) {
      // 更新package
      console.log("update package");
      await pkg.update();
    } else {
      // 安装package
      await pkg.install();
    }
  } else {
    pkg = new Package({
      targetPath,
      packageName,
      packageVersion,
    });
  }
  const rootFile = pkg.getRootFilePath();
  if (rootFile) {
    try {
      const args = Array.from(arguments);
      const o = Object.create(null);
      const cmdObj = args[args.length - 1];
      Object.keys(cmdObj).forEach((key) => {
        if (
          cmdObj.hasOwnProperty(key) &&
          !key.startsWith("_") &&
          key !== "parent"
        ) {
          o[key] = cmdObj[key];
        }
      });
      args[args.length - 1] = o;
      const code = `require('${normalizePath(rootFile)}').call(null, ${JSON.stringify(args)})`;
      const child = spawn("node", ["-e", code], {
        cwd: process.cwd(),
        stdio: "inherit",
      });
      child.on("error", (e) => {
        log.error(e.message);
        process.exit(1);
      });
      child.on("exit", (e) => {
        log.verbose("命令执行成功:" + e);
        process.exit(e);
      });
    } catch (error) {
      log.error(error.message);
    }
  }
}

function spawn(command, args, options) {
  const win32 = process.platform === "win32";
  const cmd = win32 ? "cmd" : command;
  const cmdArgs = win32 ? ["/c"].concat(command, args) : args;
  return cp.spawn(cmd, cmdArgs, options || {});
}

module.exports = exec;
