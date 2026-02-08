// Minimal vscode mock so extension.js can be required outside the VS Code host.
// Only the module-level require('vscode') needs to succeed — the pure functions
// we test don't use any vscode APIs.
module.exports = {};
