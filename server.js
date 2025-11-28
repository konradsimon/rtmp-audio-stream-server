const express = require('express');
const NodeMediaServer = require('node-media-server');
const fs = require('fs');
const path = require('path');

const app = express();
// Trust proxy for correct HTTPS detection on Railway
app.set('trust proxy', true);
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
            <strong>HTTP-FLV (für VLC Player):</strong>
            ${protocol}://${host}/live/stream.flv
          </div>
          <div class="note">
            📱 Dieser Link funktioniert in VLC Media Player. Für Browser wird flv.js verwendet.
          </div>
        </div>
      </div>

      <script>
        const video = document.getElementById('audioPlayer');
        const status = document.getElementById('status');
        const playBtn = document.getElementById('playBtn');
        const streamUrl = '${protocol}://${host}/live/stream.flv';

        let isPlaying = false;
        let flvPlayer = null;

        playBtn.addEventListener('click', () => {
          if (!isPlaying) {
            status.className = 'status waiting';
            status.textContent = '⏳ Verbinde...';
            playBtn.disabled = true;
            playBtn.textContent = '▶️ Verbinde...';
            
            // Verwende flv.js für FLV-Streaming
            if (typeof flvjs !== 'undefined' && flvjs.isSupported()) {
              if (flvPlayer) {
                flvPlayer.destroy();
              }
              
              flvPlayer = flvjs.createPlayer({
                type: 'flv',
                url: streamUrl,
                isLive: true,
                hasAudio: true,
                hasVideo: true
              });
              
              flvPlayer.attachMediaElement(video);
              flvPlayer.load();
              
              flvPlayer.on(flvjs.Events.LOADING_COMPLETE, () => {
                console.log('Stream geladen');
              });
              
              flvPlayer.on(flvjs.Events.RECOVERED_EARLY_EOF, () => {
                console.log('Stream wiederhergestellt');
              });
              
              flvPlayer.on(flvjs.Events.ERROR, (errorType, errorDetail, errorInfo) => {
                console.error('FLV Error:', errorType, errorDetail, errorInfo);
                status.className = 'status error';
                status.textContent = '❌ Stream-Fehler - Läuft OBS?';
                playBtn.disabled = false;
                playBtn.textContent = '🔄 Erneut versuchen';
                isPlaying = false;
              });
              
              video.play().then(() => {
                isPlaying = true;
              }).catch(e => {
                console.error('Fehler:', e);
                status.className = 'status error';
                status.textContent = '❌ Konnte nicht abspielen - Läuft OBS?';
                playBtn.disabled = false;
                playBtn.textContent = '🔄 Erneut versuchen';
              });
            } else {
              status.className = 'status error';
              status.textContent = '❌ Browser unterstützt FLV nicht (flv.js fehlt)';
              playBtn.disabled = false;
              playBtn.textContent = '🔄 Erneut versuchen';
            }
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

        video.addEventListener('error', (e) => {
          console.error('Video Error:', e);
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

        // Cleanup beim Verlassen
        window.addEventListener('beforeunload', () => {
          if (flvPlayer) {
            flvPlayer.destroy();
          }
        });
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
  const streamPath = path.join(mediaDir, 'live', 'stream', 'index.m3u8');
  const streamExists = fs.existsSync(streamPath);
  
  // Check directory structure
  const liveDir = path.join(mediaDir, 'live');
  const streamDir = path.join(mediaDir, 'live', 'stream');
  const liveDirExists = fs.existsSync(liveDir);
  const streamDirExists = fs.existsSync(streamDir);
  
  let files = [];
  if (streamDirExists) {
    try {
      files = fs.readdirSync(streamDir);
    } catch (e) {
      // Ignore
    }
  }
  
  res.json({
    active: nms.getSession ? true : false,
    hlsExists: streamExists,
    hlsPath: streamPath,
    mediaDir: mediaDir,
    liveDirExists: liveDirExists,
    streamDirExists: streamDirExists,
    files: files
  });
});

// Node Media Server Konfiguration - OHNE Transcoding (HTTP-FLV funktioniert ohne FFmpeg)
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
  // Kein trans config - HTTP-FLV funktioniert ohne FFmpeg
  logType: 3 // Mehr detaillierte Logs
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
  console.log('[Stream] HLS sollte erstellt werden in:', path.join(mediaDir, 'live', StreamPath.replace('/live/', ''), 'index.m3u8'));
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[Stream] Beendet:', StreamPath);
});

// Listen for transcoding events
nms.on('preTrans', (id, StreamPath, args) => {
  console.log('[Transcode] ⚡ Start transcoding:', StreamPath, 'ID:', id);
  console.log('[Transcode] Args:', JSON.stringify(args));
});

nms.on('postTrans', (id, StreamPath, args) => {
  console.log('[Transcode] ✅ Transcoding success:', StreamPath);
  const expectedPath = path.join(mediaDir, 'live', StreamPath.replace('/live/', ''), 'index.m3u8');
  console.log('[Transcode] Expected HLS path:', expectedPath);
  if (fs.existsSync(expectedPath)) {
    console.log('[Transcode] ✅ HLS file exists!');
  } else {
    console.log('[Transcode] ❌ HLS file NOT found at:', expectedPath);
  }
});

nms.on('doneTrans', (id, StreamPath, args) => {
  console.log('[Transcode] 🛑 Transcoding stopped:', StreamPath);
});

// Listen for all Node Media Server events to debug
nms.on('preConnect', (id, args) => {
  console.log('[NMS] preConnect:', id, args);
});

nms.on('postConnect', (id, args) => {
  console.log('[NMS] postConnect:', id, args);
});

nms.on('prePublish', (id, StreamPath, args) => {
  console.log('[NMS] prePublish:', id, StreamPath, args);
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[NMS] postPublish:', id, StreamPath, args);
  console.log('[NMS] Checking if trans config matches app "live"');
});

// Proxy für HTTP-FLV Stream von NodeMediaServer zu Express
// HTTP-FLV funktioniert ohne FFmpeg - Node Media Server serviert es direkt
app.get('/live/:streamName([^/]+)\\.flv', (req, res) => {
  const streamName = req.params.streamName;
  const flvUrl = `http://127.0.0.1:8888/live/${streamName}.flv`;
  
  console.log('[FLV Proxy] Request:', streamName, '->', flvUrl);
  
  const http = require('http');
  
  // Setze Headers
  res.setHeader('Content-Type', 'video/x-flv');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  
  let isAborted = false;
  
  const proxyReq = http.get(flvUrl, (proxyRes) => {
    console.log('[FLV Proxy] Response status:', proxyRes.statusCode, 'for', streamName);
    
    if (isAborted) {
      proxyRes.destroy();
      return;
    }
    
    if (proxyRes.statusCode !== 200) {
      console.error('[FLV Proxy] Fehler Status:', proxyRes.statusCode);
      if (!res.headersSent) {
        res.status(503).send('Stream nicht verfügbar - Läuft OBS?');
      }
      return;
    }
    
    res.status(200);
    
    // Pipe den Stream direkt durch
    proxyRes.on('data', (chunk) => {
      if (!isAborted && !res.destroyed) {
        res.write(chunk);
      }
    });
    
    proxyRes.on('end', () => {
      console.log('[FLV Proxy] Stream beendet');
      if (!isAborted && !res.destroyed) {
        res.end();
      }
    });
    
    proxyRes.on('error', (err) => {
      console.error('[FLV Proxy] Stream Error:', err.message);
      if (!isAborted && !res.headersSent) {
        res.status(500).end();
      } else if (!isAborted && !res.destroyed) {
        res.end();
      }
    });
  });
  
  proxyReq.on('error', (err) => {
    console.error('[FLV Proxy] Request error:', err.message);
    if (!isAborted && !res.headersSent) {
      res.status(503).send('Stream nicht verfügbar - Läuft OBS?');
    }
  });
  
  // Cleanup bei Client-Disconnect
  req.on('close', () => {
    if (!isAborted) {
      console.log('[FLV Proxy] Client getrennt');
      isAborted = true;
      proxyReq.destroy();
      if (!res.destroyed) {
        res.destroy();
      }
    }
  });
  
  req.on('aborted', () => {
    if (!isAborted) {
      console.log('[FLV Proxy] Request aborted');
      isAborted = true;
      proxyReq.destroy();
      if (!res.destroyed) {
        res.destroy();
      }
    }
  });
  
  req.on('error', (err) => {
    if (!isAborted) {
      console.error('[FLV Proxy] Request Error:', err.message);
      isAborted = true;
      proxyReq.destroy();
    }
  });
  
  res.on('close', () => {
    if (!isAborted) {
      console.log('[FLV Proxy] Response geschlossen');
      isAborted = true;
      proxyReq.destroy();
    }
  });
});

// Server starten
console.log('═══════════════════════════════════════════');
console.log('   🚀 Starte Node Media Server...');
console.log(`   📡 RTMP Port: ${RTMP_PORT}`);
console.log(`   📺 Internal HTTP: 8888`);
console.log(`   📁 Media Root: ${mediaDir}`);
console.log(`   🎬 HTTP-FLV Streaming (kein FFmpeg nötig)`);
console.log('═══════════════════════════════════════════');

nms.run();

app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════');
  console.log('   ✅ Express Server läuft!');
  console.log(`   🌐 HTTP Port: ${HTTP_PORT}`);
  console.log('═══════════════════════════════════════════');
});
