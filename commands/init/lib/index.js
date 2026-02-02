'use strict';

const fs = require('fs');
const path = require('path');
const inquire = require('inquirer');
const fse = require('fs-extra');
const semver = require('semver');
const userHome = require('user-home');
const isValidFilename = require('valid-filename');
const glob = require('glob');
const ejs = require('ejs');
const Command = require('@yuw-cli-dev/command');
const log = require('@yuw-cli-dev/log');
const Package = require('@yuw-cli-dev/package');
const { spinnerStart, normalizePath, execSync } = require('@yuw-cli-dev/utils');
const getProjectTemplate = require('./getProjectTemplate');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';
const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';
const WHITE_COMMAND = ['npm', 'cnpm', 'yarn', 'pnpm'];

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || '';
    this.force = !!this._argv[1].force;
    log.verbose('projectName', this.projectName);
    log.verbose('force', this.force);
  }
  async exec() {
    try {
      const projectInfo = await this.prepare();
      log.verbose('projectInfo', projectInfo);
      if (projectInfo) {
        this.projectInfo = projectInfo;
        await this.downloadTemplate();
        await this.installTemplate();
      }
    } catch (e) {
      log.error(e.message);
    }
  }
  checkCommand(cmd) {
    if (WHITE_COMMAND.includes(cmd)) {
      return cmd;
    }
    return null;
  }

  async execCmd(pwd, command, errMsg) {
    const installCmdArr = command.split(' ');
    const installCmd = installCmdArr[0];
    const checkedCmd = this.checkCommand(installCmd);
    if (!checkedCmd) {
      throw new Error('命令不存在，请检查:', installCmd);
    }
    const installArgs = installCmdArr.slice(1);
    const ret = await execSync(checkedCmd, installArgs, {
      cwd: pwd,
      stdio: 'inherit',
    });
    if (ret !== 0) {
      throw new Error(errMsg);
    }
  }

  async ejsRender(options) {
    const dir = process.cwd();
    const projectInfo = this.projectInfo;
    return new Promise((resolve, reject) => {
      glob(
        '**',
        {
          cwd: dir,
          nodir: true,
          ignore: options && options.ignore,
        },
        (err, files) => {
          if (err) {
            reject(err);
            return;
          }
          Promise.all(
            files.map(file => {
              const filePath = path.join(dir, file);
              return new Promise((res, rej) => {
                ejs.renderFile(
                  filePath,
                  {
                    className: projectInfo.projectName,
                    version: projectInfo.projectVersion,
                    description: projectInfo.componentDescription,
                  },
                  {},
                  (e, result) => {
                    if (e) {
                      rej(e);
                      return;
                    }
                    fse.writeFileSync(filePath, result);
                    res();
                  },
                );
              });
            }),
          )
            .then(() => {
              resolve();
            })
            .catch(e => {
              reject(e);
            });
        },
      );
    });
  }

  async installTemplate() {
    if (this.templateInfo) {
      if (!this.templateInfo.type) {
        this.templateInfo.type = TEMPLATE_TYPE_NORMAL;
      }
      if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
        await this.installNormalTemplate();
      } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
        await this.installCustomTemplate();
      } else {
        throw new Error('无法识别项目模板类型');
      }
    } else {
      throw new Error('项目模板信息不存在');
    }

    // 进入指定目录
    process.chdir(path.resolve(process.cwd(), this.projectInfo.projectName));
    // ejs渲染
    const ignore = ['node_modules/**'];
    if (this.templateInfo.ignore && Array.isArray(this.templateInfo.ignore)) {
      ignore.push(...this.templateInfo.ignore);
    }
    await this.ejsRender({ ignore });
    // 安装依赖并启动项目
    const { installCommand, startCommand } = this.templateInfo;
    if (installCommand) {
      await this.execCmd(process.cwd(), installCommand, '依赖安装过程中失败');
    }
    if (startCommand) {
      await this.execCmd(process.cwd(), startCommand, '启动项目过程中失败');
    }
  }

  async installNormalTemplate() {
    let spinner;
    try {
      const templatePath = path.resolve(
        this.templateNpm.cacheFilePath,
        'template',
      );
      const targetPath = path.resolve(
        process.cwd(),
        this.projectInfo.projectName,
      );
      log.verbose('templatePath', templatePath);
      log.verbose('targetPath', targetPath);

      spinner = spinnerStart('正在安装模板...');
      fse.ensureDirSync(templatePath);
      fse.ensureDirSync(targetPath);
      fse.copySync(templatePath, targetPath);
    } catch (e) {
      throw e;
    } finally {
      spinner.stop(true);
      log.success('模板安装完成');
    }
  }
  async installCustomTemplate() {
    log.info('正在安装自定义模板...');
    if (await this.templateNpm.exists()) {
      const rootFile = this.templateNpm.getRootFilePath();
      log.verbose('自定义模板入口文件', rootFile);
      if (fse.existsSync(rootFile)) {
        const templatePath = path.resolve(
          this.templateNpm.cacheFilePath,
          'template',
        );
        const targetPath = path.resolve(
          process.cwd(),
          this.projectInfo.projectName,
        );
        const options = {
          templateInfo: this.templateInfo,
          projectInfo: this.projectInfo,
          templatePath,
          targetPath,
        };
        log.verbose('options', options);
        const code = `require('${normalizePath(rootFile)}')(${JSON.stringify(options)})`;
        log.verbose('自定义模板执行代码', code);
        await execSync('node', ['-e', code], {
          cwd: process.cwd(),
          stdio: 'inherit',
        });
        log.success('自定义模板安装完成');
      } else {
        throw new Error('自定义模板入口文件不存在');
      }
    } else {
      throw new Error('自定义模板不存在');
    }
  }
  async downloadTemplate() {
    const { projectTemplate } = this.projectInfo;
    const templateInfo = this.template.find(
      item => item.npmName === projectTemplate,
    );
    log.verbose('templateInfo', templateInfo);
    this.templateInfo = templateInfo;

    const targetPath = path.resolve(
      userHome,
      process.env.CLI_HOME_PATH,
      'template',
    );
    const storeDir = path.resolve(
      userHome,
      process.env.CLI_HOME_PATH,
      'template',
      'node_modules',
    );
    log.verbose('targetPath', targetPath);
    log.verbose('storeDir', storeDir);

    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: templateInfo.npmName,
      packageVersion: templateInfo.version,
    });
    if (!(await templateNpm.exists())) {
      const spinner = spinnerStart('正在下载模板...');
      try {
        await templateNpm.install();
      } catch (e) {
        throw e;
      } finally {
        spinner.stop(true);
        if (await templateNpm.exists()) {
          this.templateNpm = templateNpm;
          log.success('模板下载完成');
        }
      }
    } else {
      const spinner = spinnerStart('正在更新模板...');
      try {
        await templateNpm.update();
      } catch (error) {
        throw error;
      } finally {
        spinner.stop(true);
        if (await templateNpm.exists()) {
          this.templateNpm = templateNpm;
          log.success('模板更新完成');
        }
      }
    }
  }
  async prepare() {
    const template = await getProjectTemplate();
    if (!template || template.length === 0) {
      throw new Error('项目模板不存在');
    }
    this.template = template;
    log.verbose('template', template);

    const localPath = process.cwd();
    let isContinue = false;
    if (!this.isDirEmpty(localPath)) {
      if (!this.force) {
        const rs = await inquire.prompt({
          type: 'confirm',
          name: 'isContinue',
          message: '当前目录不为空，是否继续创建项目？（会清空当前目录）',
          default: false,
        });
        isContinue = rs.isContinue;
        if (!isContinue) {
          return;
        }
      }
      if (isContinue || this.force) {
        const { ifContinue } = await inquire.prompt({
          type: 'confirm',
          name: 'ifContinue',
          message: '是否确认清空当前目录下的文件？',
          default: false,
        });
        let spinner;
        if (ifContinue) {
          try {
            spinner = spinnerStart('正在清空目录...');
            fse.emptyDirSync(localPath);
          } catch (error) {
            throw error;
          } finally {
            spinner.stop(true);
          }
        }
      }
    }
    return this.getProjectInfo();
  }
  async getProjectInfo() {
    let projectInfo = {};
    let isProjectNameValid = false;
    if (isValidFilename(this.projectName)) {
      isProjectNameValid = true;
      projectInfo.projectName = this.projectName;
    }
    const { type } = await inquire.prompt({
      type: 'list',
      name: 'type',
      message: '请选择初始化的类型',
      default: TYPE_PROJECT,
      choices: [
        { name: '项目', value: TYPE_PROJECT },
        { name: '组件', value: TYPE_COMPONENT },
      ],
    });

    // 过滤模板
    this.template = this.template.filter(item => item.tag.includes(type));
    const defaultMesName = type === TYPE_PROJECT ? '项目' : '组件';
    const projectNamePrompt = {
      type: 'input',
      name: 'projectName',
      message: `请输入${defaultMesName}名称`,
      default: '',
      validate(v) {
        const done = this.async();
        setTimeout(() => {
          if (!isValidFilename(v)) {
            done(`${defaultMesName}名称不合法`);
            return;
          }
          done(null, true);
        }, 0);
      },
      filter(v) {
        return v;
      },
    };
    const promptArr = [];
    if (!isProjectNameValid) {
      promptArr.push(projectNamePrompt);
    }
    promptArr.push({
      type: 'input',
      name: 'projectVersion',
      message: `请输入${defaultMesName}版本号`,
      default: '1.0.0',
      validate(v) {
        const done = this.async();
        setTimeout(() => {
          if (!!semver.valid(v) === false) {
            done(`${defaultMesName}版本号不合法`);
            return;
          }
          done(null, true);
        }, 0);
      },
      filter(v) {
        if (!!semver.valid(v)) {
          return semver.valid(v);
        }
        return v;
      },
    });
    if (type === TYPE_COMPONENT) {
      promptArr.push({
        type: 'input',
        name: 'componentDescription',
        message: '请输入组件描述信息',
        default: '',
        validate(v) {
          const done = this.async();
          setTimeout(() => {
            if (!v) {
              done('组件描述信息不能为空');
              return;
            }
            done(null, true);
          }, 0);
        },
      });
    }
    promptArr.push({
      type: 'list',
      name: 'projectTemplate',
      message: `请选择${defaultMesName}模板`,
      choices: this.createTemplateChoices(),
    });
    const project = await inquire.prompt(promptArr);
    projectInfo = { ...projectInfo, ...project, type };
    return projectInfo;
  }

  createTemplateChoices() {
    return this.template.map(item => ({
      name: item.name,
      value: item.npmName,
    }));
  }

  isDirEmpty(localPath) {
    let fileList = fs.readdirSync(localPath);
    // 文件过滤逻辑
    fileList = fileList.filter(
      file => !file.startsWith('.') && !['node_modules'].includes(file),
    );
    return !fileList || fileList.length <= 0;
  }
}

function init(argv) {
  log.verbose('argv', argv);
  return new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;
