// scripts/start.js – dynamically pick an available dev port (4200 or 4201)
const net = require('net');
const { spawn } = require('child_process');

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      })
      .listen(port);
  });
}

(async () => {
  const candidates = [4200, 4201];
  let chosenPort;
  for (const p of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(p)) { chosenPort = p; break; }
  }
  if (!chosenPort) {
    console.error('Both ports 4200 and 4201 are in use. Please free a port or modify the script.');
    process.exit(1);
  }
  console.log(`Starting Angular dev server on http://localhost:${chosenPort}`);
  const ng = spawn('npx', ['ng', 'serve', `--port=${chosenPort}`], { stdio: 'inherit', shell: true });
  ng.on('close', (code) => process.exit(code));
})();
