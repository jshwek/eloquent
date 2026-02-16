import * as vscode from 'vscode';

export class AudioPlayer {
  private panel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;
  private onDidStop: (() => void) | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async play(audioData: Buffer, onStop?: () => void): Promise<void> {
    this.onDidStop = onStop;
    const base64Audio = audioData.toString('base64');

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'eloquentPlayer',
        'Eloquent',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.onDidStop?.();
      });

      this.panel.webview.onDidReceiveMessage((message) => {
        if (message.command === 'ended' || message.command === 'stopped') {
          this.onDidStop?.();
        }
      });
    }

    this.panel.webview.html = this.getHtml(base64Audio);

    // Reveal panel to ensure audio can play
    this.panel.reveal(undefined, false);
  }

  stop(): void {
    if (this.panel) {
      this.panel.webview.postMessage({ command: 'stop' });
    }
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

  dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }

  private getHtml(base64Audio: string): string {
    return /*html*/ `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          .player {
            text-align: center;
          }
          .status {
            font-size: 14px;
            margin-bottom: 16px;
            color: var(--vscode-descriptionForeground);
          }
          .controls {
            display: flex;
            gap: 8px;
            justify-content: center;
          }
          button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-size: 13px;
          }
          button:hover {
            background: var(--vscode-button-hoverBackground);
          }
          .progress {
            width: 200px;
            height: 4px;
            background: var(--vscode-progressBar-background);
            border-radius: 2px;
            margin-top: 16px;
            overflow: hidden;
          }
          .progress-bar {
            height: 100%;
            background: var(--vscode-progressBar-background);
            background: #7c3aed;
            width: 0%;
            transition: width 0.1s;
          }
        </style>
      </head>
      <body>
        <div class="player">
          <div class="status" id="status">Playing...</div>
          <div class="controls">
            <button id="pauseBtn">Pause</button>
            <button id="stopBtn">Stop</button>
          </div>
          <div class="progress">
            <div class="progress-bar" id="progress"></div>
          </div>
        </div>
        <audio id="audio"></audio>
        <script>
          const vscode = acquireVsCodeApi();
          const audio = document.getElementById('audio');
          const status = document.getElementById('status');
          const progress = document.getElementById('progress');
          const pauseBtn = document.getElementById('pauseBtn');
          const stopBtn = document.getElementById('stopBtn');

          let isPaused = false;

          audio.src = 'data:audio/mp3;base64,${base64Audio}';

          // Explicitly play and handle autoplay blocking
          audio.oncanplaythrough = () => {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  status.textContent = 'Playing...';
                })
                .catch((error) => {
                  console.error('Autoplay blocked:', error);
                  status.textContent = 'Click Play to start';
                  pauseBtn.textContent = 'Play';
                  isPaused = true;
                });
            }
          };

          audio.onended = () => {
            status.textContent = 'Finished';
            vscode.postMessage({ command: 'ended' });
          };

          audio.onerror = (e) => {
            status.textContent = 'Error loading audio';
            console.error('Audio error:', e);
          };

          audio.ontimeupdate = () => {
            if (audio.duration) {
              progress.style.width = (audio.currentTime / audio.duration * 100) + '%';
            }
          };

          pauseBtn.onclick = () => {
            if (isPaused) {
              audio.play();
              pauseBtn.textContent = 'Pause';
              status.textContent = 'Playing...';
            } else {
              audio.pause();
              pauseBtn.textContent = 'Resume';
              status.textContent = 'Paused';
            }
            isPaused = !isPaused;
          };

          stopBtn.onclick = () => {
            audio.pause();
            audio.currentTime = 0;
            status.textContent = 'Stopped';
            vscode.postMessage({ command: 'stopped' });
          };

          window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.command === 'stop') {
              audio.pause();
              audio.currentTime = 0;
            } else if (message.command === 'pause') {
              audio.pause();
              isPaused = true;
              pauseBtn.textContent = 'Resume';
              status.textContent = 'Paused';
            } else if (message.command === 'resume') {
              audio.play();
              isPaused = false;
              pauseBtn.textContent = 'Pause';
              status.textContent = 'Playing...';
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}
