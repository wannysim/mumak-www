'use client';

import Image from 'next/image';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
import { Input } from '@mumak/ui/components/input';

import {
  formatBytes,
  libraryFolders,
  librarySummary,
  type ImageLibraryPage,
  type LibraryFile,
} from '@/src/entities/image/image-library';

const storedAtFormatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
});

function LibraryFileCard({ file }: { file: LibraryFile }) {
  const [message, setMessage] = React.useState('');
  const name = file.key.split('/').at(-1)!;
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(file.url);
      setMessage('주소를 복사했습니다.');
    } catch {
      setMessage('복사하지 못했습니다. 아래 주소를 직접 복사하세요.');
    }
  }
  return (
    <li className="min-w-0 space-y-3 rounded-lg border p-4">
      <a href={file.url} target="_blank" rel="noreferrer" aria-label={`${name} 새 창에서 보기`}>
        <Image
          unoptimized
          src={file.url}
          alt={name}
          width={320}
          height={200}
          loading="lazy"
          className="h-40 w-full rounded-md bg-muted object-contain"
        />
      </a>
      <p className="font-medium">{name}</p>
      <p className="text-sm text-muted-foreground">
        {formatBytes(file.bytes)} · {name.endsWith('.webp') ? 'WebP' : 'JPEG'}
      </p>
      {file.modifiedAt && (
        <p className="text-xs text-muted-foreground">
          저장: {storedAtFormatter.format(new Date(file.modifiedAt))} (KST)
        </p>
      )}
      <Input aria-label={`${name} 공개 주소`} value={file.url} readOnly />
      <Button type="button" variant="outline" onClick={copyUrl}>
        {name} 주소 복사
      </Button>
      <p role="status" className="text-xs text-muted-foreground">
        {message}
      </p>
    </li>
  );
}

export function ImageLibrary({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [page, setPage] = React.useState<ImageLibraryPage>({ files: [], cursor: null });
  const [request, setRequest] = React.useState<{ cursor?: string }>({});
  const [prefix, setPrefix] = React.useState('blog/');
  const [loading, setLoading] = React.useState(true);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const query = request.cursor ? `?${new URLSearchParams({ cursor: request.cursor })}` : '';
        const response = await fetch(`/api/images/library${query}`, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          onSessionExpired();
          return;
        }
        if (!response.ok) throw new Error('이미지 목록을 불러오지 못했습니다. 다시 시도하세요.');
        const next = (await response.json()) as ImageLibraryPage;
        if (controller.signal.aborted) return;
        setPage(previous => ({
          files: request.cursor
            ? Array.from(new Map([...previous.files, ...next.files].map(file => [file.key, file])).values())
            : next.files,
          cursor: next.cursor,
        }));
        setLoaded(true);
      } catch {
        if (!controller.signal.aborted) setError('이미지 목록을 불러오지 못했습니다. 다시 시도하세요.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [request, onSessionExpired]);

  const files = page.files.filter(file => file.key.startsWith(prefix));
  const folders = libraryFolders(page.files, prefix);
  const directFiles = files.filter(file => !file.key.slice(prefix.length).includes('/'));
  const summary = librarySummary(files);
  const segments = prefix.split('/').filter(Boolean);

  return (
    <section aria-labelledby="library-title" className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="library-title" className="text-lg font-semibold">
          이미지 보관함
        </h2>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => {
            setPrefix('blog/');
            setRequest({});
          }}
        >
          새로고침
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        이미지마다 폴더 하나에 JPEG·WebP 파일이 저장됩니다. 같은 이미지의 재업로드는 기존 폴더를 사용합니다.
      </p>
      <nav aria-label="이미지 폴더 경로" className="flex min-w-0 flex-wrap items-center gap-2">
        {segments.map((segment, index) => (
          <React.Fragment key={segment}>
            {index > 0 && <span aria-hidden="true">/</span>}
            <Button
              type="button"
              variant="ghost"
              className="max-w-full"
              title={segment}
              aria-current={index === segments.length - 1 ? 'location' : undefined}
              onClick={() => setPrefix(`${segments.slice(0, index + 1).join('/')}/`)}
            >
              <span className="truncate">{segment}</span>
            </Button>
          </React.Fragment>
        ))}
      </nav>
      {loaded && (
        <p className="text-sm">
          {summary.images}장 · {summary.files}개 파일 · {formatBytes(summary.bytes)}
          {page.cursor ? ' (불러온 기준)' : ''}
        </p>
      )}
      {loading && <p role="status">이미지 목록을 불러오는 중…</p>}
      {error && (
        <div role="alert" className="space-y-2">
          <p>{error}</p>
          <Button type="button" variant="outline" onClick={() => setRequest({ ...request })}>
            다시 시도
          </Button>
        </div>
      )}
      {loaded && !loading && !error && files.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          {page.cursor ? '아직 표시할 이미지가 없습니다. 더 불러와 주세요.' : '이 폴더에 저장된 이미지가 없습니다.'}
        </p>
      )}
      <ul aria-label="폴더와 이미지" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {folders.map(folder => (
          <li key={folder.prefix} className="min-w-0">
            <button
              type="button"
              className="w-full space-y-3 rounded-lg border p-4 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={`${folder.name} 폴더 열기`}
              onClick={() => setPrefix(folder.prefix)}
            >
              <Image
                unoptimized
                src={folder.preview}
                alt=""
                width={320}
                height={200}
                loading="lazy"
                className="h-32 w-full rounded-md bg-muted object-contain"
              />
              <span className="block truncate font-mono text-sm" title={folder.name}>
                {folder.name}/
              </span>
              <span className="block text-sm text-muted-foreground">
                {folder.images}장 · {folder.files}개 파일 · {formatBytes(folder.bytes)}
              </span>
            </button>
          </li>
        ))}
        {directFiles.map(file => (
          <LibraryFileCard key={file.key} file={file} />
        ))}
      </ul>
      {page.cursor && (
        <Button type="button" variant="outline" disabled={loading} onClick={() => setRequest({ cursor: page.cursor! })}>
          더 불러오기
        </Button>
      )}
    </section>
  );
}
