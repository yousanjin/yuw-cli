'use strict';

module.exports = core;

const path = require('path');
const colors = require('colors/safe');
const semver = require('semver');
const userHome = require('user-home');
const Commander = require('commander');
const pathExists = require('path-exists').sync;
const pkg = require('../package.json');
const log = require('@yuw-cli-dev/log');
const exec = require('@yuw-cli-dev/exec');
const constants = require('./const');
const program = new Commander.Command();

async function core() {
  try {
    perpare();
    registerCommand();
  } catch (error) {
    log.error(error.message);
  }
}

async function perpare() {
  checkPkgVersion();
  checkNodeVersion();
  checkRoot();
  checkUserHome();
  // checkInputArgs();
  checkEnv();
  await checkGlobalUpdate();
}

function checkPkgVersion() {
  log.info('cli', pkg.version);
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
  const rootCheck = require('root-check');
  rootCheck();
}

function checkUserHome() {
  if (!userHome || !pathExists(userHome)) {
    throw new Error(colors.red('当前登录用户主目录不存在！'));
  }
}

function checkInputArgs() {
  const minimist = require('minimist');
  const args = minimist(process.argv.slice(2));
  checkArgs(args);
}

function checkArgs(args) {
  if (args.debug) {
    process.env.LOG_LEVEL = 'verbose';
  } else {
    process.env.LOG_LEVEL = 'info';
  }
  log.level = process.env.LOG_LEVEL;
}

function checkEnv() {
  const dotenv = require('dotenv');
  const dotenvPath = path.resolve(userHome, '.env');
  if (pathExists(dotenvPath)) {
    dotenv.config({
      path: dotenvPath,
    });
  }
  createDefaultConfig();
  log.verbose('环境变量', process.env.CLI_HOME_PATH);
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

async function checkGlobalUpdate() {
  const currentVersion = pkg.version;
  const npmName = pkg.name;
  const { getNpmSemverVersion } = require('@yuw-cli-dev/get-npm-info');
  const latestVersion = await getNpmSemverVersion(npmName, currentVersion);
  if (latestVersion && semver.gt(latestVersion, currentVersion)) {
    log.warn(
      '更新提示',
      colors.yellow(
        `请手动更新 ${npmName}，当前版本：${currentVersion}，最新版本：${latestVersion}，更新命令：npm install -g ${npmName}`,
      ),
    );
  }
}

function registerCommand() {
  program.name(Object.keys(pkg.bin)[0]);
  program
    .version(pkg.version)
    .usage('<command> [options]')
    .option('-d, --debug', '是否开启调试模式', false)
    .option('-t, --targetPath <targetPath>', '是否指定本地调试文件路径', '');

  program
    .command('init [projectName]')
    .option('-f, --force', '是否强制初始化项目')
    .action(exec);

  program.on('option:debug', function () {
    const options = program.opts();
    if (options.debug) {
      process.env.LOG_LEVEL = 'verbose';
    } else {
      process.env.LOG_LEVEL = 'info';
    }
    log.level = process.env.LOG_LEVEL;
    log.verbose('debug', '已开启调试模式');
  });

  program.on('option:targetPath', function (targetPath) {
    process.env.CLI_TARGET_PATH = targetPath;
  });

  program.on('command:*', function (obj) {
    const availableCommands = program.commands.map(cmd => cmd.name());
    console.log(colors.red('未知的命令：' + obj[0]));
    if (availableCommands.length > 0) {
      console.log(colors.red('可用命令：' + availableCommands.join(',')));
    }
  });

  program.parse(process.argv);
  if (program.args && program.args.length < 1) {
    program.outputHelp();
    console.log();
  }
}
