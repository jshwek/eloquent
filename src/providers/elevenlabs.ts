import * as https from 'https';
import { TTSProvider, TTSOptions } from './base';

export class ElevenLabsProvider implements TTSProvider {
  readonly name = 'ElevenLabs';
  private apiKey: string;

  // Default voice IDs for ElevenLabs
  static readonly VOICES: Record<string, string> = {
    'rachel': '21m00Tcm4TlvDq8ikWAM',
    'drew': '29vD33N1CtxCmqQRPOHJ',
    'clyde': '2EiwWnXFnvU5JabPnv8n',
    'paul': '5Q0t7uMcjvnagumLfvZi',
    'domi': 'AZnzlk1XvdvUeBnXmlld',
    'dave': 'CYw3kZ02Hs0563khs1Fj',
    'fin': 'D38z5RcWu1voky8WS1ja',
    'sarah': 'EXAVITQu4vr4xnSDxMaL',
    'antoni': 'ErXwobaYiN019PkySvjV',
    'thomas': 'GBv7mTt0atIp3Br8iCZE',
    'charlie': 'IKne3meq5aSn9XLyUdCD',
    'emily': 'LcfcDJNUP1GQjkzn1xUU',
    'elli': 'MF3mGyEYCl7XYWbV9V6O',
    'callum': 'N2lVS1w4EtoT3dr4eOWO',
    'patrick': 'ODq5zmih8GrVes37Dizd',
    'harry': 'SOYHLrjzK2X1ezoPC6cr',
    'liam': 'TX3LPaxmHKxFdv7VOQHJ',
    'dorothy': 'ThT5KcBeYPX3keUQqHPh',
    'josh': 'TxGEqnHWrfWFTfGW9XjX',
    'arnold': 'VR6AewLTigWG4xSOukaG',
    'charlotte': 'XB0fDUnXU5powFXDhCwa',
    'alice': 'Xb7hH8MSUJpSbSDYk0k2',
    'matilda': 'XrExE9yKIg1WjnnlVkGX',
    'james': 'ZQe5CZNOzWyzPSCn5a3c',
    'joseph': 'Zlb1dXrM653N07WRdFW3',
    'lily': 'pFZP5JQG7iQjIQuC4Bku',
    'jessica': 'cgSgspJ2msm6clMCkdW9',
    'michael': 'flq6f7yk4E4fJM5XTYuZ',
    'nicole': 'piTKgcLEGmPE4e6mEKli',
    'bill': 'pqHfZKP75CvOlQylNhV4',
    'george': 'JBFqnCBsd6RMkjVDRZzb',
    'adam': 'pNInz6obpgDQGcFmaJgB'
  };

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async synthesize(text: string, options: TTSOptions): Promise<Buffer> {
    // Get voice ID from name or use directly
    const voiceId = ElevenLabsProvider.VOICES[options.voice.toLowerCase()] || options.voice;

    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          speed: options.speed
        }
      });

      const req = https.request(
        {
          hostname: 'api.elevenlabs.io',
          path: `/v1/text-to-speech/${voiceId}`,
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          }
        },
        (res) => {
          if (res.statusCode !== 200) {
            let errorBody = '';
            res.on('data', chunk => errorBody += chunk);
            res.on('end', () => {
              try {
                const error = JSON.parse(errorBody);
                reject(new Error(error.detail?.message || `ElevenLabs API error: ${res.statusCode}`));
              } catch {
                reject(new Error(`ElevenLabs API error: ${res.statusCode}`));
              }
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
      req.write(data);
      req.end();
    });
  }
}
