#!/usr/bin/env -S deno run  -A

import $ from "@david/dax";
import { decodeBase64, encodeBase64 } from "@std/encoding";
import { cliteRun } from "@jersou/clite";
import assetsFromJson from "./assets_bundle.json" with { type: "json" };
import { walk } from "@std/fs";
import { assert } from "@std/assert";
import { extname } from "@std/path";
import { generatePack, getMetadata } from "../gen_pack.ts";
import { fsToFolder } from "../serialize/fs.ts";
import type { Metadata } from "../serialize/serialize-types.ts";
import { folderToPack } from "../serialize/converter.ts";
import { throttle } from "@es-toolkit/es-toolkit";
import type { ModOptions } from "../types.ts";
import { contentType } from "@std/media-types";
import { red } from "@std/fmt/colors";
import { cleanOption } from "../utils/utils.ts";

type Assets = {
  [k: string]: { type: string; content: Uint8Array; route: URLPattern };
};

export function openGui(opt: ModOptions) {
  if (!opt.storyPath) {
    console.log("No story path → exit");
    Deno.exit(5);
  }
  if (opt.storyPath.startsWith("http")) {
    console.log(red("The GUI mode doesn't work with RSS url !"));
    Deno.exit(6);
  }

  const uiApp = new StudioPackGeneratorGui();
  uiApp.update = false;
  uiApp.openInBrowser = true;
  uiApp.notExitIfNoClient = false;
  uiApp.port = opt.port || 5555;
  uiApp.setStudioPackGeneratorOpt(opt);
  return uiApp.main();
}

async function getPack(opt: ModOptions) {
  const folder = await fsToFolder(opt.storyPath, false);
  const metadata: Metadata = await getMetadata(opt.storyPath, opt);
  return await folderToPack(folder, metadata);
}

async function runSpg(opt: ModOptions) {
  try {
    await generatePack({ ...opt });
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function getAccessControlAllowOrigin(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  if ((origin ?? "").startsWith("http://localhost:")) {
    return { "Access-Control-Allow-Origin": (origin ?? "http://localhost") };
  } else {
    return {};
  }
}
async function getFileBrowser() {
  switch (Deno.build.os) {
    case "windows":
      return ["start"];
    case "darwin":
      return ["open"];
    case "linux":
    default:
      if (await $.commandExists("gio")) {
        return ["gio", "open"];
      } else if (await $.commandExists("xdg-open")) {
        return ["xdg-open"];
      } else if (await $.commandExists("nautilus")) {
        return ["nautilus"];
      } else if (await $.commandExists("nemo")) {
        return ["nemo"];
      } else {
        return null;
      }
  }
}

async function openFolder(path: string) {
  const fileBrowser = await getFileBrowser();
  if (fileBrowser) {
    return $`${fileBrowser} ${path}`.noThrow(true).printCommand(true).spawn();
  } else {
    return null;
  }
}

class StudioPackGeneratorGui {
  setStudioPackGeneratorOpt(opt: ModOptions) {
    this.#opt = opt;
  }
  hostname = "localhost";
  port = 5555;
  notExitIfNoClient: boolean | string = false;
  openInBrowser: boolean | string = false;
  openInBrowserAppMode: boolean | string = false;
  update: boolean | string = false;
  _update_desc = "update assets_bundle.json";
  #opt?: ModOptions;
  #watcher?: Deno.FsWatcher;
  #server: Deno.HttpServer | undefined;
  #sockets = new Set<WebSocket>();
  #assets: Assets = {};
  #wsRoute = new URLPattern({ pathname: "/api/events-ws" });
  #routes = [
    {
      route: new URLPattern({ pathname: "/file" }),
      exec: async (_match: URLPatternResult, request: Request) => {
        const url = new URL(request.url);
        const path = decodeURIComponent(url.searchParams.get("path") ?? "");
        if (path.startsWith(this.#opt!.storyPath)) {
          const ext = extname(path);
          const type = contentType(ext) ?? "application/octet-stream";
          const content = await Deno.readFile(path);
          const headers = { "Content-Type": type };
          return new Response(content, { status: 200, headers });
        } else {
          return new Response("Not a pack file", { status: 403 });
        }
      },
    },
    {
      route: new URLPattern({ pathname: "/api/runSpg" }),
      exec: async (_match: URLPatternResult, request: Request) => {
        const opt = await request.json();
        const optFiltered = cleanOption(opt);
        console.log(`Run SPG on ${this.#opt!.storyPath}`);

        (async () => {
          console.log("SPG start");
          this.#sendWs(JSON.stringify({ type: "SPG-start" }));

          try {
            const res = await runSpg({
              ...optFiltered,
              storyPath: this.#opt!.storyPath,
            });
            console.log("SPG end");
            this.#sendWs(JSON.stringify({ type: "SPG-end", ok: res }));
          } catch (error) {
            console.error(error);
          }
        })();

        return new Response("ok", {
          status: 200,
          headers: getAccessControlAllowOrigin(request),
        });
      },
    },
    {
      route: new URLPattern({ pathname: "/api/openFolder" }),
      exec: (_match: URLPatternResult, request: Request) => {
        const url = new URL(request.url);
        const path = decodeURIComponent(url.searchParams.get("path") ?? "");
        if (path.startsWith(this.#opt!.storyPath)) {
          openFolder(path);
          return new Response("ok", {
            status: 200,
            headers: getAccessControlAllowOrigin(request),
          });
        } else {
          return new Response("Not a pack file", { status: 403 });
        }
      },
    },
    {
      route: new URLPattern({ pathname: "/api/storyPath" }),
      exec: (_match: URLPatternResult, request: Request) => {
        const url = new URL(request.url);
        const path = decodeURIComponent(url.searchParams.get("path") ?? "");
        this.#watchStoryPath(path);
        return new Response("ok", {
          status: 200,
          headers: getAccessControlAllowOrigin(request),
        });
      },
    },
  ] as const;

  #sendWs(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    this.#sockets.forEach((s) => s.send(data));
  }

  async #watchStoryPath(path: string) {
    this.#opt!.storyPath = path;
    if (this.#watcher) {
      try {
        this.#watcher.close();
        this.#watcher = undefined;
      } catch (e) {
        console.error("#watcher.close()", e);
      }
    }
    if (this.#opt!.storyPath) {
      try {
        const onWatchEvent = async (newStoryPath?: boolean) => {
          const pack = await getPack(this.#opt!);
          this.#sendWs(
            JSON.stringify({ type: "fs-update", pack, newStoryPath }),
          );
        };
        const onWatchEventThrottle = throttle(onWatchEvent, 1000);
        onWatchEventThrottle(true);
        console.log({ storyPath: this.#opt!.storyPath });
        this.#watcher = Deno.watchFs(this.#opt!.storyPath);
        for await (const _event of this.#watcher) {
          onWatchEventThrottle();
        }
      } catch (e) {
        console.error("watchStoryPath", e);
      }
    } else {
      this.#sendWs(
        JSON.stringify({
          type: "fs-update",
          pack: {
            title: "",
            description: "",
            format: "",
            version: 0,
            nightModeAvailable: false,
            entrypoint: {
              class: "StageNode-Entrypoint",
              name: "",
              okTransition: {
                class: "ActionNode",
                name: "",
                options: [],
              },
              image: null,
              audio: null,
            },
          },
          newStoryPath: true,
        }),
      );
    }
  }

  async main(storyPath?: string) {
    console.log("GUI options", this.#opt);
    if (storyPath) {
      this.#opt = { storyPath } as ModOptions;
    }
    if (!this.#opt?.storyPath) {
      console.log("No story path → exit");
      Deno.exit(5);
    }

    await this.#loadAssets();
    const onListen = (params: { hostname: string; port: number }) => {
      (async () => {
        if (this.#opt!.storyPath) {
          this.#watchStoryPath(this.#opt!.storyPath);
        }
        const onWatchEvent = async () => {
          try {
            const pack = await getPack(this.#opt!);
            this.#sendWs(JSON.stringify({ type: "fs-update", pack }));
          } catch (e) {
            console.error(e);
          }
        };
        const onWatchEventThrottle = throttle(onWatchEvent, 500);
        const watcher = Deno.watchFs(this.#opt!.storyPath);
        for await (const _event of watcher) {
          onWatchEventThrottle();
        }
      })();

      this.port = params.port;
      this.hostname = params.hostname;
      console.log(`Listen on ${this.hostname}:${this.port}`);

      if (this.openInBrowser && this.openInBrowser !== "false") {
        this.#openInBrowser().then();
      }
    };
    this.#server = Deno.serve(
      { hostname: this.hostname, port: this.port, onListen },
      (r) => this.#handleRequest(r),
    );
  }

  async #openInBrowser() {
    const appMode = this.openInBrowserAppMode === true ||
      this.openInBrowserAppMode === "true";
    const arg = appMode ? "--app=" : "";
    const url = `http://${
      this.hostname.startsWith("::") ? "localhost" : this.hostname // FIXME
    }:${this.port}/`;
    if (this.openInBrowser === true || this.openInBrowser === "true") {
      switch (Deno.build.os) {
        case "windows":
          await $`cmd /s /c start '' /b ${url}`;
          break;
        case "darwin":
          await $`open ${url}`;
          break;
        case "linux":
        default:
          if (await $.commandExists("xdg-open")) {
            await $`xdg-open ${url}`;
          } else {
            await $`gio open ${url}`;
          }
      }
    } else {
      await $`${this.openInBrowser} ${arg}${url}`;
    }
  }

  async #handleRequest(request: Request) {
    try {
      console.log(`handle ${request.url}`);
      for (const { route, exec } of this.#routes) {
        const match = route.exec(request.url);
        if (match) {
          return await exec(match, request);
        }
      }
      for (const file of Object.values(this.#assets ?? {})) {
        if (file.route?.exec(request.url)) {
          const headers = { "Content-Type": file.type };
          return new Response(file.content, { status: 200, headers });
        }
      }
      if (this.#wsRoute.exec(request.url)) {
        return this.#handleWsRequest(request);
      }
      return new Response("", { status: 404 });
    } catch (err) {
      console.error("handleRequest error", err);
      return new Response("", { status: 500 });
    }
  }

  #handleWsRequest(request: Request) {
    if (request.headers.get("upgrade") != "websocket") {
      return new Response(null, { status: 501 });
    }
    const { socket, response } = Deno.upgradeWebSocket(request);
    socket.addEventListener("open", async () => {
      this.#sockets.add(socket);
      console.log(`a client connected! ${this.#sockets.size} clients`);
      if (this.#opt?.storyPath) {
        try {
          const pack = await getPack(this.#opt!);
          // console.log(JSON.stringify(pack, null, "  "));
          socket.send(
            JSON.stringify({ type: "fs-update", pack, newStoryPath: true }),
          );
          socket.send(JSON.stringify({ type: "opt", opt: this.#opt }));
        } catch (e) {
          console.error(e);
        }
      }
    });
    socket.addEventListener("close", () => {
      this.#sockets.delete(socket);
      console.log(`a client disconnected! ${this.#sockets.size} clients`);
      if (
        (this.notExitIfNoClient === false ||
          this.notExitIfNoClient === "false") && this.#sockets.size === 0
      ) {
        console.log(`→ ExitIfNoClient → shutdown server !`);
        // this.#server?.shutdown();
        Deno.exit(0);
      }
    });
    return response;
  }

  async updateAssets() {
    console.log("update assets_bundle.json");
    const frontendPath = $.path(import.meta.url).resolve(`../frontend/dist/`)
      .toString();
    for await (const entry of walk(frontendPath, { includeDirs: false })) {
      assert(entry.path.startsWith(frontendPath));
      const path = entry.path.substring(frontendPath.length);
      const ext = extname(path);
      const type = contentType(ext) ?? "";
      const content = await Deno.readFile(entry.path);
      const route = new URLPattern({ pathname: path });
      this.#assets[path] = { type, route, content };
      console.log({ path, type });
    }
    const paths = Object.keys(this.#assets).sort();
    const assets: Assets = {};
    paths.forEach((path) => (assets[path] = this.#assets[path]));
    await Deno.writeTextFile(
      $.path(import.meta.url).resolve("../assets_bundle.json").toString(),
      JSON.stringify(assets, (key, value) => {
        if (key === "content") {
          return encodeBase64(value as Uint8Array);
        } else if (key === "route") {
          return (value as URLPattern).pathname;
        } else {
          return value;
        }
      }, "  "),
    );
  }

  async #loadAssets() {
    if (this.update === true || this.update === "true") {
      await this.updateAssets();
    } else {
      for (const [key, asset] of Object.entries(assetsFromJson)) {
        this.#assets[key] = {
          type: asset?.type,
          route: new URLPattern({ pathname: asset.route }),
          content: decodeBase64(asset.content),
        };
      }
    }
    if (this.#assets["/index.html"]) {
      const route = new URLPattern({ pathname: "/" });
      this.#assets["/"] = { ...this.#assets["/index.html"], route };
    }
  }
}

if (import.meta.main) {
  cliteRun(new StudioPackGeneratorGui());
}
