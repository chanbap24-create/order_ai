export interface MasterMatchCandidate {
  itemNo: string;
  englishName: string;
  koreanName: string;
  vintage?: string;
  supplyPrice?: number;
  score: number;
  matchedBy: 'english' | 'korean' | 'both' | 'pytorch_ml';
  _debug?: {
    englishScore?: number;
    koreanScore?: number;
    inputNorm?: string;
    targetEnglishNorm?: string;
    targetKoreanNorm?: string;
    method?: string;
    korean_name?: string;
    english_name?: string;
  };
}

export interface RiedelMatchCandidate {
  itemNo: string;
  englishName: string;
  koreanName: string;
  supplyPrice?: number;
  score: number;
  matchedBy: 'english' | 'korean' | 'both';
  _debug?: {
    englishScore?: number;
    koreanScore?: number;
    inputNorm?: string;
    targetEnglishNorm?: string;
    targetKoreanNorm?: string;
    method?: string;
  };
}
