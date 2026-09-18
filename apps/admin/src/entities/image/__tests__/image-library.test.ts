import { formatBytes, libraryFolders, librarySummary } from '../image-library';

it('counts unique assets, sums storage, and ignores files outside the selected folder', () => {
  const files = [
    { key: 'blog/a/content-v1/image.jpg', bytes: 1024, url: 'jpeg', modifiedAt: null },
    { key: 'blog/a/content-v1/image.webp', bytes: 512, url: 'webp', modifiedAt: null },
    { key: 'blog/b/content-v1/image.jpg', bytes: 1048576, url: 'other', modifiedAt: null },
  ];
  expect(librarySummary(files)).toEqual({ images: 2, files: 3, bytes: 1050112 });
  expect(libraryFolders(files, 'blog/a/')).toEqual([
    { name: 'content-v1', prefix: 'blog/a/content-v1/', preview: 'jpeg', images: 1, files: 2, bytes: 1536 },
  ]);
  expect(libraryFolders(files, 'blog/a/content-v1/')).toEqual([]);
  expect([0, 512, 1024, 1048576].map(formatBytes)).toEqual(['0 B', '512 B', '1.0 KiB', '1.0 MiB']);
});
