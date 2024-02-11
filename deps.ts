export {
  bgBlue,
  bgGreen,
  bgRed,
  yellow,
} from "https://deno.land/std@0.216.0/fmt/colors.ts";
export { exists } from "https://deno.land/std@0.216.0/fs/exists.ts";
export { Buffer, copy } from "https://deno.land/std@0.216.0/io/mod.ts";
export {
  basename,
  dirname,
  join,
} from "https://deno.land/std@0.216.0/path/mod.ts";
export * as posix from "https://deno.land/std@0.216.0/path/posix/mod.ts";
export * as win32 from "https://deno.land/std@0.216.0/path/windows/mod.ts";
export { readAll } from "https://deno.land/std@0.216.0/io/read_all.ts";
export {
  readerFromStreamReader,
} from "https://deno.land/std@0.216.0/streams/mod.ts";
export { default as i18next } from "https://deno.land/x/i18next@v21.2.4/index.js";

export { parse } from "https://deno.land/x/xml@2.1.3/mod.ts";

export { default as yargs } from "https://deno.land/x/yargs@v17.2.1-deno/deno.ts";
export type { Arguments } from "https://deno.land/x/yargs@v17.2.1-deno/deno-types.ts";

export {
  BlobReader,
  BlobWriter,
  ZipReader,
  ZipWriter,
} from "https://deno.land/x/zipjs@v2.3.17/index.js";

export { default as $ } from "https://deno.land/x/dax@0.39.1/mod.ts";
