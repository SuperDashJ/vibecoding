const http = require('http');
const fs = require('fs');
const path = require('path');

const models = require('./data/models.json');

const PORT = process.env.PORT || 3001;
const publicDir = path.join(__dirname, 'public');

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json'
};

const serveFile = (filePath, res) => {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
};

const server = http.createServer((req, res) => {
  if (req.url === '/api/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        count: models.length,
        models,
        lastUpdated: 'manual'
      })
    );
    return;
  }

  const safePath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log(`Is This Worth It? running on http://localhost:${PORT}`);
});
