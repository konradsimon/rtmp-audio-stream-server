const express = require('express');
const NodeMediaServer = require('node-media-server');
const fs = require('fs');
const path = require('path');

const app = express();
// Trust proxy for correct HTTPS detection on Railway
app.set('trust proxy', true);
const HTTP_PORT = process.env.PORT || 3000;
const RTMP_PORT = 1935;

// Media-Verzeichnis erstellen mit korrekten Berechtigungen
const mediaDir = path.join(__dirname, 'media');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true, mode: 0o755 });
  console.log('[Media] Created media directory:', mediaDir);
} else {
  console.log('[Media] Media directory exists:', mediaDir);
}

// Ensure media directory is writable
try {
  fs.accessSync(mediaDir, fs.constants.W_OK);
  console.log('[Media] ✅ Media directory is writable');
} catch (e) {
  console.error('[Media] ❌ Media directory is NOT writable:', e.message);
  // Try to fix permissions
  try {
    fs.chmodSync(mediaDir, 0o755);
    console.log('[Media] Fixed permissions on media directory');
  } catch (chmodErr) {
    console.error('[Media] Could not fix permissions:', chmodErr.message);
  }
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
            <strong>HLS (für alle Browser & VLC):</strong>
            ${protocol}://${host}/live/stream/index.m3u8
          </div>
          <div class="note">
            📱 Dieser Link funktioniert in allen Browsern (inkl. Mobile) und VLC Media Player
          </div>
        </div>
      </div>

      <script>
        const video = document.getElementById('audioPlayer');
        const status = document.getElementById('status');
        const playBtn = document.getElementById('playBtn');
        const streamUrl = '${protocol}://${host}/live/stream/index.m3u8';

        let isPlaying = false;
        let hls = null;

        playBtn.addEventListener('click', () => {
          if (!isPlaying) {
            status.className = 'status waiting';
            status.textContent = '⏳ Verbinde...';
            playBtn.disabled = true;
            playBtn.textContent = '▶️ Verbinde...';
            
            // Verwende HLS.js für bessere Kompatibilität (funktioniert auch auf Mobile)
            if (typeof Hls !== 'undefined' && Hls.isSupported()) {
              if (hls) {
                hls.destroy();
              }
              
              hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
              });
              
              hls.loadSource(streamUrl);
              hls.attachMedia(video);
              
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().then(() => {
                  isPlaying = true;
                }).catch(e => {
                  console.error('Fehler:', e);
                  status.className = 'status error';
                  status.textContent = '❌ Konnte nicht abspielen - Läuft OBS?';
                  playBtn.disabled = false;
                  playBtn.textContent = '🔄 Erneut versuchen';
                });
              });
              
              hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                  console.error('HLS Error:', data);
                  switch(data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                      status.className = 'status error';
                      status.textContent = '❌ Netzwerk-Fehler - Läuft OBS?';
                      hls.startLoad();
                      break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      status.className = 'status error';
                      status.textContent = '❌ Stream-Fehler - Läuft OBS?';
                      hls.recoverMediaError();
                      break;
                    default:
                      status.className = 'status error';
                      status.textContent = '❌ Stream-Fehler - Läuft OBS?';
                      playBtn.disabled = false;
                      playBtn.textContent = '🔄 Erneut versuchen';
                      isPlaying = false;
                      break;
                  }
                }
              });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
              // Native HLS (Safari/iOS)
              video.src = streamUrl;
              video.load();
              
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
              status.textContent = '❌ Browser unterstützt HLS nicht';
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
          if (hls) {
            hls.destroy();
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

// Test FFmpeg endpoint
app.get('/api/test/ffmpeg', (req, res) => {
  const { execSync } = require('child_process');
  try {
    const version = execSync(`${ffmpegPath} -version 2>&1 | head -n 3`, {
      encoding: 'utf8',
      timeout: 5000
    });
    res.json({
      success: true,
      ffmpegPath: ffmpegPath,
      version: version.trim(),
      found: ffmpegFound
    });
  } catch (e) {
    res.json({
      success: false,
      ffmpegPath: ffmpegPath,
      error: e.message,
      found: ffmpegFound
    });
  }
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
  
  // Check if we can write to the directory
  let canWrite = false;
  try {
    const testFile = path.join(streamDir, '.test-write');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    canWrite = true;
  } catch (e) {
    canWrite = false;
  }
  
  res.json({
    active: nms.getSession ? true : false,
    hlsExists: streamExists,
    hlsPath: streamPath,
    mediaDir: mediaDir,
    liveDirExists: liveDirExists,
    streamDirExists: streamDirExists,
    canWrite: canWrite,
    files: files,
    ffmpegPath: ffmpegPath,
    ffmpegFound: ffmpegFound
  });
});

// Find FFmpeg path - Docker installs it at /usr/bin/ffmpeg
const { execSync, spawn } = require('child_process');
let ffmpegPath = '/usr/bin/ffmpeg'; // Default for Docker
let ffmpegFound = false;

// Try Docker path first (most reliable)
try {
  const version = execSync(`${ffmpegPath} -version 2>&1 | head -n 1`, {
    encoding: 'utf8',
    timeout: 2000,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (version && version.includes('ffmpeg')) {
    ffmpegFound = true;
    console.log(`[FFmpeg] ✅ Found at: ${ffmpegPath}`);
    console.log(`[FFmpeg] Version: ${version.trim()}`);
  }
} catch (e) {
  // Try other methods
}

// Fallback: Try PATH
if (!ffmpegFound) {
  try {
    const whichResult = execSync('which ffmpeg 2>/dev/null || command -v ffmpeg 2>/dev/null', {
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (whichResult && whichResult.trim()) {
      ffmpegPath = whichResult.trim();
      const version = execSync(`${ffmpegPath} -version 2>&1 | head -n 1`, {
        encoding: 'utf8',
        timeout: 2000
      });
      if (version && version.includes('ffmpeg')) {
        ffmpegFound = true;
        console.log(`[FFmpeg] ✅ Found via PATH: ${ffmpegPath}`);
        console.log(`[FFmpeg] Version: ${version.trim()}`);
      }
    }
  } catch (e) {
    // Continue
  }
}

// Fallback: Try other common paths
if (!ffmpegFound) {
  const possiblePaths = ['/usr/local/bin/ffmpeg', '/bin/ffmpeg'];
  for (const testPath of possiblePaths) {
    try {
      const version = execSync(`${testPath} -version 2>&1 | head -n 1`, {
        encoding: 'utf8',
        timeout: 2000,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      if (version && version.includes('ffmpeg')) {
        ffmpegPath = testPath;
        ffmpegFound = true;
        console.log(`[FFmpeg] ✅ Found at: ${ffmpegPath}`);
        console.log(`[FFmpeg] Version: ${version.trim()}`);
        break;
      }
    } catch (e) {
      continue;
    }
  }
}

if (!ffmpegFound) {
  console.error('[FFmpeg] ❌ Could not find FFmpeg!');
  console.error('[FFmpeg] Expected at: /usr/bin/ffmpeg (Docker)');
  console.error('[FFmpeg] HLS transcoding will NOT work without FFmpeg');
} else {
  console.log(`[FFmpeg] ✅ Ready to use: ${ffmpegPath}`);
}

// Node Media Server Konfiguration mit HLS-Transcoding
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
  // Temporarily disable trans to avoid the "version is not defined" bug
  // We'll implement custom FFmpeg transcoding instead
  // trans: {
  //   ffmpeg: ffmpegPath,
  //   tasks: [
  //     {
  //       app: 'live',
  //       hls: true,
  //       hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
  //       hlsKeep: false
  //     }
  //   ]
  // },
  logType: 3
};

const nms = new NodeMediaServer(config);

// Store active FFmpeg processes
const ffmpegProcesses = new Map();

// Custom FFmpeg transcoding function
function startFFmpegTranscoding(streamPath, streamName) {
  const streamDir = path.join(mediaDir, 'live', streamName);
  const hlsPath = path.join(streamDir, 'index.m3u8');
  
  // Don't start if already running
  if (ffmpegProcesses.has(streamPath)) {
    console.log('[FFmpeg] Transcoding already running for:', streamPath);
    return;
  }
  
  // Ensure directory exists
  if (!fs.existsSync(streamDir)) {
    fs.mkdirSync(streamDir, { recursive: true, mode: 0o755 });
  }
  
  // Use HTTP-FLV from Node Media Server as input (more reliable than RTMP loopback)
  const flvInput = `http://127.0.0.1:8888${streamPath}.flv`;
  
  // FFmpeg command for HLS transcoding
  const ffmpegArgs = [
    '-i', flvInput,
    '-fflags', 'nobuffer',
    '-flags', 'low_delay',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments',
    '-hls_segment_filename', path.join(streamDir, 'segment_%03d.ts'),
    hlsPath
  ];
  
  console.log('[FFmpeg] 🚀 Starting transcoding for:', streamPath);
  console.log('[FFmpeg] Command:', ffmpegPath, ffmpegArgs.join(' '));
  
  const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  ffmpegProcesses.set(streamPath, ffmpeg);
  
  ffmpeg.stdout.on('data', (data) => {
    console.log('[FFmpeg] stdout:', data.toString());
  });
  
  ffmpeg.stderr.on('data', (data) => {
    const output = data.toString();
    // FFmpeg writes to stderr for progress
    if (output.includes('frame=') || output.includes('time=')) {
      // Progress output - can be logged if needed
    } else {
      console.log('[FFmpeg] stderr:', output);
    }
  });
  
  ffmpeg.on('error', (err) => {
    console.error('[FFmpeg] Process error:', err);
    ffmpegProcesses.delete(streamPath);
  });
  
  ffmpeg.on('exit', (code, signal) => {
    console.log(`[FFmpeg] Process exited: code=${code}, signal=${signal}`);
    ffmpegProcesses.delete(streamPath);
  });
  
  // Wait a bit and check if file is created
  setTimeout(() => {
    if (fs.existsSync(hlsPath)) {
      console.log('[FFmpeg] ✅✅✅ HLS file created! ✅✅✅');
    } else {
      console.log('[FFmpeg] ⚠️  HLS file not yet created, may need more time');
    }
  }, 5000);
}

// Catch uncaught exceptions from Node Media Server
process.on('uncaughtException', (err) => {
  if (err.message && err.message.includes('version is not defined')) {
    console.error('[NMS] ⚠️  Trans server error (known bug in node-media-server)');
    console.error('[NMS] Using custom FFmpeg transcoding instead');
    // Don't exit - let the server continue with custom transcoding
    return;
  }
  // Re-throw other errors
  throw err;
});

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
  console.log('[Stream] ⚡⚡⚡ PRE PUBLISH ⚡⚡⚡');
  console.log('[Stream] ID:', id);
  console.log('[Stream] StreamPath:', StreamPath);
  console.log('[Stream] Args:', JSON.stringify(args, null, 2));
  
  // Ensure live directory exists
  const liveDir = path.join(mediaDir, 'live');
  if (!fs.existsSync(liveDir)) {
    fs.mkdirSync(liveDir, { recursive: true, mode: 0o755 });
    console.log('[Stream] Created live directory:', liveDir);
  }
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[Stream] ✅✅✅ POST PUBLISH ✅✅✅');
  console.log('[Stream] ID:', id);
  console.log('[Stream] StreamPath:', StreamPath);
  console.log('[Stream] Args:', JSON.stringify(args, null, 2));
  
  const streamName = StreamPath.replace('/live/', '');
  const streamDir = path.join(mediaDir, 'live', streamName);
  
  // Ensure stream directory exists
  if (!fs.existsSync(streamDir)) {
    fs.mkdirSync(streamDir, { recursive: true, mode: 0o755 });
    console.log('[Stream] Created stream directory:', streamDir);
  }
  
  // Start custom FFmpeg transcoding
  if (StreamPath.startsWith('/live/')) {
    console.log('[Stream] 🚀 Starting custom FFmpeg transcoding...');
    console.log('[Stream] Stream name:', streamName);
    // Wait a moment for RTMP stream to be ready and HTTP-FLV to be available
    setTimeout(() => {
      startFFmpegTranscoding(StreamPath, streamName);
    }, 3000); // Increased delay to ensure HTTP-FLV is ready
  } else {
    console.log('[Stream] ⚠️  StreamPath does not start with /live/, skipping transcoding');
  }
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[Stream] Beendet:', StreamPath);
  
  // Stop FFmpeg transcoding for this stream
  if (ffmpegProcesses.has(StreamPath)) {
    const ffmpeg = ffmpegProcesses.get(StreamPath);
    console.log('[FFmpeg] Stopping transcoding for:', StreamPath);
    ffmpeg.kill();
    ffmpegProcesses.delete(StreamPath);
  }
});

// Listen for transcoding events
nms.on('preTrans', (id, StreamPath, args) => {
  console.log('[Transcode] ⚡⚡⚡ START TRANSCODING ⚡⚡⚡');
  console.log('[Transcode] StreamPath:', StreamPath);
  console.log('[Transcode] ID:', id);
  console.log('[Transcode] Args:', JSON.stringify(args, null, 2));
  console.log('[Transcode] FFmpeg path:', ffmpegPath);
  console.log('[Transcode] FFmpeg found:', ffmpegFound);
});

nms.on('postTrans', (id, StreamPath, args) => {
  console.log('[Transcode] ✅ Transcoding started successfully');
  console.log('[Transcode] StreamPath:', StreamPath);
  const expectedPath = path.join(mediaDir, 'live', StreamPath.replace('/live/', ''), 'index.m3u8');
  console.log('[Transcode] Expected HLS path:', expectedPath);
  
  // Wait a bit and check again
  setTimeout(() => {
    if (fs.existsSync(expectedPath)) {
      console.log('[Transcode] ✅✅✅ HLS file created! ✅✅✅');
      const files = fs.readdirSync(path.dirname(expectedPath));
      console.log('[Transcode] Files in directory:', files);
    } else {
      console.log('[Transcode] ❌ HLS file still NOT found');
      console.log('[Transcode] Directory exists:', fs.existsSync(path.dirname(expectedPath)));
      if (fs.existsSync(path.dirname(expectedPath))) {
        const files = fs.readdirSync(path.dirname(expectedPath));
        console.log('[Transcode] Files in directory:', files);
      }
    }
  }, 3000);
});

nms.on('doneTrans', (id, StreamPath, args) => {
  console.log('[Transcode] 🛑 Transcoding stopped:', StreamPath);
});

// Also listen for any errors
nms.on('error', (err) => {
  console.error('[NMS] Error:', err);
});

// Listen for all Node Media Server events to debug
nms.on('preConnect', (id, args) => {
  console.log('[NMS] preConnect:', id, args);
});

nms.on('postConnect', (id, args) => {
  console.log('[NMS] postConnect:', id, args);
});

// Duplicate handlers removed - using the ones above

// Proxy für HLS-Stream von NodeMediaServer zu Express
app.use('/live', (req, res, next) => {
  const http = require('http');
  
  // Set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  // Set appropriate content type based on file extension
  if (req.path.endsWith('.m3u8')) {
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else if (req.path.endsWith('.ts')) {
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  
  // Try Node Media Server HTTP server first
  const targetUrl = `http://127.0.0.1:8888${req.path}`;
  console.log('[HLS Proxy] Request:', req.path, '->', targetUrl);
  
  const proxyReq = http.get(targetUrl, (proxyRes) => {
    console.log('[HLS Proxy] Response status:', proxyRes.statusCode, 'for', req.path);
    
    if (proxyRes.statusCode === 404) {
      // Try direct file serving as fallback
      console.log('[HLS Proxy] 404 from NMS, trying direct file serving...');
      proxyReq.destroy();
      
      // Extract stream name from path like /live/stream/index.m3u8
      const pathParts = req.path.split('/').filter(p => p);
      if (pathParts.length >= 2) {
        const streamName = pathParts[0];
        const fileName = pathParts.slice(1).join('/');
        const filePath = path.join(mediaDir, 'live', streamName, fileName);
        
        console.log('[HLS Proxy] Trying direct file:', filePath);
        
        if (fs.existsSync(filePath)) {
          console.log('[HLS Proxy] ✅ File exists, serving directly');
          res.sendFile(filePath);
          return;
        } else {
          console.log('[HLS Proxy] ❌ File does not exist:', filePath);
        }
      }
      
      res.status(404).send('Stream nicht gefunden - Warte auf HLS-Generierung...');
      return;
    }
    
    // Forward status code
    res.status(proxyRes.statusCode);
    
    // Forward headers
    Object.keys(proxyRes.headers).forEach(key => {
      // Don't override our CORS and content-type headers
      if (key.toLowerCase() !== 'access-control-allow-origin' && 
          key.toLowerCase() !== 'content-type') {
        res.setHeader(key, proxyRes.headers[key]);
      }
    });
    
    // Pipe the response
    proxyRes.pipe(res);
    
    proxyRes.on('error', (err) => {
      console.error('[HLS Proxy] Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy();
      }
    });
  });
  
  proxyReq.on('error', (err) => {
    console.error('[HLS Proxy] Request error:', err.message);
    
    // Fallback to direct file serving
    const pathParts = req.path.split('/').filter(p => p);
    if (pathParts.length >= 2) {
      const streamName = pathParts[0];
      const fileName = pathParts.slice(1).join('/');
      const filePath = path.join(mediaDir, 'live', streamName, fileName);
      
      console.log('[HLS Proxy] Connection error, trying direct file:', filePath);
      
      if (fs.existsSync(filePath)) {
        console.log('[HLS Proxy] ✅ File exists, serving directly');
        res.sendFile(filePath);
        return;
      }
    }
    
    if (!res.headersSent) {
      res.status(503).send('Stream nicht verfügbar - Läuft OBS?');
    }
  });
  
  req.on('close', () => {
    proxyReq.destroy();
  });
});

// Server starten
console.log('═══════════════════════════════════════════');
console.log('   🚀 Starte Node Media Server...');
console.log(`   📡 RTMP Port: ${RTMP_PORT}`);
console.log(`   📺 Internal HTTP: 8888`);
console.log(`   📁 Media Root: ${mediaDir}`);
console.log(`   🎬 FFmpeg Path: ${ffmpegPath}`);
console.log(`   🎥 HLS Streaming aktiviert`);
console.log(`   📋 Trans Config:`, JSON.stringify(config.trans, null, 2));
console.log('═══════════════════════════════════════════');

nms.run();

app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════');
  console.log('   ✅ Express Server läuft!');
  console.log(`   🌐 HTTP Port: ${HTTP_PORT}`);
  console.log('═══════════════════════════════════════════');
});
