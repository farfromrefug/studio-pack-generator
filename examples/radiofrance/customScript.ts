import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const EPREGEXP = /(?:(\d+)\/(\d+)|Ep.\s(\d+)|(?:E|É)pisode\s(\d+))/;
const EPCLEANREGEXP =
  /(?:(?:E|É)pisode (\d+)(?:\/(\d+))?\s*:\s*(.*)|(.*) - Ep. (\d+))/;

function loadPageItems(website: string, page: number) {
  return new Promise((resolve, reject) => {
    fetch(
      `${website}?p=` +
        (page + 1),
    ).then((r) => r.text())
      .then((r) => {
        const $ = cheerio.load(r);
        const htmlData: string = $.html();
        const test = htmlData.match(/const data = \[(.*)}];/);
        const jsonData: any[] = new Function(`return [${test?.[1]}}]`)();

        const seriesData = jsonData[3].data;
        const detailsItems: any[] = seriesData.metadata.pagination.items;
        const podcastTitleSplitted = seriesData.content.title.split(":")
          .reverse();
        const podcastTitle = podcastTitleSplitted.join(": ").trim();
        const items = detailsItems.map((details, index) => {
          const manifestations = details.manifestations;
          if (manifestations.length === 0) {
            return;
          }
          const manifestation = manifestations.find((m: any) =>
            m.preset?.bitrate === 192 && m.preset?.encoding === "MP3"
          ) || manifestations.find((m: any) =>
            m.preset?.encoding === "MP3"
          ) || manifestations[0];
          
          let title = manifestation.title;
          let episode;
          // we support multiple Episode number formats like 1/3, Ep. 4
          let match = title.match(EPREGEXP) || details.title.match(EPREGEXP);
          if (match?.length > 2) {
            episode = parseInt(match[4] || match[3] || match[1]);
            title = details.title;
            match = title.match(EPCLEANREGEXP);
            if (match?.length > 2) {
              title = match[4] || match[3];
            }
          }

          return {
            enclosure: {
              "@url": manifestation.url,
            },
            title: title.trim(),
            pubDate: manifestation.created,
            "itunes:duration": manifestation.duration,
            "itunes:subtitle": details.description,
            "itunes:episode": episode,
            "itunes:image": {
              "@href": details.visual.breakpoints[0].src,
            },
          };
        }).filter((d) => !!d);
        resolve({
          title: podcastTitle,
          description: seriesData.content.standFirst,
          image: { url: seriesData.content.visual.src },
          item: items.reverse(),
        });
      })
      .catch(reject);
  });
}

export async function fetchRssItems(url: string, opt: any) {
  const result: any[] = await Promise.all(
    Array.apply(null, Array(2)).map((value, index) => {
      return loadPageItems(url, index);
    }),
  );
  return {
    ...result[0],
    item: result.map((r) => r.item).flat(),
  };
}
