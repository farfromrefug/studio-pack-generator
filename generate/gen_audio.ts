import { generate_audio_basic_tts } from "./basic_tts.ts";
import { generate_audio_with_openAI } from "./openai_tts.ts";
import { generate_audio_with_coqui } from "./coqui_tts.ts";
import type { StudioPackGenerator } from "../studio_pack_generator.ts";

export async function generateAudio(
  title: string,
  outputPath: string,
  lang: string,
  opt: StudioPackGenerator,
) {
  if (opt.useOpenAiTts) {
    const output = outputPath.replace(/\.wav/i, ".mp3");
    await generate_audio_with_openAI(title, output, opt);
  } else if (opt.useCoquiTts) {
    await generate_audio_with_coqui(title, opt, outputPath);
  } else {
    await generate_audio_basic_tts(title, outputPath, lang, opt);
  }
}
