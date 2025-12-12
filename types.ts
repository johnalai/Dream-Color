export type ColoringMode = 'standard' | 'number' | 'letter' | 'trace';

export interface Scene {
  id: string;
  description: string;
}

export interface GeneratedImage {
  id: string;
  url: string; // Base64 data URL
  description: string;
  type: 'cover' | 'page';
}

export interface TraceConfig {
  lineThickness: 'thin' | 'medium' | 'thick';
  spacing: 'compact' | 'normal' | 'wide';
  includeNumbers: boolean;
}

export interface BookData {
  theme: string;
  childName: string;
  ageGroup: string;
  fontId: string;
  coloringMode: ColoringMode;
  traceConfig?: TraceConfig;
  scenes: Scene[];
  images: GeneratedImage[];
}

export enum AppState {
  INPUT = 'INPUT',
  PLANNING = 'PLANNING',
  GENERATING = 'GENERATING',
  PREVIEW = 'PREVIEW',
  ERROR = 'ERROR'
}