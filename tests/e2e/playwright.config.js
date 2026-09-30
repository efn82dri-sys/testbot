const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js/,
  timeout: 30000,
  expect: { timeout: 5000 },
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  webServer: { command: 'python mock_server.py', cwd: __dirname, port: 4173, reuseExistingServer: false, timeout: 10000 }
});
