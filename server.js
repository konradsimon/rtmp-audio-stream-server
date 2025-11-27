const WebSocket = require('ws');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 443;

// Health check endpoint
app.get('/', (req, res) => {
  res.send('TouchDesigner Audio Stream Server läuft! 🎵');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    clients: clients.size,
    uptime: process.uptime()
  });
});

// HTTP Server
const server = require('http').createServer(app);

// WebSocket Server
const wss = new WebSocket.Server({ server });

const clients = new Set();

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`✅ Neuer Client: ${clientIp}`);
  
  ws.isSource = false;
  
  ws.on('message', (message) => {
    // Audio-Daten von TouchDesigner
    if (message instanceof Buffer) {
      ws.isSource = true;
      console.log(`📡 Audio empfangen: ${message.length} bytes`);
      
      // An alle Browser-Clients senden
      let sent = 0;
      clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN && !client.isSource) {
          client.send(message);
          sent++;
        }
      });
      console.log(`📤 Gesendet an ${sent} Clients`);
    } else {
      // Kontroll-Nachrichten
      try {
        const data = JSON.parse(message);
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (e) {
        console.error('❌ Ungültige Nachricht:', e);
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`👋 Client getrennt. Verbleibend: ${clients.size}`);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket Error:', error);
  });

  clients.add(ws);
  console.log(`👥 Gesamt Clients: ${clients.size}`);
});

server.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Server wird heruntergefahren...');
  server.close(() => {
    console.log('✅ Server geschlossen');
    process.exit(0);
  });
});
