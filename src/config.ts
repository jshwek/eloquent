import * as vscode from 'vscode';

export type TTSProviderType = 'openai' | 'elevenlabs' | 'azure' | 'local';

export interface EloquentConfig {
  provider: TTSProviderType;
  openaiApiKey: string;
  elevenlabsApiKey: string;
  azureApiKey: string;
  azureRegion: string;
  voice: string;
  speed: number;
  maxCharacters: number;
}

export function getConfig(): EloquentConfig {
  const config = vscode.workspace.getConfiguration('eloquent');
  return {
    provider: config.get<TTSProviderType>('provider', 'openai'),
    openaiApiKey: config.get<string>('openaiApiKey', ''),
    elevenlabsApiKey: config.get<string>('elevenlabsApiKey', ''),
    azureApiKey: config.get<string>('azureApiKey', ''),
    azureRegion: config.get<string>('azureRegion', 'eastus'),
    voice: config.get<string>('voice', 'nova'),
    speed: config.get<number>('speed', 1.0),
    maxCharacters: config.get<number>('maxCharacters', 4096)
  };
}

export async function promptForApiKey(provider: TTSProviderType): Promise<string | undefined> {
  const prompts: Record<string, { prompt: string; placeholder: string; setting: string }> = {
    openai: {
      prompt: 'Enter your OpenAI API key',
      placeholder: 'sk-...',
      setting: 'openaiApiKey'
    },
    elevenlabs: {
      prompt: 'Enter your ElevenLabs API key',
      placeholder: 'Enter API key...',
      setting: 'elevenlabsApiKey'
    },
    azure: {
      prompt: 'Enter your Azure Speech API key',
      placeholder: 'Enter API key...',
      setting: 'azureApiKey'
    }
  };

  const config = prompts[provider];
  if (!config) {
    return undefined;
  }

  const key = await vscode.window.showInputBox({
    prompt: config.prompt,
    password: true,
    placeHolder: config.placeholder,
    ignoreFocusOut: true
  });

  if (key) {
    await vscode.workspace.getConfiguration('eloquent').update(
      config.setting,
      key,
      vscode.ConfigurationTarget.Global
    );
  }

  return key;
}
