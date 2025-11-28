const express = require('express');
const NodeMediaServer = require('node-media-server');

const app = express();
const HTTP_PORT = process.env.PORT || 8080;
const RTMP_PORT = process.env.RTMP_PORT || 1935;

// Statische Dateien für den Web-Player
app.use(express.static('public'));

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
      <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
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
        }
        .info-item strong {
          color: #495057;
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
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎵 Audio Stream</h1>
        
        <div class="player-card">
          <div id="status" class="status waiting">
            ⏳ Warte auf Stream...
          </div>
          
          <audio id="audioPlayer" controls>
            Dein Browser unterstützt kein Audio-Element.
          </audio>
          
          <button id="playBtn">▶️ Stream starten</button>
        </div>

        <div class="info-card">
          <h3>📡 OBS Einstellungen</h3>
          <div class="info-item">
            <strong>Service:</strong> Benutzerdefiniert
          </div>
          <div class="info-item">
            <strong>Server:</strong> rtmp://${host.split(':')[0]}:${RTMP_PORT}/live
          </div>
          <div class="info-item">
            <strong>Stream-Key:</strong> stream
          </div>
        </div>

        <div class="info-card">
          <h3>🔗 Stream-URLs</h3>
          <div class="info-item">
            <strong>HLS (empfohlen):</strong><br>
            ${protocol}://${host}/live/stream/index.m3u8
          </div>
          <div class="info-item">
            <strong>FLV:</strong><br>
            ${protocol}://${host}/live/stream.flv
          </div>
        </div>
      </div>

      <script>
        const video = document.getElementById('audioPlayer');
        const status = document.getElementById('status');
        const playBtn = document.getElementById('playBtn');
        const streamUrl = '${protocol}://${host}/live/stream/index.m3u8';

        let hls;

        playBtn.addEventListener('click', () => {
          if (Hls.isSupported()) {
            hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              video.play().catch(e => {
                status.className = 'status error';
                status.textContent = '❌ Fehler beim Abspielen';
              });
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) {
                status.className = 'status error';
                status.textContent = '❌ Stream nicht verfügbar';
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            video.play();
          }
          
          playBtn.disabled = true;
          playBtn.textContent = '▶️ Verbinde...';
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
        });
      </script>
    </body>
    </html>
  `);
});

// Health check endpoint für Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Node Media Server Konfiguration
const config = {
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: HTTP_PORT,
    allow_origin: '*',
    mediaroot: './media'
  },
  trans: {
    ffmpeg: '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        hlsPath: './media',
        dash: false
      }
    ]
  }
};

const nms = new NodeMediaServer(config);

// Event Listener
nms.on('prePublish', (id, StreamPath, args) => {
  console.log('[Stream gestartet]', `StreamPath=${StreamPath}`);
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[Stream beendet]', `StreamPath=${StreamPath}`);
});

// Server starten
nms.run();
app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════');
  console.log('   🚀 Audio Streaming Server läuft!');
  console.log('═══════════════════════════════════════════');
  console.log(`📺 HTTP Port: ${HTTP_PORT}`);
  console.log(`📡 RTMP Port: ${RTMP_PORT}`);
  console.log('═══════════════════════════════════════════');
});
