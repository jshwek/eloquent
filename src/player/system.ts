import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';

export class SystemAudioPlayer {
  private context: vscode.ExtensionContext;
  private currentProcess: ChildProcess | null = null;
  private tempFile: string | null = null;
  private onDidStopCallback: (() => void) | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async play(audioData: Buffer, onStop?: () => void): Promise<void> {
    // Stop any currently playing audio
    this.stop();

    this.onDidStopCallback = onStop;

    // Write audio to temp file
    const tempDir = os.tmpdir();
    this.tempFile = path.join(tempDir, `eloquent-${Date.now()}.mp3`);
    fs.writeFileSync(this.tempFile, audioData);

    const platform = process.platform;

    try {
      if (platform === 'win32') {
        // Windows: Use PowerShell with Windows Media Player
        this.currentProcess = spawn('powershell', [
          '-NoProfile',
          '-Command',
          `
            Add-Type -AssemblyName presentationCore
            $player = New-Object System.Windows.Media.MediaPlayer
            $player.Open([System.Uri]"${this.tempFile.replace(/\\/g, '/')}")
            $player.Play()
            Start-Sleep -Milliseconds 500
            while ($player.NaturalDuration.HasTimeSpan -eq $false) { Start-Sleep -Milliseconds 100 }
            $duration = $player.NaturalDuration.TimeSpan.TotalMilliseconds
            Start-Sleep -Milliseconds $duration
            $player.Close()
          `
        ], { windowsHide: true });
      } else if (platform === 'darwin') {
        // macOS: Use afplay
        this.currentProcess = spawn('afplay', [this.tempFile]);
      } else {
        // Linux: Try various players
        this.currentProcess = spawn('mpg123', ['-q', this.tempFile]);
      }

      this.currentProcess.on('close', () => {
        this.cleanup();
        this.onDidStopCallback?.();
      });

      this.currentProcess.on('error', (err) => {
        console.error('Audio playback error:', err);
        this.cleanup();
        this.onDidStopCallback?.();
      });

    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  stop(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
    this.cleanup();
    this.onDidStopCallback?.();
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
    this.currentProcess = null;
  }

  dispose(): void {
    this.stop();
  }
}
