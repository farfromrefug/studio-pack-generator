import {
  File,
  Folder,
  Menu,
  Metadata,
  Pack,
  Story,
  StoryItem,
  ZipMenu,
} from "./types.ts";
import {
  cleanStageName,
  firstStoryFile,
  getExtension,
  getFileAudioItem,
  getFileAudioStory,
  getFileImageItem,
  getFolderAudioItem,
  getFolderImageItem,
  isFolder,
  isStory,
  isZipFile,
} from "../utils/utils.ts";

export function folderToPack(folder: Folder, metadata?: Metadata): Pack {
  const firstSubFolder = folder.files.find((f) => isFolder(f)) as Folder;
  return {
    title: metadata?.title ?? folder.name,
    description: metadata?.description ?? "",
    format: metadata?.format ?? "v1",
    version: metadata?.version ?? 1,
    nightModeAvailable: !!(metadata?.nightMode),
    entrypoint: {
      class: "StageNode-Entrypoint",
      name: "Cover node",
      image: getFolderImageItem(folder),
      audio: getFolderAudioItem(folder),
      okTransition: {
        class: "ActionNode",
        name: "Action node",
        options: [
          firstSubFolder
            ? folderToMenu(firstSubFolder, "")
            : fileToStory(firstStoryFile(folder)!),
        ],
      },
    },
  };
}

export function folderToMenu(folder: Folder, path: string): Menu {
  return {
    class: "StageNode-Menu",
    image: getFolderImageItem(folder),
    audio: getFolderAudioItem(folder),
    name: folder.name,
    okTransition: {
      class: "ActionNode",
      name: folder.name,
      options: folder.files
        .map((f) =>
          isFolder(f)
            ? folderToMenu(f as Folder, path + "/" + f.name)
            : isStory(f as File)
            ? fileToStoryItem(f as File, folder)
            : isZipFile(f as File)
            ? fileToZipMenu(`${path}/${folder.name}/${f.name}`)
            : null
        )
        .filter((f) => f) as (Menu | ZipMenu | StoryItem)[],
    },
  };
}

export function fileToZipMenu(path: string): ZipMenu {
  return {
    class: "ZipMenu",
    path: path,
  };
}

export function fileToStoryItem(file: File, parent: Folder): StoryItem {
  return {
    class: "StageNode-StoryItem",
    name: cleanStageName(file.name),
    audio: getFileAudioItem(file, parent),
    image: getFileImageItem(file, parent),
    okTransition: {
      name: cleanStageName(file.name),
      class: "ActionNode",
      options: [
        {
          class: "StageNode-Story",
          audio: getFileAudioStory(file),
          image: null,
          name: cleanStageName(file.name),
          okTransition: null,
        },
      ],
    },
  };
}

export function fileToStory(file: File): Story {
  return {
    class: "StageNode-Story",
    audio: `${file.sha1}.${getExtension(file.name)}`,
    image: null,
    name: cleanStageName(file.name),
    okTransition: null,
  };
}
