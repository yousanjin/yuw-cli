'use strict';

const fs = require('fs');
const path = require('path');
const inquire = require('inquirer');
const fse = require('fs-extra');
const semver = require('semver');
const isValidFilename = require('valid-filename');
const Command = require('@yuw-cli-dev/command');
const log = require('@yuw-cli-dev/log');
const getProjectTemplate = require('./getProjectTemplate');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

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
      }
    } catch (e) {
      log.error(e.message);
    }
  }
  downloadTemplate() {
    return getProjectTemplate();
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
        if (ifContinue) {
          fse.emptyDirSync(localPath);
        }
      }
    }
    return this.getProjectInfo();
  }
  async getProjectInfo() {
    let projectInfo = {};
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
    log.verbose('type', type);
    if (type === TYPE_PROJECT) {
      const project = await inquire.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: '请输入项目名称',
          default: '',
          validate(v) {
            const done = this.async();
            setTimeout(() => {
              if (!isValidFilename(v)) {
                done('项目名称不合法');
                return;
              }
              done(null, true);
            }, 0);
          },
          filter(v) {
            return v;
          },
        },
        {
          type: 'input',
          name: 'projectVersion',
          message: '请输入项目版本号',
          default: '1.0.0',
          validate(v) {
            const done = this.async();
            setTimeout(() => {
              if (!!semver.valid(v) === false) {
                done('项目版本号不合法');
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
        },
        {
          type: 'list',
          name: 'projectTemplate',
          message: '请选择项目模板',
          choices: this.createTemplateChoices(),
        },
      ]);
      projectInfo = { ...project, type };
    } else if (type === TYPE_COMPONENT) {
    }
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
