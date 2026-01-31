const request = require('@yuw-cli-dev/request');

module.exports = async function () {
  return request({
    url: '/project/template',
    method: 'GET',
  });
};
