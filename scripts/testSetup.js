require('global-jsdom/register');

const Module = require('module');
Module._extensions['.vue'] = function (module, filename) {
  module._compile('export default {};', filename);
};

function makeIpcProxy() {
  const cache = new Map();
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (!cache.has(property)) {
          cache.set(property, makeIpcProxy());
        }
        return cache.get(property);
      },
      apply() {
        return Promise.resolve();
      },
    }
  );
}

global.ipc = makeIpcProxy();
global.window = global.window || {};
global.window.ipc = global.ipc;
