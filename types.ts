import type { Rss, RssItem } from "./generate/rss_parser.ts";
import type { StudioPackGenerator } from "./studio_pack_generator.ts";

export interface CustomModule {
  fetchRssItemImage?: (
    item: RssItem,
    opt: StudioPackGenerator,
  ) => Promise<string>;
  fetchRssItemTitle?: (
    item: RssItem,
    opt: StudioPackGenerator,
  ) => Promise<string>;
  fetchRssItemFileName?: (
    item: RssItem,
    opt: StudioPackGenerator,
  ) => Promise<string>;
  fetchRssItemUrl?: (
    item: RssItem,
    opt: StudioPackGenerator,
  ) => Promise<string>;
  writeFileWithUrl?: (
    url: string,
    filePath: string,
    opt: StudioPackGenerator,
  ) => Promise<Rss>;
  fetchRssItems?: (
    url: string,
    opt: StudioPackGenerator,
  ) => Promise<Rss>;
}

export const OPEN_AI_VOICES = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
] as const;
export const OPEN_AI_MODELS = ["tts-1", "tts-1-hd"] as const;
