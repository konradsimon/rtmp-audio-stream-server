const express = require('express');
const NodeMediaServer = require('node-media-server');
const fs = require('fs');
const path = require('path');

const app = express();
const HTTP_PORT = process.env.PORT || 3000;
const RTMP_PORT = 1935;

// Media-Verzeichnis erstellen
const mediaDir = path.join(__dirname, 'media');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}

// Statische Dateien
app.use('/media', express.static(mediaDir));

// Hauptseite mit Player
app.get('/', (req, res) => {
  const host = req.get('host');
  const protocol = req.protocol;
  
  res.send(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Audio Stream</title>
      <script src="https://cdn.jsdelivr.net/npm/flv.js@1.6.2/dist/flv.min.js"></script>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
        }
        h1 {
          color: white;
          text-align: center;
          margin-bottom: 30px;
          font-size: 2em;
        }
        .player-card {
          background: white;
          border-radius: 15px;
          padding: 30px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          margin-bottom: 20px;
        }
        #audioPlayer {
          width: 100%;
          margin: 20px 0;
        }
        .status {
          text-align: center;
          padding: 15px;
          border-radius: 10px;
          margin-bottom: 20px;
          font-weight: 500;
        }
        .status.waiting {
          background: #fff3cd;
          color: #856404;
        }
        .status.playing {
          background: #d4edda;
          color: #155724;
        }
        .status.error {
          background: #f8d7da;
          color: #721c24;
        }
        .info-card {
          background: white;
          border-radius: 15px;
          padding: 20px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          margin-bottom: 20px;
        }
        .info-card h3 {
          color: #667eea;
          margin-bottom: 15px;
        }
        .info-item {
          margin: 10px 0;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 5px;
          word-break: break-all;
          font-size: 14px;
        }
        .info-item strong {
          color: #495057;
          display: block;
          margin-bottom: 5px;
        }
        button {
          background: #667eea;
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          width: 100%;
          margin-top: 10px;
          transition: background 0.3s;
        }
        button:hover {
          background: #5568d3;
        }
        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .note {
          background: #e7f3ff;
          border-left: 4px solid #2196F3;
          padding: 12px;
          margin-top: 15px;
          border-radius: 4px;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎵 Audio Stream</h1>
        
        <div class="player-card">
          <div id="status" class="status waiting">
            ⏳ Warte auf Stream...
          </div>
          
          <video id="audioPlayer" controls style="width: 100%; max-height: 60px;">
            Dein Browser unterstützt diesen Player nicht.
          </video>
          
          <button id="playBtn">▶️ Stream starten</button>
          
          <div class="note">
            💡 <strong>Hinweis:</strong> Der Stream muss in OBS aktiv sein, damit du etwas hörst.
          </div>
        </div>

        <div class="info-card">
          <h3>📡 OBS Einstellungen</h3>
          <div class="info-item">
            <strong>Service:</strong>
            Benutzerdefiniert
          </div>
          <div class="info-item">
            <strong>Server:</strong>
            rtmp://turntable.proxy.rlwy.net:43644/live
          </div>
          <div class="info-item">
            <strong>Stream-Schlüssel:</strong>
            stream
          </div>
          <div class="note">
            ⚙️ In OBS: Einstellungen → Stream → Diese Daten eingeben
          </div>
        </div>

        <div class="info-card">
          <h3>🔗 Direkter Stream-Link</h3>
          <div class="info-item">
            <strong>FLV (für VLC Player):</strong>
            ${protocol}://${host}/live/stream.flv
          </div>
          <div class="note">
            📱 Dieser Link funktioniert auch in VLC Media Player auf dem Handy
          </div>
        </div>
      </div>

      <script>
        const video = document.getElementById('audioPlayer');
        const status = document.getElementById('status');
        const playBtn = document.getElementById('playBtn');
        const streamUrl = '${protocol}://${host}/live/stream.flv';

        let isPlaying = false;

        playBtn.addEventListener('click', () => {
          if (!isPlaying) {
            video.src = streamUrl;
            video.load();
            video.play().catch(e => {
              console.error('Fehler:', e);
              status.className = 'status error';
              status.textContent = '❌ Konnte nicht abspielen - Läuft OBS?';
            });
            
            playBtn.disabled = true;
            playBtn.textContent = '▶️ Verbinde...';
            isPlaying = true;
          }
        });

        video.addEventListener('playing', () => {
          status.className = 'status playing';
          status.textContent = '🎵 Stream läuft!';
          playBtn.textContent = '✓ Verbunden';
        });

        video.addEventListener('waiting', () => {
          status.className = 'status waiting';
          status.textContent = '⏳ Puffern...';
        });

        video.addEventListener('error', () => {
          status.className = 'status error';
          status.textContent = '❌ Stream nicht verfügbar - Startest du OBS?';
          playBtn.disabled = false;
          playBtn.textContent = '🔄 Erneut versuchen';
          isPlaying = false;
        });

        video.addEventListener('loadstart', () => {
          status.className = 'status waiting';
          status.textContent = '⏳ Lade Stream...';
        });

        // Automatische Reconnect-Logik
        setInterval(() => {
          if (video.paused && isPlaying && !video.ended) {
            console.log('Versuche Reconnect...');
            video.load();
            video.play().catch(e => console.log('Reconnect fehlgeschlagen'));
          }
        }, 5000);
      </script>
    </body>
    </html>
  `);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    ports: { http: HTTP_PORT, rtmp: RTMP_PORT }
  });
});

// API endpoint für Stream-Status
app.get('/api/stream/status', (req, res) => {
  res.json({
    active: nms.getSession ? true : false
  });
});

// Node Media Server Konfiguration (OHNE Trans/FFmpeg)
const config = {
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8888,
    allow_origin: '*',
    mediaroot: mediaDir
  },
  logType: 3 // Mehr detaillierte Logs
  // Trans/FFmpeg komplett entfernt - nicht nötig für FLV-Streaming
};

const nms = new NodeMediaServer(config);

// Event Listener
nms.on('preConnect', (id, args) => {
  console.log('[RTMP] Client verbindet:', id);
});

nms.on('postConnect', (id, args) => {
  console.log('[RTMP] Client verbunden:', id);
});

nms.on('doneConnect', (id, args) => {
  console.log('[RTMP] Client getrennt:', id);
});

nms.on('prePublish', (id, StreamPath, args) => {
  console.log('[Stream] Gestartet:', StreamPath);
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[Stream] Läuft:', StreamPath);
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[Stream] Beendet:', StreamPath);
});

// Proxy für FLV-Stream von NodeMediaServer zu Express
app.get('/live/:stream.flv', (req, res) => {
  const streamName = req.params.stream;
  const flvUrl = `http://127.0.0.1:8888/live/${streamName}.flv`;
  
  console.log('[Proxy] Stream angefordert:', streamName);
  
  const http = require('http');
  
  // Setze Headers vor dem Proxy
  res.setHeader('Content-Type', 'video/x-flv');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Transfer-Encoding', 'chunked');
  
  const proxyReq = http.get(flvUrl, (proxyRes) => {
    console.log('[Proxy] Verbunden mit internem Stream, Status:', proxyRes.statusCode);
    
    if (proxyRes.statusCode !== 200) {
      console.error('[Proxy] Fehler Status:', proxyRes.statusCode);
      res.status(503).send('Stream nicht verfügbar');
      return;
    }
    
    // Pipe den Stream direkt durch
    proxyRes.pipe(res, { end: true });
    
    proxyRes.on('error', (err) => {
      console.error('[Proxy] Stream Error:', err.message);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    
    proxyRes.on('end', () => {
      console.log('[Proxy] Stream beendet');
    });
  });
  
  proxyReq.on('error', (err) => {
    console.error('[Proxy] Verbindungsfehler:', err.message);
    if (!res.headersSent) {
      res.status(503).send('Stream nicht verfügbar - Läuft OBS?');
    }
  });
  
  // Cleanup bei Client-Disconnect
  req.on('close', () => {
    console.log('[Proxy] Client getrennt, beende Proxy');
    proxyReq.destroy();
  });
  
  req.on('error', (err) => {
    console.error('[Proxy] Request Error:', err.message);
    proxyReq.destroy();
  });
});

// Server starten
nms.run();
console.log('═══════════════════════════════════════════');
console.log('   🚀 Node Media Server gestartet');
console.log(`   📡 RTMP Port: ${RTMP_PORT}`);
console.log(`   📺 Internal HTTP: 8888`);
console.log('═══════════════════════════════════════════');

app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════');
  console.log('   ✅ Express Server läuft!');
  console.log(`   🌐 HTTP Port: ${HTTP_PORT}`);
  console.log('═══════════════════════════════════════════');
});
