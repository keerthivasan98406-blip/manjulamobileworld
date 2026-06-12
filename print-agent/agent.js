/**
 * Manjula Mobiles - Print Agent
 * 
 * Runs on the shop PC. Listens on port 9101.
 * The website sends TSPL to this agent, which prints directly to the Zenpert.
 * 
 * Setup:
 *   1. Install Node.js (nodejs.org)
 *   2. Double-click start-agent.bat
 *   3. Done — agent runs silently in background
 */

const http = require('http');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const PORT = 9101;
const PRINTER_NAME = 'Zenpert 4T520'; // Display name (for info only)
const PRINTER_PORT = 'USB001';         // Windows port name — run: wmic printer get name,portname

const server = http.createServer((req, res) => {
  // Allow cross-origin requests from the website
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { tspl } = JSON.parse(body);
        if (!tspl) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'No TSPL data' }));
          return;
        }

        // Write to temp file — use project folder to avoid short-path issues
        const tmpFile = path.join(__dirname, `label-${Date.now()}.prn`);
        fs.writeFileSync(tmpFile, tspl, 'binary');

        console.log('Temp file:', tmpFile);
        console.log('Exists:', fs.existsSync(tmpFile));

        // Send directly to printer port — bypasses Windows dialog entirely
        // Using port name (USB001) is more reliable than printer display name
        const cmd = `copy /b "${tmpFile}" ${PRINTER_PORT}`;
        exec(cmd, (error) => {
          try { fs.unlinkSync(tmpFile); } catch(e) {}
          if (error) {
            console.error('❌ Print failed:', error.message);
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
          } else {
            console.log('✅ Printed label to:', PRINTER_NAME, '(port:', PRINTER_PORT + ')');
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
          }
        });
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'Manjula Print Agent running', printer: PRINTER_NAME }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔═════════════════════════════════════════╗');
  console.log('║   MANJULA MOBILES - Print Agent         ║');
  console.log('╚═════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ Agent running on port ${PORT}`);
  console.log(`🖨️  Printer: ${PRINTER_NAME}`);
  console.log('');
  console.log('Website can now print directly — no dialog!');
  console.log('Keep this window open while using the website.');
  console.log('');
});
