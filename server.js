const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const CSV_FILE = path.join(__dirname, 'waiting_list.csv');

// MIME types
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.csv': 'text/csv'
};

// Ensure CSV exists with header
if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, 'Email,Fecha Registro\n');
}

const server = http.createServer((req, res) => {
    // Enable CORS for development flexibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API Endpoint: Register
    if (req.url === '/api/register' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { email } = JSON.parse(body);
                if (!email) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Email required' }));
                    return;
                }

                const date = new Date().toISOString();
                const csvLine = `${email},${date}\n`;

                fs.appendFile(CSV_FILE, csvLine, (err) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to write to file' }));
                        return;
                    }
                    console.log(`[New User] ${email} added to CSV.`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, count: getCount() }));
                });
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // API Endpoint: Count
    if (req.url === '/api/count' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ count: getCount() }));
        return;
    }

    // Static File Serving
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath);
    let contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code == 'ENOENT') {
                fs.readFile(path.join(__dirname, '404.html'), (err, content) => {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end(content || '404 Not Found', 'utf-8');
                });
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            // Server-Side Rendering (SSR) for index.html counter
            if (filePath.endsWith('index.html')) {
                // Base 1250 + Real CSV Count
                const count = (1250 + getCount()).toLocaleString('es-ES');
                let html = content.toString();
                html = html.replace('{{COUNTER}}', count);
                content = Buffer.from(html);
            }

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

function getCount() {
    try {
        const content = fs.readFileSync(CSV_FILE, 'utf8');
        // Subtract 1 for header, create array of lines, filter empty
        return content.split('\n').filter(line => line.trim() !== '').length - 1;
    } catch (e) {
        return 0;
    }
}

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Waiting list saving to: ${CSV_FILE}`);
});
