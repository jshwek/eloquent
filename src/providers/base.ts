export interface TTSProvider {
  readonly name: string;
  synthesize(text: string, options: TTSOptions): Promise<Buffer>;
}

export interface TTSOptions {
  voice: string;
  speed: number;
}
