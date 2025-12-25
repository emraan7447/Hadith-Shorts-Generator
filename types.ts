
export interface Hadith {
  arabic: string;
  english: string;
  source: string;
  grade: string;
}

export interface VideoTemplate {
  id: string;
  name: string;
  previewUrl: string;
  bgClass: string;
  textStyle: string;
}

export interface GenerationState {
  status: 'idle' | 'fetching_hadith' | 'generating_tts' | 'generating_video' | 'complete' | 'error';
  progress: number;
  message: string;
  videoUrl?: string;
  audioUrl?: string;
}

export interface VideoSettings {
  templateId: string;
  fontSize: number;
  voice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  includeArabic: boolean;
}
