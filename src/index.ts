import { handleHealth } from "./handlers/health";
import { handleTts } from "./handlers/tts";
import { handleVoices } from "./handlers/voices";
import { errorResponse, noContent, withCors } from "./lib/http";

const HTML_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EdgeTTS - AI 语音合成平台</title>
    <meta name="description" content="免费 Cloudflare Edge TTS 在线工具，支持数百种中英文等自然语音">
    <style>
        :root { --bg: #f8f9fa; --text: #212529; --card: #ffffff; --primary: #0070f3; }
        @media (prefers-color-scheme: dark) {
            :root { --bg: #0f0f11; --text: #e0e0e0; --card: #1a1a1e; }
        }
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg); color: var(--text);
            line-height: 1.6;
        }
        .top-toolbar {
            position: fixed; top: 0; left: 0; right: 0;
            background: var(--card); border-bottom: 1px solid #333;
            padding: 10px 20px; display: flex; align-items: center; gap: 15px; z-index: 100;
        }
        .header {
            text-align: center; padding: 100px 20px 40px;
        }
        h1 { font-size: 2.8rem; color: var(--primary); margin-bottom: 8px; }
        .subtitle { font-size: 1.2rem; opacity: 0.8; }
        .container { max-width: 860px; margin: 0 auto; padding: 20px; }
        .card {
            background: var(--card); border-radius: 16px;
            padding: 24px; box-shadow: 0 4px 25px rgba(0,0,0,0.1);
            margin-bottom: 24px;
        }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 6px; font-weight: 600; }
        select, textarea, input {
            width: 100%; padding: 12px; border-radius: 8px;
            border: 1px solid #444; background: var(--card); color: var(--text);
            font-size: 16px;
        }
        textarea { resize: vertical; min-height: 120px; }
        button {
            padding: 12px 24px; border: none; border-radius: 8px;
            background: var(--primary); color: white; font-weight: bold;
            cursor: pointer; font-size: 16px;
        }
        button:hover { background: #0051cc; }
        .row { display: flex; gap: 12px; }
        .row button { flex: 1; }
        #status { min-height: 28px; margin: 10px 0; font-weight: 500; }
        .success { color: #22c55e; }
        .error { color: #ef4444; }
        audio { width: 100%; margin: 15px 0; }
        .history-item {
            padding: 12px; background: rgba(0,0,0,0.05); margin: 8px 0;
            border-radius: 8px; cursor: pointer; font-size: 0.95rem;
        }
        .history-item:hover { background: rgba(0,112,243,0.1); }
        .features { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; margin-top: 20px; }
        .feature-item { background: var(--card); padding: 10px 18px; border-radius: 9999px; font-size: 0.95rem; }
    </style>
</head>
<body>
    <!-- 顶部工具栏 -->
    <div class="top-toolbar">
        <button onclick="toggleTheme()" style="background:none;border:none;font-size:1.4rem;cursor:pointer;">🌗</button>
        <div style="margin-left:auto;display:flex;gap:12px;align-items:center;">
            <span>🌥️ Cloudflare Edge TTS</span>
        </div>
    </div>

    <div class="container">
        <div class="header">
            <h1>EdgeTTS</h1>
            <p class="subtitle">免费 · 高速 · 高质量 AI 语音合成平台</p>
            <div class="features">
                <div class="feature-item">数百种自然语音</div>
                <div class="feature-item">Edge 全球加速</div>
                <div class="feature-item">完全免费</div>
                <div class="feature-item">MP3 下载</div>
            </div>
        </div>

        <div class="card">
            <div class="form-group">
                <label>🔍 搜索语音</label>
                <input type="text" id="voiceSearch" placeholder="搜索语音名称..." onkeyup="filterVoices()">
            </div>

            <div class="form-group">
                <label>🎙️ 选择语音</label>
                <select id="voice"></select>
            </div>

            <div class="form-group">
                <label>📝 输入文字 <span id="charCount" style="float:right;font-size:0.9rem;">0 / 5000</span></label>
                <textarea id="text" placeholder="在此输入你要朗读的内容...">你好，欢迎使用 EdgeTTS 在线工具！支持流畅自然的中文语音合成。</textarea>
            </div>

            <!-- 高级控件（当前 UI 展示，后续可支持） -->
            <div class="row" style="margin-bottom:20px;">
                <div class="form-group" style="flex:1;">
                    <label>速度 <span id="speedValue">1.0x</span></label>
                    <input type="range" id="speed" min="0.5" max="2" step="0.1" value="1" oninput="updateValue(this)">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>音调 <span id="pitchValue">0</span></label>
                    <input type="range" id="pitch" min="-10" max="10" step="1" value="0" oninput="updateValue(this)">
                </div>
            </div>

            <div class="row">
                <button onclick="speak()" style="flex:2;">🎙️ 生成并播放</button>
                <button onclick="downloadAudio()" style="flex:1;">⬇️ 下载</button>
            </div>

            <div id="status"></div>
            <audio id="audioPlayer" controls></audio>
        </div>

        <!-- 历史记录 -->
        <div class="card">
            <h3>📜 历史记录</h3>
            <div id="history" style="max-height:320px;overflow-y:auto;"></div>
        </div>
    </div>

    <script>
        let currentBlobUrl = null;
        const voiceSelect = document.getElementById('voice');
        const textArea = document.getElementById('text');
        const statusEl = document.getElementById('status');
        const audio = document.getElementById('audioPlayer');
        const charCount = document.getElementById('charCount');

        textArea.addEventListener('input', () => {
            const len = textArea.value.length;
            charCount.textContent = len + " / 5000";
            if (len > 5000) charCount.style.color = '#ef4444';
        });

        async function loadVoices() {
            try {
                const res = await fetch('/voices');
                const data = await res.json();
                voiceSelect.innerHTML = '';
                const groups = {};
                data.voices.forEach(v => {
                    const lang = v.Locale ? v.Locale.split('-')[0] : 'other';
                    if (!groups[lang]) groups[lang] = [];
                    groups[lang].push(v);
                });
                Object.keys(groups).forEach(lang => {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = lang.toUpperCase();
                    groups[lang].forEach(v => {
                        const opt = document.createElement('option');
                        opt.value = v.ShortName;
                        opt.textContent = \`\${v.FriendlyName || v.ShortName} (\${v.ShortName})\`;
                        optgroup.appendChild(opt);
                    });
                    voiceSelect.appendChild(optgroup);
                });
            } catch(e) {
                statusEl.innerHTML = '<span class="error">加载语音列表失败</span>';
            }
        }

        function filterVoices() {
            const term = document.getElementById('voiceSearch').value.toLowerCase();
            Array.from(voiceSelect.options).forEach(opt => {
                opt.style.display = opt.textContent.toLowerCase().includes(term) ? '' : 'none';
            });
        }

        function updateValue(el) {
            if (el.id === 'speed') document.getElementById('speedValue').textContent = el.value + 'x';
            if (el.id === 'pitch') document.getElementById('pitchValue').textContent = el.value;
        }

        async function speak() {
            const text = textArea.value.trim();
            if (!text) return statusEl.innerHTML = '<span class="error">请输入文字</span>';

            statusEl.innerHTML = '<span style="color:#f59e0b">生成中...</span>';
            if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);

            try {
                const res = await fetch('/tts', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        text: text,
                        voice: voiceSelect.value
                    })
                });

                if (!res.ok) throw new Error('生成失败');

                const blob = await res.blob();
                currentBlobUrl = URL.createObjectURL(blob);
                audio.src = currentBlobUrl;
                audio.play();
                statusEl.innerHTML = '<span class="success">✓ 播放成功</span>';
                addToHistory(text, voiceSelect.value);
            } catch(e) {
                statusEl.innerHTML = \`<span class="error">失败：\${e.message}</span>\`;
            }
        }

        async function downloadAudio() {
            const text = textArea.value.trim();
            if (!text) return;
            try {
                const res = await fetch('/tts', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({text, voice: voiceSelect.value})
                });
                if (!res.ok) throw new Error('生成失败');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = \`edgetts-\${Date.now()}.mp3\`;
                a.click();
                URL.revokeObjectURL(url);
            } catch(e) {
                statusEl.innerHTML = \`<span class="error">下载失败：\${e.message}</span>\`;
            }
        }

        function addToHistory(text, voice) {
            let history = JSON.parse(localStorage.getItem('ttsHistory') || '[]');
            history.unshift({
                text: text.length > 70 ? text.substring(0,70)+'...' : text,
                fullText: text,
                voice,
                time: new Date().toLocaleString()
            });
            if (history.length > 12) history.pop();
            localStorage.setItem('ttsHistory', JSON.stringify(history));
            renderHistory();
        }

        function renderHistory() {
            const container = document.getElementById('history');
            let history = JSON.parse(localStorage.getItem('ttsHistory') || '[]');
            container.innerHTML = history.map((item, i) => \`
                <div class="history-item" onclick="loadHistory(\${i})">
                    <strong>\${item.time}</strong><br>
                    \${item.text} <small>(\${item.voice})</small>
                </div>
            \`).join('');
        }

        window.loadHistory = function(i) {
            const history = JSON.parse(localStorage.getItem('ttsHistory') || '[]');
            const item = history[i];
            if (item) {
                textArea.value = item.fullText;
                voiceSelect.value = item.voice || '';
                speak();
            }
        };

        function toggleTheme() {
            document.documentElement.style.setProperty('color-scheme', document.documentElement.style.getPropertyValue('color-scheme') === 'dark' ? 'light' : 'dark');
        }

        window.onload = () => {
            loadVoices();
            renderHistory();
        };
    </script>
</body>
</html>`;

async function routeRequest(request: Request) {
  const { pathname } = new URL(request.url);

  if (request.method === "OPTIONS") {
    return noContent();
  }

 // === 新增：根路径返回网页 UI ===
  if (pathname === "/" || pathname === "") {
    if (request.method !== "GET") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "method not allowed");
    }
    return new Response(HTML_PAGE, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...CORS_HEADERS,  // 如果你想允许跨域
      },
    });
  }

  if (pathname === "/health") {
    if (request.method !== "GET") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "method not allowed");
    }

    return handleHealth();
  }

  if (pathname === "/voices") {
    if (request.method !== "GET") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "method not allowed");
    }

    return handleVoices();
  }

  if (pathname === "/tts") {
    if (request.method !== "POST") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "method not allowed");
    }

    return handleTts(request);
  }

  return errorResponse(404, "NOT_FOUND", "route not found");
}

export default {
  async fetch(
    request: Request,
    _env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    try {
      const response = await routeRequest(request);
      return withCors(response);
    } catch {
      return errorResponse(500, "INTERNAL_ERROR", "unexpected internal error");
    }
  },
} satisfies ExportedHandler<Env>;
