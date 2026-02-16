import * as vscode from 'vscode';
import { OpenAIProvider } from './providers/openai';
import { ElevenLabsProvider } from './providers/elevenlabs';
import { AzureProvider } from './providers/azure';
import { LocalTTSProvider } from './providers/local';
import { TTSProvider } from './providers/base';
import { HybridAudioPlayer } from './player/hybrid';
import { StatusBarManager } from './ui/statusBar';
import { getConfig, promptForApiKey, TTSProviderType } from './config';

let audioPlayer: HybridAudioPlayer;
let statusBar: StatusBarManager;
let isPlaying = false;
let suppressProviderChangePrompt = false;

const providerNames: Record<TTSProviderType, string> = {
  openai: 'OpenAI',
  elevenlabs: 'ElevenLabs',
  azure: 'Azure',
  local: 'Local TTS'
};

function getProviderApiKey(provider: TTSProviderType): string {
  const config = getConfig();
  switch (provider) {
    case 'openai':
      return config.openaiApiKey;
    case 'elevenlabs':
      return config.elevenlabsApiKey;
    case 'azure':
      return config.azureApiKey;
    case 'local':
    default:
      return '';
  }
}

async function handleProviderKeyPrompt(provider: TTSProviderType): Promise<void> {
  if (provider === 'local') {
    return;
  }

  const existingKey = getProviderApiKey(provider);
  if (!existingKey) {
    await promptForApiKey(provider);
    return;
  }

  const action = await vscode.window.showInformationMessage(
    `Eloquent: ${providerNames[provider]} selected. Update API key?`,
    'Update Key',
    'Keep Current Key'
  );

  if (action === 'Update Key') {
    await promptForApiKey(provider);
  }
}

function isAuthenticationError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('401') ||
    normalized.includes('403') ||
    normalized.includes('unauthorized') ||
    normalized.includes('unauthorised') ||
    normalized.includes('authentication') ||
    normalized.includes('invalid api key') ||
    normalized.includes('incorrect api key') ||
    normalized.includes('invalid subscription key') ||
    normalized.includes('access denied')
  );
}

function createProvider(providerType: TTSProviderType, apiKey: string, azureRegion: string): TTSProvider {
  switch (providerType) {
    case 'local':
      return new LocalTTSProvider();
    case 'elevenlabs':
      return new ElevenLabsProvider(apiKey);
    case 'azure':
      return new AzureProvider(apiKey, azureRegion);
    case 'openai':
    default:
      return new OpenAIProvider(apiKey);
  }
}

export function activate(context: vscode.ExtensionContext) {
  audioPlayer = new HybridAudioPlayer(context);
  statusBar = new StatusBarManager();

  const synthesizeFromSelection = async (): Promise<Buffer | undefined> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return undefined;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showErrorMessage('Please select text to process');
      return undefined;
    }

    const text = editor.document.getText(selection);
    const config = getConfig();

    if (text.length > config.maxCharacters) {
      vscode.window.showErrorMessage(
        `Selected text exceeds maximum of ${config.maxCharacters} characters. ` +
        `You can adjust this in settings.`
      );
      return undefined;
    }

    const providerType = config.provider;
    let apiKey = '';
    if (providerType !== 'local') {
      apiKey = getProviderApiKey(providerType);
      if (!apiKey) {
        const entered = await promptForApiKey(providerType);
        if (!entered) { return undefined; }
        apiKey = entered;
      }
    }

    // Retry once if auth fails and user provides a new key.
    for (let attempt = 0; attempt < 2; attempt++) {
      const provider = createProvider(providerType, apiKey, config.azureRegion);

      try {
        const audioBuffer = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Eloquent',
            cancellable: true
          },
          async (
            progress: vscode.Progress<{ message?: string; increment?: number }>,
            token: vscode.CancellationToken
          ) => {
            progress.report({ message: `Generating speech (${providerNames[providerType]})...` });

            if (token.isCancellationRequested) {
              throw new Error('Cancelled');
            }

            const buffer = await provider.synthesize(text, {
              voice: config.voice,
              speed: config.speed
            });

            return buffer;
          }
        );

        return audioBuffer;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Cancelled') {
          return undefined;
        }

        const shouldRetryAuth =
          providerType !== 'local' &&
          attempt === 0 &&
          isAuthenticationError(message);

        if (shouldRetryAuth) {
          const action = await vscode.window.showErrorMessage(
            `Eloquent: ${providerNames[providerType]} API key appears invalid. Enter a new key?`,
            'Update Key',
            'Cancel'
          );
          if (action === 'Update Key') {
            const entered = await promptForApiKey(providerType);
            if (!entered) {
              return undefined;
            }
            apiKey = entered;
            continue;
          }
        }

        vscode.window.showErrorMessage(`Eloquent: ${message}`);
        return undefined;
      }
    }

    return undefined;
  };

  const readAloudCommand = vscode.commands.registerCommand(
    'eloquent.readAloud',
    async () => {
      const synthesisResult = await synthesizeFromSelection();
      if (!synthesisResult) {
        return;
      }

      try {
        statusBar.setPlaying(true);
        isPlaying = true;
        vscode.commands.executeCommand('setContext', 'eloquent.isPlaying', true);

        await audioPlayer.play(synthesisResult, () => {
          statusBar.setPlaying(false);
          isPlaying = false;
          vscode.commands.executeCommand('setContext', 'eloquent.isPlaying', false);
        });
      } catch (error) {
        statusBar.setPlaying(false);
        isPlaying = false;
        vscode.commands.executeCommand('setContext', 'eloquent.isPlaying', false);

        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message !== 'Cancelled') {
          vscode.window.showErrorMessage(`Eloquent: ${message}`);
        }
      }
    }
  );

  const stopCommand = vscode.commands.registerCommand('eloquent.stop', () => {
    audioPlayer.stop();
    statusBar.setPlaying(false);
    isPlaying = false;
    vscode.commands.executeCommand('setContext', 'eloquent.isPlaying', false);
  });

  // Select Provider command
  const selectProviderCommand = vscode.commands.registerCommand(
    'eloquent.selectProvider',
    async () => {
      const config = getConfig();
      const providers: Array<{ label: string; value: TTSProviderType; description: string }> = [
        { label: 'OpenAI', value: 'openai', description: 'High quality AI voices' },
        { label: 'ElevenLabs', value: 'elevenlabs', description: 'Ultra-realistic AI voices' },
        { label: 'Azure', value: 'azure', description: 'Microsoft neural voices' },
        { label: 'Local', value: 'local', description: 'Built-in system voices (free)' }
      ];

      const items = providers.map(p => ({
        label: p.value === config.provider ? `$(check) ${p.label}` : p.label,
        description: p.description,
        value: p.value
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select TTS provider'
      });

      if (selected) {
        suppressProviderChangePrompt = true;
        try {
          await vscode.workspace.getConfiguration('eloquent').update(
            'provider',
            selected.value,
            vscode.ConfigurationTarget.Global
          );
        } finally {
          suppressProviderChangePrompt = false;
        }
        vscode.window.showInformationMessage(`Eloquent: Provider set to ${selected.label.replace('$(check) ', '')}`);
        await handleProviderKeyPrompt(selected.value);
      }
    }
  );

  // Select Voice command
  const selectVoiceCommand = vscode.commands.registerCommand(
    'eloquent.selectVoice',
    async () => {
      const config = getConfig();

      const voices: Record<TTSProviderType, string[]> = {
        openai: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
        elevenlabs: ['rachel', 'drew', 'clyde', 'paul', 'sarah', 'emily', 'charlie', 'josh', 'arnold', 'charlotte', 'alice', 'matilda', 'james', 'adam'],
        azure: ['jenny', 'guy', 'aria', 'davis', 'sonia', 'ryan', 'libby', 'maisie', 'michelle', 'nancy', 'roger', 'sara'],
        local: ['default']
      };

      const providerVoices = voices[config.provider] || ['default'];
      const items = providerVoices.map(v => ({
        label: v === config.voice ? `$(check) ${v}` : v,
        value: v
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Select voice for ${config.provider}`
      });

      if (selected) {
        await vscode.workspace.getConfiguration('eloquent').update(
          'voice',
          selected.value,
          vscode.ConfigurationTarget.Global
        );
        vscode.window.showInformationMessage(`Eloquent: Voice set to ${selected.value}`);
      }
    }
  );

  // Set Speed command
  const setSpeedCommand = vscode.commands.registerCommand(
    'eloquent.setSpeed',
    async () => {
      const config = getConfig();
      const speeds = ['0.5', '0.75', '1.0', '1.25', '1.5', '1.75', '2.0'];

      const items = speeds.map(s => ({
        label: parseFloat(s) === config.speed ? `$(check) ${s}x` : `${s}x`,
        value: parseFloat(s)
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select playback speed'
      });

      if (selected) {
        await vscode.workspace.getConfiguration('eloquent').update(
          'speed',
          selected.value,
          vscode.ConfigurationTarget.Global
        );
        vscode.window.showInformationMessage(`Eloquent: Speed set to ${selected.value}x`);
      }
    }
  );

  // Open Settings command
  const openSettingsCommand = vscode.commands.registerCommand(
    'eloquent.openSettings',
    () => {
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:eloquent');
    }
  );

  const configChangeListener = vscode.workspace.onDidChangeConfiguration(async (event: vscode.ConfigurationChangeEvent) => {
    if (!event.affectsConfiguration('eloquent.provider') || suppressProviderChangePrompt) {
      return;
    }

    const config = getConfig();
    await handleProviderKeyPrompt(config.provider);
  });

  context.subscriptions.push(
    readAloudCommand,
    stopCommand,
    selectProviderCommand,
    selectVoiceCommand,
    setSpeedCommand,
    openSettingsCommand,
    configChangeListener,
    statusBar
  );
}

export function deactivate() {
  audioPlayer?.dispose();
  statusBar?.dispose();
}
