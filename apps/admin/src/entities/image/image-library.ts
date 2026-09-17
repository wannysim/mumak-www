export type LibraryFile = {
  key: string;
  bytes: number;
  modifiedAt: string | null;
  url: string;
};

export type ImageLibraryPage = { files: LibraryFile[]; cursor: string | null };

export function librarySummary(files: LibraryFile[]) {
  return {
    images: new Set(files.map(file => file.key.split('/')[1])).size,
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  };
}

export function libraryFolders(files: LibraryFile[], prefix: string) {
  const folders = new Map<string, LibraryFile[]>();
  for (const file of files) {
    if (!file.key.startsWith(prefix)) continue;
    const remaining = file.key.slice(prefix.length);
    if (!remaining.includes('/')) continue;
    const name = remaining.split('/')[0]!;
    const children = folders.get(name) ?? [];
    children.push(file);
    folders.set(name, children);
  }
  return Array.from(folders, ([name, children]) => ({
    name,
    prefix: `${prefix}${name}/`,
    preview: children[0]!.url,
    ...librarySummary(children),
  }));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
