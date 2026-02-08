// Register a minimal vscode mock so extension.js can be required outside the extension host.
require('module')._cache[require.resolve('./vscode-mock')] =
    require('module')._cache[require.resolve('./vscode-mock')];

// Pre-populate the require cache with our mock under the 'vscode' key
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'vscode') {
        return require.resolve('./vscode-mock');
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
};
