import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { TTSProvider, TTSOptions } from './base';

export class LocalTTSProvider implements TTSProvider {
  readonly name = 'Local';

  async synthesize(text: string, options: TTSOptions): Promise<Buffer> {
    const platform = process.platform;

    if (platform === 'win32') {
      return this.synthesizeWindows(text, options);
    } else if (platform === 'darwin') {
      return this.synthesizeMac(text, options);
    } else {
      return this.synthesizeLinux(text, options);
    }
  }

  private async synthesizeWindows(text: string, options: TTSOptions): Promise<Buffer> {
    const tempDir = os.tmpdir();
    const outputFile = path.join(tempDir, `eloquent-local-${Date.now()}.wav`);

    // Escape text for PowerShell
    const escapedText = text.replace(/'/g, "''").replace(/"/g, '`"');

    const script = `
      Add-Type -AssemblyName System.Speech
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
      $synth.Rate = ${this.speedToRate(options.speed)}
      $synth.SetOutputToWaveFile("${outputFile.replace(/\\/g, '\\\\')}")
      $synth.Speak('${escapedText}')
      $synth.Dispose()
    `;

    await this.runPowerShell(script);

    const buffer = fs.readFileSync(outputFile);
    fs.unlinkSync(outputFile);
    return buffer;
  }

  private async synthesizeMac(text: string, options: TTSOptions): Promise<Buffer> {
    const tempDir = os.tmpdir();
    const outputFile = path.join(tempDir, `eloquent-local-${Date.now()}.aiff`);

    // macOS 'say' command with file output
    const rate = Math.round(175 * options.speed); // Default rate is ~175 wpm

    return new Promise((resolve, reject) => {
      const proc = spawn('say', ['-o', outputFile, '-r', rate.toString(), text]);

      proc.on('close', (code) => {
        if (code === 0) {
          const buffer = fs.readFileSync(outputFile);
          fs.unlinkSync(outputFile);
          resolve(buffer);
        } else {
          reject(new Error(`say command failed with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }

  private async synthesizeLinux(text: string, options: TTSOptions): Promise<Buffer> {
    const tempDir = os.tmpdir();
    const outputFile = path.join(tempDir, `eloquent-local-${Date.now()}.wav`);

    // espeak with file output
    const speed = Math.round(175 * options.speed);

    return new Promise((resolve, reject) => {
      const proc = spawn('espeak', ['-w', outputFile, '-s', speed.toString(), text]);

      proc.on('close', (code) => {
        if (code === 0) {
          const buffer = fs.readFileSync(outputFile);
          fs.unlinkSync(outputFile);
          resolve(buffer);
        } else {
          reject(new Error(`espeak command failed with code ${code}. Is espeak installed?`));
        }
      });

      proc.on('error', reject);
    });
  }

  private runPowerShell(script: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('powershell', ['-NoProfile', '-Command', script], {
        windowsHide: true
      });

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr || `PowerShell failed with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }

  private speedToRate(speed: number): number {
    // SAPI rate is -10 to 10, where 0 is normal
    // Map our 0.25-4.0 range to -10 to 10
    if (speed <= 1) {
      return Math.round((speed - 1) * 10); // 0.25 -> -7.5, 1 -> 0
    } else {
      return Math.round((speed - 1) * 3.33); // 1 -> 0, 4 -> 10
    }
  }
}

export async function getAvailableVoices(): Promise<string[]> {
  if (process.platform !== 'win32') {
    return ['default'];
  }

  return new Promise((resolve) => {
    const script = `
      Add-Type -AssemblyName System.Speech
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
      $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
      $synth.Dispose()
    `;

    const proc = spawn('powershell', ['-NoProfile', '-Command', script], {
      windowsHide: true
    });

    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', () => {
      const voices = output.trim().split('\n').filter(v => v.trim());
      resolve(voices.length > 0 ? voices : ['default']);
    });

    proc.on('error', () => {
      resolve(['default']);
    });
  });
}
