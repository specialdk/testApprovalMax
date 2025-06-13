// ApprovalMax Callback Catcher - Minimal Railway App
// File: server.js

const express = require('express');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

// ApprovalMax configuration
const AM_CONFIG = {
    clientId: process.env.APPROVALMAX_CLIENT_ID || '2A81A6DEEAA244C188D518BA59601780',
    clientSecret: process.env.APPROVALMAX_CLIENT_SECRET,
    tokenUrl: 'https://identity.approvalmax.com/connect/token',
    apiUrl: 'https://public-api.approvalmax.com/api/v1'
};

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
                        `<div class="success">✅ Authorization Code Received!</div>` :
                        `<div class="error">❌ Error - ${cb.error}</div>`
                    }
                    <strong>URL:</strong> <div class="code">${cb.url}</div>
                    <strong>Parameters:</strong>
                    <pre class="code">${JSON.stringify(cb.params, null, 2)}</pre>
                    
                    ${cb.tokenExchange ? `
                        <strong>Token Exchange:</strong>
                        ${cb.tokenExchange.success ? 
                            `<div class="success">✅ Success - Access token obtained!</div>
                             <div class="code">Access Token: ${cb.tokenExchange.accessToken}
Expires In: ${cb.tokenExchange.expiresIn} seconds
${cb.tokenExchange.refreshToken ? `Refresh Token: ${cb.tokenExchange.refreshToken}` : ''}</div>` :
                            `<div class="error">❌ Failed - ${cb.tokenExchange.error}</div>`
                        }
                    ` : ''}
                    
                    ${cb.apiTest ? `
                        <strong>API Test:</strong>
                        ${cb.apiTest.success ? 
                            `<div class="success">✅ Success - ${cb.apiTest.dataCount} items retrieved from ${cb.apiTest.endpoint}</div>
                             <div class="code">${JSON.stringify(cb.apiTest.sampleData, null, 2)}</div>` :
                            `<div class="error">❌ Failed - ${cb.apiTest.error}</div>`
                        }
                    ` : ''}
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
app.get('/callback', async (req, res) => {
    const timestamp = new Date().toISOString();
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    // Force HTTPS for redirect URI to match ApprovalMax app registration
    const redirectUri = 'https://' + req.get('host') + '/callback';
    
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

    // If we have an authorization code, try to exchange it for tokens
    if (req.query.code && AM_CONFIG.clientSecret) {
        try {
            console.log('🔄 Attempting token exchange...');
            
            const tokenResponse = await fetch(AM_CONFIG.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: AM_CONFIG.clientId,
                    client_secret: AM_CONFIG.clientSecret,
                    redirect_uri: redirectUri,
                    code: req.query.code
                })
            });

            const tokenData = await tokenResponse.json();
            
            if (tokenResponse.ok && tokenData.access_token) {
                console.log('✅ Token exchange successful');
                callbackData.tokenExchange = {
                    success: true,
                    accessToken: tokenData.access_token.substring(0, 20) + '...',
                    refreshToken: tokenData.refresh_token ? tokenData.refresh_token.substring(0, 20) + '...' : null,
                    expiresIn: tokenData.expires_in,
                    tokenType: tokenData.token_type
                };

                // Test API call with the new token
                try {
                    console.log('🧪 Testing API call...');
                    const apiResponse = await fetch(`${AM_CONFIG.apiUrl}/companies`, {
                        headers: {
                            'Authorization': `Bearer ${tokenData.access_token}`,
                            'Accept': 'application/json'
                        }
                    });
                    
                    const apiData = await apiResponse.json();
                    
                    if (apiResponse.ok) {
                        console.log('✅ API test successful');
                        callbackData.apiTest = {
                            success: true,
                            endpoint: '/companies',
                            dataCount: Array.isArray(apiData) ? apiData.length : 'N/A',
                            sampleData: Array.isArray(apiData) && apiData.length > 0 ? apiData[0] : apiData
                        };
                    } else {
                        console.log('❌ API test failed');
                        callbackData.apiTest = {
                            success: false,
                            error: apiData.error || 'API call failed',
                            status: apiResponse.status
                        };
                    }
                } catch (apiError) {
                    console.log('❌ API test error:', apiError.message);
                    callbackData.apiTest = {
                        success: false,
                        error: apiError.message
                    };
                }

            } else {
                console.log('❌ Token exchange failed');
                callbackData.tokenExchange = {
                    success: false,
                    error: tokenData.error || 'Token exchange failed',
                    errorDescription: tokenData.error_description,
                    status: tokenResponse.status
                };
            }

        } catch (error) {
            console.log('❌ Token exchange error:', error.message);
            callbackData.tokenExchange = {
                success: false,
                error: error.message
            };
        }
    }

    // Update stored callback with token exchange results
    callbacks[0] = callbackData;

    // Display the result immediately
    if (req.query.code) {
        const tokenInfo = callbackData.tokenExchange;
        const apiInfo = callbackData.apiTest;
        
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>ApprovalMax Complete Test Results</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .success { background: #ecfdf5; border: 2px solid #10b981; color: #047857; padding: 20px; border-radius: 12px; margin: 15px 0; }
        .error { background: #fef2f2; border: 2px solid #ef4444; color: #dc2626; padding: 20px; border-radius: 12px; margin: 15px 0; }
        .warning { background: #fffbeb; border: 2px solid #f59e0b; color: #92400e; padding: 20px; border-radius: 12px; margin: 15px 0; }
        .code { font-family: monospace; background: #f3f4f6; padding: 10px; border-radius: 6px; margin: 10px 0; word-break: break-all; font-size: 12px; }
        button { background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin: 10px 5px; }
        button:hover { background: #059669; }
        h2 { margin-top: 30px; color: #374151; }
        .step { margin: 20px 0; padding: 15px; border-left: 4px solid #e5e7eb; }
        .step.success { border-left-color: #10b981; }
        .step.error { border-left-color: #ef4444; }
    </style>
</head>
<body>
    <h1>🧪 ApprovalMax Complete Test Results</h1>
    
    <div class="step success">
        <h2>✅ Step 1: OAuth Authorization</h2>
        <p><strong>Status:</strong> SUCCESS</p>
        <p><strong>Authorization Code:</strong></p>
        <div class="code">${req.query.code}</div>
        ${req.query.state ? `<p><strong>State:</strong> <span class="code">${req.query.state}</span></p>` : ''}
    </div>
    
    <div class="step ${tokenInfo ? (tokenInfo.success ? 'success' : 'error') : 'error'}">
        <h2>${tokenInfo && tokenInfo.success ? '✅' : '❌'} Step 2: Token Exchange</h2>
        ${tokenInfo ? (tokenInfo.success ? `
            <div class="success">
                <p><strong>Status:</strong> SUCCESS</p>
                <p><strong>Access Token:</strong> ${tokenInfo.accessToken}</p>
                <p><strong>Token Type:</strong> ${tokenInfo.tokenType}</p>
                <p><strong>Expires In:</strong> ${tokenInfo.expiresIn} seconds</p>
                ${tokenInfo.refreshToken ? `<p><strong>Refresh Token:</strong> ${tokenInfo.refreshToken}</p>` : ''}
            </div>
        ` : `
            <div class="error">
                <p><strong>Status:</strong> FAILED</p>
                <p><strong>Error:</strong> ${tokenInfo.error}</p>
                ${tokenInfo.errorDescription ? `<p><strong>Description:</strong> ${tokenInfo.errorDescription}</p>` : ''}
                ${tokenInfo.status ? `<p><strong>HTTP Status:</strong> ${tokenInfo.status}</p>` : ''}
            </div>
        `) : `
            <div class="warning">
                <p><strong>Status:</strong> SKIPPED</p>
                <p>No client secret provided - add APPROVALMAX_CLIENT_SECRET environment variable to test token exchange</p>
            </div>
        `}
    </div>
    
    <div class="step ${apiInfo ? (apiInfo.success ? 'success' : 'error') : 'error'}">
        <h2>${apiInfo && apiInfo.success ? '✅' : '❌'} Step 3: API Test</h2>
        ${apiInfo ? (apiInfo.success ? `
            <div class="success">
                <p><strong>Status:</strong> SUCCESS</p>
                <p><strong>Endpoint:</strong> ${apiInfo.endpoint}</p>
                <p><strong>Data Count:</strong> ${apiInfo.dataCount}</p>
                <p><strong>Sample Data:</strong></p>
                <div class="code">${JSON.stringify(apiInfo.sampleData, null, 2)}</div>
            </div>
        ` : `
            <div class="error">
                <p><strong>Status:</strong> FAILED</p>
                <p><strong>Error:</strong> ${apiInfo.error}</p>
                ${apiInfo.status ? `<p><strong>HTTP Status:</strong> ${apiInfo.status}</p>` : ''}
            </div>
        `) : `
            <div class="warning">
                <p><strong>Status:</strong> SKIPPED</p>
                <p>Token exchange failed - cannot test API</p>
            </div>
        `}
    </div>
    
    <h2>📋 Summary</h2>
    <div class="${tokenInfo && tokenInfo.success && apiInfo && apiInfo.success ? 'success' : 'warning'}">
        ${tokenInfo && tokenInfo.success && apiInfo && apiInfo.success ? 
            '<p><strong>🎉 COMPLETE SUCCESS!</strong> ApprovalMax integration is fully working. You can now implement this in your main dashboard.</p>' :
            '<p><strong>⚠️ PARTIAL SUCCESS</strong> OAuth flow works, but check the steps above for any issues with token exchange or API access.</p>'
        }
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
        <button onclick="window.location.href='/'">🏠 Back to Home</button>
        <button onclick="copyResults()">📋 Copy Full Results</button>
    </div>
    
    <script>
        function copyResults() {
            const results = 'ApprovalMax Test Results:\\n' +
                'OAuth: ✅ SUCCESS\\n' +
                'Token Exchange: ${tokenInfo && tokenInfo.success ? '✅ SUCCESS' : '❌ FAILED'}\\n' +
                'API Test: ${apiInfo && apiInfo.success ? '✅ SUCCESS' : '❌ FAILED'}\\n\\n' +
                'Auth Code: ${req.query.code}\\n' +
                '${tokenInfo && tokenInfo.success ? 'Access Token: ' + tokenInfo.accessToken : ''}\\n' +
                '${apiInfo && apiInfo.success ? 'API Data Count: ' + apiInfo.dataCount : ''}';
            
            navigator.clipboard.writeText(results).then(() => {
                alert('Test results copied to clipboard!');
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
