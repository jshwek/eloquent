import * as vscode from 'vscode';

export class StatusBarManager {
  private playItem: vscode.StatusBarItem;
  private stopItem: vscode.StatusBarItem;
  private isPlaying = false;

  constructor() {
    this.playItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.playItem.command = 'eloquent.readAloud';
    this.playItem.color = '#3fb950';

    this.stopItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      101
    );
    this.stopItem.command = 'eloquent.stop';
    this.stopItem.color = '#f85149';
    this.stopItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');

    this.updateDisplay();
  }

  setPlaying(playing: boolean): void {
    this.isPlaying = playing;
    this.updateDisplay();
  }

  private updateDisplay(): void {
    if (this.isPlaying) {
      this.playItem.text = '$(unmute) Eloquent: Playing';
      this.playItem.tooltip = 'Eloquent is playing';
      this.playItem.show();

      this.stopItem.text = '$(debug-stop) Stop';
      this.stopItem.tooltip = 'Stop playback';
      this.stopItem.show();
    } else {
      this.playItem.text = '$(play) Eloquent';
      this.playItem.tooltip = 'Read selected text aloud';
      this.playItem.show();

      this.stopItem.hide();
    }
  }

  dispose(): void {
    this.playItem.dispose();
    this.stopItem.dispose();
  }
}
