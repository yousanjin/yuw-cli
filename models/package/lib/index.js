'use strict';

const path = require('path');
const pkgDir = require('pkg-dir').sync;
const npminstall = require('npminstall');
const pathExists = require('path-exists').sync;
const fsExtra = require('fs-extra');
const formatPath = require('@yuw-cli-dev/format-path');
const log = require('@yuw-cli-dev/log');
const { isObject } = require('@yuw-cli-dev/utils');
const {
  getDefaultRegistry,
  getLatestNpmVersion,
} = require('@yuw-cli-dev/get-npm-info');

class Package {
  constructor(options) {
    if (!options) {
      throw new Error('Package类的options参数不能为空！');
    }
    if (!isObject(options)) {
      throw new Error('Package类的options参数必须是一个对象！');
    }
    this.targetPath = options.targetPath; // package的路径
    this.storeDir = options.storeDir; // package的存储路径
    this.packageName = options.packageName; // package名称
    this.packageVersion = options.packageVersion; // package版本号
    this.cacheFilePathPrefix = this.packageName.replace('/', '_');
  }
  get cacheFilePath() {
    return path.resolve(
      this.storeDir,
      `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`,
    );
  }
  getSpecialCacheFilePath(packageVersion) {
    return path.resolve(
      this.storeDir,
      `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`,
    );
  }
  async prepare() {
    if (this.storeDir && !pathExists(this.storeDir)) {
      fsExtra.mkdirpSync(this.storeDir);
    }
    if (this.packageVersion === 'latest') {
      this.packageVersion = await getLatestNpmVersion(this.packageName);
    }
  }
  // 判断当前package是否存在
  async exists() {
    if (this.storeDir) {
      await this.prepare();
      return pathExists(this.cacheFilePath);
    } else {
      return pathExists(this.targetPath);
    }
  }
  // 安装package
  async install() {
    await this.prepare();
    return npminstall({
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
  async update() {
    await this.prepare();
    // 获取最新版本号
    const latestPackageVersion = await getLatestNpmVersion(this.packageName);
    // 查询最新版本号对应的缓存路径是否存在
    const latestFilePath = this.getSpecialCacheFilePath(latestPackageVersion);
    log.verbose('latestFilePath', latestFilePath);
    log.verbose('latestPackageVersion', latestPackageVersion);

    if (!pathExists(latestFilePath)) {
      await npminstall({
        root: this.targetPath,
        storeDir: this.storeDir,
        registry: getDefaultRegistry(),
        pkgs: [
          {
            name: this.packageName,
            version: latestPackageVersion,
          },
        ],
      });
    }
    this.packageVersion = latestPackageVersion;
  }
  // 获取入口文件路径
  getRootFilePath() {
    const _getRootFile = targetPath => {
      // 获取package.json所在目录
      const dir = pkgDir(targetPath);
      if (dir) {
        // 读取package.json
        const pkgFile = require(path.resolve(dir, 'package.json'));
        // 寻找main入口文件
        if (pkgFile && pkgFile.main) {
          return formatPath(path.resolve(dir, pkgFile.main));
        }
        return null;
      }
      return null;
    };
    if (this.storeDir) {
      return _getRootFile(this.cacheFilePath);
    } else {
      return _getRootFile(this.targetPath);
    }
  }
}

module.exports = Package;
