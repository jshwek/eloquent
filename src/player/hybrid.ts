import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class HybridAudioPlayer {
  private panel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;
  private onDidStopCallback: (() => void) | undefined;
  private tempFile: string | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async play(audioData: Buffer, onStop?: () => void): Promise<void> {
    this.onDidStopCallback = onStop;
    this.cleanup();

    // Save to temp file and create a local URI the webview can access
    const tempDir = os.tmpdir();
    this.tempFile = path.join(tempDir, `eloquent-${Date.now()}.mp3`);
    fs.writeFileSync(this.tempFile, audioData);

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'eloquentPlayer',
        'Eloquent Player',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.file(os.tmpdir())]
        }
      );

      this.panel.onDidDispose(() => {
        this.cleanup();
        this.panel = undefined;
        this.onDidStopCallback?.();
      });

      this.panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'ended' || message.command === 'stopped') {
          this.onDidStopCallback?.();
        } else if (message.command === 'ready') {
          // Webview is ready, tell it to play
          this.panel?.webview.postMessage({ command: 'play' });
        } else if (message.command === 'download') {
          await this.downloadCurrentAudio();
        }
      });
    }

    // Convert file path to webview URI
    const audioUri = this.panel.webview.asWebviewUri(vscode.Uri.file(this.tempFile));
    this.panel.webview.html = this.getHtml(audioUri.toString());

    // Focus panel to help with autoplay
    this.panel.reveal(vscode.ViewColumn.Beside, false);
  }

  stop(): void {
    if (this.panel) {
      this.panel.webview.postMessage({ command: 'stop' });
    }
    this.cleanup();
  }

  pause(): void {
    if (this.panel) {
      this.panel.webview.postMessage({ command: 'pause' });
    }
  }

  resume(): void {
    if (this.panel) {
      this.panel.webview.postMessage({ command: 'resume' });
    }
  }

  private cleanup(): void {
    if (this.tempFile && fs.existsSync(this.tempFile)) {
      try {
        fs.unlinkSync(this.tempFile);
      } catch {
        // Ignore cleanup errors
      }
      this.tempFile = null;
    }
  }

  dispose(): void {
    this.stop();
    this.panel?.dispose();
    this.panel = undefined;
  }

  private async downloadCurrentAudio(): Promise<void> {
    if (!this.tempFile || !fs.existsSync(this.tempFile)) {
      vscode.window.showErrorMessage('Eloquent: No audio available to download.');
      return;
    }

    const targetUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(os.homedir(), `eloquent-${Date.now()}.mp3`)),
      filters: { 'MP3 Audio': ['mp3'] },
      saveLabel: 'Download Audio'
    });

    if (!targetUri) {
      return;
    }

    try {
      const audioBuffer = fs.readFileSync(this.tempFile);
      await vscode.workspace.fs.writeFile(targetUri, audioBuffer);
      vscode.window.showInformationMessage(`Eloquent: Audio saved to ${targetUri.fsPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Eloquent: Failed to save audio. ${message}`);
    }
  }

  private getHtml(audioSrc: string): string {
    return /*html*/ `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          .player {
            width: 100%;
            max-width: 350px;
            text-align: center;
          }
          .status {
            font-size: 14px;
            margin-bottom: 16px;
            color: var(--vscode-descriptionForeground);
          }
          .time {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
            font-variant-numeric: tabular-nums;
          }
          .seek-container {
            width: 100%;
            margin-bottom: 16px;
          }
          .seek-slider {
            width: 100%;
            height: 6px;
            -webkit-appearance: none;
            appearance: none;
            background: var(--vscode-input-background);
            border-radius: 3px;
            outline: none;
            cursor: pointer;
          }
          .seek-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 14px;
            height: 14px;
            background: #7c3aed;
            border-radius: 50%;
            cursor: pointer;
          }
          .seek-slider::-moz-range-thumb {
            width: 14px;
            height: 14px;
            background: #7c3aed;
            border-radius: 50%;
            cursor: pointer;
            border: none;
          }
          .controls {
            display: flex;
            gap: 8px;
            justify-content: center;
            align-items: center;
            margin-bottom: 12px;
          }
          button {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: background 0.15s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
          }
          button:hover {
            background: var(--vscode-button-hoverBackground);
          }
          button.play {
            background: #2ea043;
            color: #ffffff;
          }
          button.play:hover {
            background: #238636;
          }
          button.stop {
            background: #da3633;
            color: #ffffff;
          }
          button.stop:hover {
            background: #b62324;
          }
          button.download {
            background: #1f6feb;
            color: #ffffff;
          }
          button.download:hover {
            background: #1158c7;
          }
          .btn-icon {
            margin-right: 6px;
            font-size: 12px;
            line-height: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            position: relative;
            bottom: 2px;
          }
          .speed-control {
            margin-top: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }
          .speed-btn {
            padding: 4px 8px;
            font-size: 11px;
            background: var(--vscode-input-background);
          }
        </style>
      </head>
      <body>
        <div class="player">
          <div class="status" id="status">Loading...</div>
          <div class="time" id="time">0:00 / 0:00</div>
          <div class="seek-container">
            <input type="range" class="seek-slider" id="seekSlider" min="0" max="100" value="0">
          </div>
          <div class="controls">
            <button id="playPauseBtn" class="play"><span class="btn-icon">▶</span><span id="playPauseLabel">Play</span></button>
            <button id="stopBtn" class="stop"><span class="btn-icon">■</span>Stop</button>
            <button id="downloadBtn" class="download"><span class="btn-icon">↓</span>Download</button>
          </div>
          <div class="speed-control">
            <span>Speed:</span>
            <button class="speed-btn" data-speed="0.5">0.5x</button>
            <button class="speed-btn" data-speed="1">1x</button>
            <button class="speed-btn" data-speed="1.5">1.5x</button>
            <button class="speed-btn" data-speed="2">2x</button>
          </div>
        </div>
        <audio id="audio" preload="auto"></audio>
        <script>
          const vscode = acquireVsCodeApi();
          const audio = document.getElementById('audio');
          const status = document.getElementById('status');
          const timeDisplay = document.getElementById('time');
          const seekSlider = document.getElementById('seekSlider');
          const playPauseBtn = document.getElementById('playPauseBtn');
          const playPauseLabel = document.getElementById('playPauseLabel');
          const stopBtn = document.getElementById('stopBtn');
          const downloadBtn = document.getElementById('downloadBtn');
          const speedBtns = document.querySelectorAll('.speed-btn');

          let isPlaying = false;
          let isSeeking = false;

          audio.src = '${audioSrc}';

          function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ':' + secs.toString().padStart(2, '0');
          }

          function updateTimeDisplay() {
            const current = formatTime(audio.currentTime || 0);
            const total = formatTime(audio.duration || 0);
            timeDisplay.textContent = current + ' / ' + total;
          }

          function playAudio() {
            audio.play().then(() => {
              isPlaying = true;
              playPauseLabel.textContent = 'Pause';
              status.textContent = 'Playing...';
            }).catch(err => {
              console.error('Play failed:', err);
              status.textContent = 'Click Play to start';
            });
          }

          function pauseAudio() {
            audio.pause();
            isPlaying = false;
            playPauseLabel.textContent = 'Play';
            status.textContent = 'Paused';
          }

          audio.onloadedmetadata = () => {
            seekSlider.max = Math.floor(audio.duration);
            updateTimeDisplay();
            status.textContent = 'Ready';
            // Notify extension we're ready
            vscode.postMessage({ command: 'ready' });
          };

          audio.oncanplaythrough = () => {
            if (status.textContent === 'Loading...') {
              status.textContent = 'Ready';
            }
          };

          audio.ontimeupdate = () => {
            if (!isSeeking) {
              seekSlider.value = Math.floor(audio.currentTime);
              updateTimeDisplay();
            }
          };

          audio.onended = () => {
            isPlaying = false;
            playPauseLabel.textContent = 'Play';
            status.textContent = 'Finished';
            seekSlider.value = 0;
            vscode.postMessage({ command: 'ended' });
          };

          audio.onerror = () => {
            status.textContent = 'Error loading audio';
          };

          playPauseBtn.onclick = () => {
            if (isPlaying) {
              pauseAudio();
            } else {
              playAudio();
            }
          };

          stopBtn.onclick = () => {
            audio.pause();
            audio.currentTime = 0;
            isPlaying = false;
            playPauseLabel.textContent = 'Play';
            status.textContent = 'Stopped';
            seekSlider.value = 0;
            updateTimeDisplay();
            vscode.postMessage({ command: 'stopped' });
          };

          downloadBtn.onclick = () => {
            vscode.postMessage({ command: 'download' });
          };

          // Seek slider events
          seekSlider.oninput = () => {
            isSeeking = true;
            const seekTime = parseFloat(seekSlider.value);
            timeDisplay.textContent = formatTime(seekTime) + ' / ' + formatTime(audio.duration || 0);
          };

          seekSlider.onchange = () => {
            audio.currentTime = parseFloat(seekSlider.value);
            isSeeking = false;
          };

          // Speed buttons
          speedBtns.forEach(btn => {
            btn.onclick = () => {
              audio.playbackRate = parseFloat(btn.dataset.speed);
              speedBtns.forEach(b => b.style.background = '');
              btn.style.background = '#7c3aed';
              btn.style.color = 'white';
            };
          });
          // Highlight 1x by default
          document.querySelector('[data-speed="1"]').style.background = '#7c3aed';
          document.querySelector('[data-speed="1"]').style.color = 'white';

          // Listen for messages from extension
          window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.command === 'play') {
              playAudio();
            } else if (message.command === 'stop') {
              audio.pause();
              audio.currentTime = 0;
              isPlaying = false;
              playPauseLabel.textContent = 'Play';
            } else if (message.command === 'pause') {
              pauseAudio();
            } else if (message.command === 'resume') {
              playAudio();
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}
