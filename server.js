// ApprovalMax Callback Catcher - Minimal Railway App
// File: server.js

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Store callbacks in memory for this session
let callbacks = [];

// Serve basic HTML page
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>ApprovalMax Callback Catcher</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #8B5A96 0%, #6A4C93 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        h1 { color: #2d3748; text-align: center; }
        .info { background: #eff6ff; border: 1px solid #3b82f6; color: #1d4ed8; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .callback { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .success { background: #ecfdf5; border: 1px solid #10b981; color: #047857; padding: 15px; border-radius: 8px; }
        .error { background: #fef2f2; border: 1px solid #ef4444; color: #dc2626; padding: 15px; border-radius: 8px; }
        .code { font-family: monospace; background: #f3f4f6; padding: 8px; border-radius: 4px; font-size: 14px; }
        button { background: #8B5A96; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin: 5px; }
        button:hover { background: #6A4C93; }
        .timestamp { color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 ApprovalMax Callback Catcher</h1>
        
        <div class="info">
            <strong>📡 Callback URL:</strong><br>
            <div class="code">${req.get('host')}/callback</div>
            <br>
            <strong>📋 How to use:</strong><br>
            1. Use the URL above as your ApprovalMax redirect URI<br>
            2. Complete the OAuth flow<br>
            3. Check this page to see what ApprovalMax sent back<br>
        </div>

        <div style="text-align: center; margin: 20px 0;">
            <button onclick="window.location.reload()">🔄 Refresh Page</button>
            <button onclick="clearCallbacks()">🗑️ Clear History</button>
            <button onclick="window.location.href='/status'">📊 Status</button>
        </div>

        <h3>Recent Callbacks (${callbacks.length})</h3>
        ${callbacks.length === 0 ?
            '<div class="info">No callbacks received yet. Complete the ApprovalMax OAuth flow to see results here.</div>' :
            callbacks.map((cb, index) => `
                <div class="callback">
                    <strong>Callback #${callbacks.length - index}</strong>
                    <span class="timestamp">${cb.timestamp}</span>
                    ${cb.success ?
                    `<div class="success">✅ Success - Authorization Code Received!</div>` :
                    `<div class="error">❌ Error - ${cb.error}</div>`
                }
                    <strong>URL:</strong> <div class="code">${cb.url}</div>
                    <strong>Parameters:</strong>
                    <pre class="code">${JSON.stringify(cb.params, null, 2)}</pre>
                </div>
            `).join('')
        }
    </div>
    
    <script>
        function clearCallbacks() {
            fetch('/clear', { method: 'POST' })
                .then(() => window.location.reload());
        }
    </script>
</body>
</html>
    `);
});

// Main callback endpoint - this is where ApprovalMax will redirect
app.get('/callback', (req, res) => {
    const timestamp = new Date().toISOString();
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

    console.log('🎯 ApprovalMax Callback Received:', {
        timestamp,
        url: fullUrl,
        query: req.query,
        headers: {
            'user-agent': req.get('user-agent'),
            'referer': req.get('referer')
        }
    });

    const callbackData = {
        timestamp,
        url: fullUrl,
        params: req.query,
        success: !!req.query.code,
        error: req.query.error || (req.query.code ? null : 'No authorization code received')
    };

    // Store callback (keep last 10)
    callbacks.unshift(callbackData);
    if (callbacks.length > 10) callbacks = callbacks.slice(0, 10);

    // Display the result immediately
    if (req.query.code) {
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>ApprovalMax Callback Success</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .success { background: #ecfdf5; border: 2px solid #10b981; color: #047857; padding: 20px; border-radius: 12px; text-align: center; }
        .code { font-family: monospace; background: #f3f4f6; padding: 10px; border-radius: 6px; margin: 10px 0; word-break: break-all; }
        button { background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin: 10px 5px; }
        button:hover { background: #059669; }
    </style>
</head>
<body>
    <div class="success">
        <h1>🎉 ApprovalMax Authorization Successful!</h1>
        <p><strong>Authorization Code Received:</strong></p>
        <div class="code">${req.query.code}</div>
        
        ${req.query.state ? `<p><strong>State:</strong> <span class="code">${req.query.state}</span></p>` : ''}
        
        <p><strong>Full Callback URL:</strong></p>
        <div class="code">${fullUrl}</div>
        
        <div style="margin-top: 20px;">
            <button onclick="copyCode()">📋 Copy Auth Code</button>
            <button onclick="window.location.href='/'">🏠 Back to Home</button>
        </div>
    </div>
    
    <script>
        function copyCode() {
            navigator.clipboard.writeText('${req.query.code}').then(() => {
                alert('Authorization code copied to clipboard!');
            });
        }
    </script>
</body>
</html>
        `);
    } else if (req.query.error) {
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>ApprovalMax Callback Error</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .error { background: #fef2f2; border: 2px solid #ef4444; color: #dc2626; padding: 20px; border-radius: 12px; text-align: center; }
        .code { font-family: monospace; background: #f3f4f6; padding: 10px; border-radius: 6px; margin: 10px 0; }
        button { background: #ef4444; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin: 10px 5px; }
        button:hover { background: #dc2626; }
    </style>
</head>
<body>
    <div class="error">
        <h1>❌ ApprovalMax Authorization Failed</h1>
        <p><strong>Error:</strong> ${req.query.error}</p>
        ${req.query.error_description ? `<p><strong>Description:</strong> ${req.query.error_description}</p>` : ''}
        
        <p><strong>Full Callback URL:</strong></p>
        <div class="code">${fullUrl}</div>
        
        <button onclick="window.location.href='/'">🏠 Back to Home</button>
    </div>
</body>
</html>
        `);
    } else {
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>ApprovalMax Callback - Unknown</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .info { background: #eff6ff; border: 2px solid #3b82f6; color: #1d4ed8; padding: 20px; border-radius: 12px; }
        .code { font-family: monospace; background: #f3f4f6; padding: 10px; border-radius: 6px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="info">
        <h1>🤔 ApprovalMax Callback Received</h1>
        <p>A callback was received, but it doesn't contain an authorization code or error.</p>
        
        <p><strong>Full URL:</strong></p>
        <div class="code">${fullUrl}</div>
        
        <p><strong>Parameters:</strong></p>
        <pre class="code">${JSON.stringify(req.query, null, 2)}</pre>
        
        <button onclick="window.location.href='/'">🏠 Back to Home</button>
    </div>
</body>
</html>
        `);
    }
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        callbackUrl: `https://${req.get('host')}/callback`,
        callbacksReceived: callbacks.length,
        recentCallbacks: callbacks.slice(0, 3)
    });
});

// Clear callbacks
app.post('/clear', (req, res) => {
    callbacks = [];
    res.json({ success: true, message: 'Callbacks cleared' });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
    console.log(`🎯 ApprovalMax Callback Catcher running on port ${port}`);
    console.log(`📡 Callback URL will be: https://your-app-name.up.railway.app/callback`);
});