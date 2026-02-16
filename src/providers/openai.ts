import * as https from 'https';
import { TTSProvider, TTSOptions } from './base';

export class OpenAIProvider implements TTSProvider {
  readonly name = 'OpenAI';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async synthesize(text: string, options: TTSOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: options.voice,
        speed: options.speed,
        response_format: 'mp3'
      });

      const req = https.request(
        {
          hostname: 'api.openai.com',
          path: '/v1/audio/speech',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          }
        },
        (res) => {
          if (res.statusCode !== 200) {
            let errorBody = '';
            res.on('data', chunk => errorBody += chunk);
            res.on('end', () => {
              try {
                const error = JSON.parse(errorBody);
                reject(new Error(error.error?.message || `API error: ${res.statusCode}`));
              } catch {
                reject(new Error(`API error: ${res.statusCode}`));
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
