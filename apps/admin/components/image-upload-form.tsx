'use client';

import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
import { Checkbox } from '@mumak/ui/components/checkbox';
import { Input } from '@mumak/ui/components/input';
import { Label } from '@mumak/ui/components/label';
import { Textarea } from '@mumak/ui/components/textarea';

type UploadResult = {
  assetId: string;
  width: number;
  height: number;
  urls: { jpeg: string; webp: string };
};

function createSnippet(result: UploadResult, alt: string, decorative: boolean) {
  const escapedAlt = alt
    .trim()
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  const accessibility = decorative ? 'alt=""\n    role="presentation"\n    aria-hidden="true"' : `alt="${escapedAlt}"`;

  return `<picture>
  <source type="image/webp" srcSet="${result.urls.webp}" />
  <img
    src="${result.urls.jpeg}"
    ${accessibility}
    width="${result.width}"
    height="${result.height}"
    loading="lazy"
    decoding="async"
  />
</picture>`;
}

function ImageUploadForm() {
  const [file, setFile] = React.useState<File>();
  const [token, setToken] = React.useState('');
  const [alt, setAlt] = React.useState('');
  const [decorative, setDecorative] = React.useState(false);
  const [snippet, setSnippet] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [uploading, setUploading] = React.useState(false);

  const canUpload = Boolean(file && token && (decorative || alt.trim()));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !canUpload) return;

    setUploading(true);
    setMessage('업로드 중…');
    setSnippet('');

    try {
      const response = await fetch('/api/images', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: file,
      });
      const body = (await response.json()) as UploadResult & { error?: string };

      if (!response.ok) throw new Error(body.error || '이미지를 발행하지 못했습니다.');

      setSnippet(createSnippet(body, alt, decorative));
      setMessage('공개 URL 검증까지 완료했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '이미지를 발행하지 못했습니다.');
    } finally {
      setUploading(false);
    }
  }

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setMessage('MDX snippet을 복사했습니다.');
  }

  return (
    <form className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="image">JPEG 이미지</Label>
        <Input
          id="image"
          type="file"
          accept="image/jpeg,.jpg,.jpeg"
          required
          onChange={event => setFile(event.target.files?.[0])}
        />
        <p className="text-xs text-muted-foreground">최대 32 MiB, 50 MP. 원본 metadata는 제거됩니다.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="token">업로드 토큰</Label>
        <Input
          id="token"
          type="password"
          autoComplete="off"
          required
          value={token}
          onChange={event => setToken(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="alt">대체 텍스트</Label>
        <Input
          id="alt"
          disabled={decorative}
          required={!decorative}
          value={alt}
          onChange={event => setAlt(event.target.value)}
        />
        <div className="flex items-center gap-2">
          <Checkbox id="decorative" checked={decorative} onCheckedChange={checked => setDecorative(checked === true)} />
          <Label htmlFor="decorative">의미 없는 장식 이미지</Label>
        </div>
      </div>

      <Button className="w-full" type="submit" size="lg" disabled={!canUpload || uploading}>
        {uploading ? '발행 중…' : '이미지 발행'}
      </Button>

      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {message}
      </p>

      {snippet ? (
        <section className="space-y-2" aria-labelledby="snippet-title">
          <Label id="snippet-title" htmlFor="snippet">
            MDX snippet
          </Label>
          <Textarea id="snippet" readOnly rows={12} value={snippet} />
          <Button type="button" variant="outline" onClick={copySnippet}>
            snippet 복사
          </Button>
        </section>
      ) : null}
    </form>
  );
}

export { ImageUploadForm, createSnippet };
