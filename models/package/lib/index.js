"use strict";

const path = require("path");
const pkgDir = require("pkg-dir").sync;
const npminstall = require("npminstall");
const formatPath = require("@yuw-cli-dev/format-path");
const { isObject } = require("@yuw-cli-dev/utils");
const { getDefaultRegistry } = require("@yuw-cli-dev/get-npm-info");

class Package {
  constructor(options) {
    if (!options) {
      throw new Error("Package类的options参数不能为空！");
    }
    if (!isObject(options)) {
      throw new Error("Package类的options参数必须是一个对象！");
    }
    this.targetPath = options.targetPath; // package的路径
    this.storeDir = options.storeDir; // package的存储路径
    this.packageName = options.packageName; // package名称
    this.packageVersion = options.packageVersion; // package版本号
  }
  // 判断当前package是否存在
  exists() {}
  // 安装package
  install() {
    npminstall({
      root: this.targetPath,
      storeDir: this.storeDir,
      registry: getDefaultRegistry(),
      pkgs: [
        {
          name: this.packageName,
          version: this.packageVersion,
        },
      ],
    });
  }
  // 更新package
  update() {}
  // 获取入口文件路径
  getRootFilePath() {
    const dir = pkgDir(this.targetPath);
    if (dir) {
      const pkgFile = require(path.resolve(dir, "package.json"));
      if (pkgFile && pkgFile.main) {
        return formatPath(path.resolve(dir, pkgFile.main));
      }
      return null;
    }
    return null;
  }
}

module.exports = Package;
