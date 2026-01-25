export interface STTResult {
  transcript: string;
  confidence?: number;
}

export interface STTService {
  transcribe(audioBlob: Blob): Promise<STTResult>;
}
