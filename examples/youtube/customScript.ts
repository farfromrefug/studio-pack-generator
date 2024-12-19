import sharp from "npm:sharp";
import ytdl from "npm:@distube/ytdl-core@4.15.1";
import {getRandomIPv6} from "npm:@distube/ytdl-core@4.15.1/lib/utils.js";
import ffmpeg from "npm:fluent-ffmpeg";
import { parse } from "@libs/xml";

const imageRegex = /img src="(.*)"/;
const videoRegex = /www.youtube.com\/watch\?v=(.*)/;

export async function fetchRssItems(url: string, opt: any) {
  const resp = await fetch(url);
  const xml = (await resp.text()).replace(/<\?xml-stylesheet [^>]+\?>/, "");
  const parsed = parse(xml);
  const rss = (parsed.rss as any)?.channel;
  rss.title = rss.description = rss.title.replace('Playlist: ', '').replace(' - YouTube', '')
  rss.image.url = await fetchRssItemImage(rss.item[0], opt)
  return rss;
}
export async function writeFileWithUrl(
  url: string,
  filePath: string,
  opt: any,
) {
  const match = url.match(videoRegex);
  console.log("writeFileWithUrl0", url, match);
  if (match) {
    const videoID = match[1];
    const agent = ytdl.createAgent(undefined, {
      localAddress: getRandomIPv6("2001:2::/48"),
    });
    console.log("writeFileWithUrl", videoID, url);
    await new Promise<void>(function (resolve, reject) {
      
      const stream = ytdl(url, { quality: 'highestaudio', agent})
      ffmpeg(stream)
        .audioBitrate(192)
        .save(filePath)
        .on('progress', p => {
          console.log(`${p.targetSize}kb downloaded`);
        })
        .on('end', () => {
          console.log("write done", url);
          resolve();
        }).on("error", (error) => {
          console.log("write error", error);
          reject(error);
        });
    });
  } else {
    const isImage = url.endsWith('.jpg');
    const tempFilePath = await Deno.makeTempFile({
      suffix: ".jpg",
    });
    const resp = await fetch(url);
    const file = await Deno.open(isImage? tempFilePath : filePath, { create: true, write: true });
    await resp.body?.pipeTo(file.writable);
    if (isImage) {
      await sharp(tempFilePath)
      .trim()
      .toFile(filePath);
    }
  }
}
export async function fetchRssItemImage(item: any, opt: any) {
  const result = (item.description as string).match(imageRegex)?.[1];
  return result;
}

export async function fetchRssItemTitle(item: any, opt: any) {
  return item.title.replace(/[\s ]I Quelle Histoire - TV5 Monde/, "");
}

export async function fetchRssItemFileName(item: any, opt: any) {
  return item.title.replace(/[\s ]I Quelle Histoire - TV5 Monde/, "") + ".mp3";
}

export async function fetchRssItemUrl(item: any, opt: any) {
  console.log("fetchRssItemUrl", item.link);
  return item.link;
}
