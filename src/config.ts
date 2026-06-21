import * as vscode from 'vscode';

export type TTSProviderType = 'openai' | 'elevenlabs' | 'azure' | 'local';

export interface EloquentConfig {
  provider: TTSProviderType;
  azureRegion: string;
  voice: string;
  speed: number;
  maxCharacters: number;
}

export function getConfig(): EloquentConfig {
  const config = vscode.workspace.getConfiguration('eloquent');
  return {
    provider: config.get<TTSProviderType>('provider', 'openai'),
    azureRegion: config.get<string>('azureRegion', 'eastus'),
    voice: config.get<string>('voice', 'nova'),
    speed: config.get<number>('speed', 1.0),
    maxCharacters: config.get<number>('maxCharacters', 4096)
  };
}

// Legacy cleartext settings that used to hold API keys (pre-1.1.2). These are
// kept only so the migration can read and erase them from settings.json.
const LEGACY_API_KEY_SETTINGS: Record<Exclude<TTSProviderType, 'local'>, string> = {
  openai: 'openaiApiKey',
  elevenlabs: 'elevenlabsApiKey',
  azure: 'azureApiKey'
};

function secretKey(provider: TTSProviderType): string {
  return `eloquent.${provider}.apiKey`;
}

export async function getApiKey(
  secrets: vscode.SecretStorage,
  provider: TTSProviderType
): Promise<string> {
  if (provider === 'local') {
    return '';
  }
  return (await secrets.get(secretKey(provider))) ?? '';
}

export async function setApiKey(
  secrets: vscode.SecretStorage,
  provider: TTSProviderType,
  key: string
): Promise<void> {
  if (provider === 'local') {
    return;
  }
  await secrets.store(secretKey(provider), key);
}

export async function promptForApiKey(
  secrets: vscode.SecretStorage,
  provider: TTSProviderType
): Promise<string | undefined> {
  const prompts: Record<string, { prompt: string; placeholder: string }> = {
    openai: { prompt: 'Enter your OpenAI API key', placeholder: 'sk-...' },
    elevenlabs: { prompt: 'Enter your ElevenLabs API key', placeholder: 'Enter API key...' },
    azure: { prompt: 'Enter your Azure Speech API key', placeholder: 'Enter API key...' }
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
    await setApiKey(secrets, provider, key);
  }

  return key;
}

/**
 * One-time migration for installs that stored API keys as cleartext in
 * settings.json. Moves any existing keys into encrypted SecretStorage and
 * removes them from every settings scope so the cleartext copy is erased.
 */
export async function migrateApiKeysFromSettings(
  secrets: vscode.SecretStorage
): Promise<boolean> {
  const config = vscode.workspace.getConfiguration('eloquent');
  let migratedAny = false;

  for (const [provider, setting] of Object.entries(LEGACY_API_KEY_SETTINGS)) {
    const inspected = config.inspect<string>(setting);
    if (!inspected) {
      continue;
    }

    const existingValue =
      inspected.globalValue ??
      inspected.workspaceValue ??
      inspected.workspaceFolderValue;

    // Move the cleartext value into SecretStorage, but never overwrite a key
    // the user has already entered through the secure path.
    if (existingValue) {
      const alreadyStored = await secrets.get(secretKey(provider as TTSProviderType));
      if (!alreadyStored) {
        await setApiKey(secrets, provider as TTSProviderType, existingValue);
      }
      migratedAny = true;
    }

    // Erase the cleartext value from any scope that defines it.
    const targets: Array<[unknown, vscode.ConfigurationTarget]> = [
      [inspected.globalValue, vscode.ConfigurationTarget.Global],
      [inspected.workspaceValue, vscode.ConfigurationTarget.Workspace],
      [inspected.workspaceFolderValue, vscode.ConfigurationTarget.WorkspaceFolder]
    ];

    for (const [value, target] of targets) {
      if (value === undefined) {
        continue;
      }
      try {
        await config.update(setting, undefined, target);
      } catch {
        // Updating a scope that isn't open (e.g. no workspace) can throw; ignore.
      }
    }
  }

  return migratedAny;
}
