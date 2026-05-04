import { ColorIdentifier } from "@/lib/ColorIdentifier";
import { SimplifiedState } from "../card/getSimplifiedStatesOf";

export interface DeckStatCache {
  counts: Record<SimplifiedState, number>;
  lastUpdated: Date;
  includesSubdecks: boolean;
}

export type MaterialType = 'doc' | 'resume' | 'table' | 'ppt' | 'video' | 'audio';

export interface StudyMaterial {
  id: string;
  type: MaterialType;
  title: string;
  url?: string;
  content?: string;
  createdAt: Date;
}

export interface Deck {
  id: string;
  name: string;
  subDecks: string[];
  superDecks?: string[];
  cards: Array<string>;
  notes: Array<string>;
  description?: string;
  options: DeckOptions;
  color?: ColorIdentifier;
  statCache?: DeckStatCache;
  studyMaterials?: StudyMaterial[];
}

export interface DeckOptions {
  newToReviewRatio: number;
  dailyNewCards: number;
}
