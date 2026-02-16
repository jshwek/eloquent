import * as https from 'https';
import { TTSProvider, TTSOptions } from './base';

export class AzureProvider implements TTSProvider {
  readonly name = 'Azure';
  private apiKey: string;
  private region: string;

  // Popular Azure Neural voices
  static readonly VOICES: Record<string, string> = {
    // English (US)
    'jenny': 'en-US-JennyNeural',
    'guy': 'en-US-GuyNeural',
    'aria': 'en-US-AriaNeural',
    'davis': 'en-US-DavisNeural',
    'amber': 'en-US-AmberNeural',
    'brandon': 'en-US-BrandonNeural',
    'christopher': 'en-US-ChristopherNeural',
    'cora': 'en-US-CoraNeural',
    'elizabeth': 'en-US-ElizabethNeural',
    'eric': 'en-US-EricNeural',
    'jacob': 'en-US-JacobNeural',
    'michelle': 'en-US-MichelleNeural',
    'monica': 'en-US-MonicaNeural',
    'nancy': 'en-US-NancyNeural',
    'roger': 'en-US-RogerNeural',
    'sara': 'en-US-SaraNeural',
    'tony': 'en-US-TonyNeural',
    // English (UK)
    'sonia': 'en-GB-SoniaNeural',
    'ryan': 'en-GB-RyanNeural',
    'libby': 'en-GB-LibbyNeural',
    'maisie': 'en-GB-MaisieNeural'
  };

  constructor(apiKey: string, region: string = 'eastus') {
    this.apiKey = apiKey;
    this.region = region;
  }

  async synthesize(text: string, options: TTSOptions): Promise<Buffer> {
    // Get voice name from short name or use directly
    const voiceName = AzureProvider.VOICES[options.voice.toLowerCase()] || options.voice;

    // Build SSML with rate adjustment
    const rate = this.speedToRate(options.speed);
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="${voiceName}">
          <prosody rate="${rate}">
            ${this.escapeXml(text)}
          </prosody>
        </voice>
      </speak>
    `.trim();

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: `${this.region}.tts.speech.microsoft.com`,
          path: '/cognitiveservices/v1',
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
            'User-Agent': 'Eloquent-VSCode'
          }
        },
        (res) => {
          if (res.statusCode !== 200) {
            let errorBody = '';
            res.on('data', chunk => errorBody += chunk);
            res.on('end', () => {
              reject(new Error(`Azure API error: ${res.statusCode} - ${errorBody}`));
            });
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        }
      );

      req.on('error', reject);
      req.write(ssml);
      req.end();
    });
  }

  private speedToRate(speed: number): string {
    // Convert 0.25-4.0 to percentage like "-50%" to "+200%"
    const percent = Math.round((speed - 1) * 100);
    if (percent >= 0) {
      return `+${percent}%`;
    }
    return `${percent}%`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
