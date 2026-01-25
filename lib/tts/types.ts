export interface TTSService {
  synthesize(text: string): Promise<ArrayBuffer | null>;
}
