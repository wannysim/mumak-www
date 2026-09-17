'use client';

import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
import { Checkbox } from '@mumak/ui/components/checkbox';
import { Field, FieldLabel, FieldLegend, FieldSet } from '@mumak/ui/components/field';
import { Input } from '@mumak/ui/components/input';
import { Label } from '@mumak/ui/components/label';
import { RadioGroup, RadioGroupItem } from '@mumak/ui/components/radio-group';
import { Textarea } from '@mumak/ui/components/textarea';

import {
  createSnippet,
  NEXT_IMAGE_REMOTE_PATTERN,
  SNIPPET_FORMATS,
  type SnippetFormat,
} from '@/src/entities/image/create-snippet';
import type { PublishedImage } from '@/src/entities/image/published-image';
import { publishImage, SessionExpiredError } from '@/src/features/image-upload/api/publish-image';

function ImageUploadForm({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [file, setFile] = React.useState<File>();
  const [alt, setAlt] = React.useState('');
  const [decorative, setDecorative] = React.useState(false);
  const [publishedImage, setPublishedImage] = React.useState<PublishedImage>();
  const [format, setFormat] = React.useState<SnippetFormat>('react');
  const [message, setMessage] = React.useState('');
  const [uploading, setUploading] = React.useState(false);

  const canUpload = Boolean(file && (decorative || alt.trim()));
  const selectedFormat = SNIPPET_FORMATS.find(option => option.value === format)!;
  const snippet = publishedImage ? createSnippet(publishedImage, alt, decorative, format) : '';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !canUpload) return;

    setUploading(true);
    setMessage('업로드 중…');
    setPublishedImage(undefined);

    try {
      const result = await publishImage(file, setMessage);
      setPublishedImage(result);
      setMessage('공개 URL 검증까지 완료했습니다.');
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : '이미지를 발행하지 못했습니다.');
    } finally {
      setUploading(false);
    }
  }

  async function copySnippet(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label}을 복사했습니다.`);
    } catch {
      setMessage('복사하지 못했습니다. 코드를 직접 선택해 복사하세요.');
    }
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
          disabled={uploading}
          onChange={event => {
            setFile(event.target.files?.[0]);
            setPublishedImage(undefined);
          }}
        />
        <p className="text-xs text-muted-foreground">최대 32 MiB, 50 MP. 원본 metadata는 제거됩니다.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="alt">대체 텍스트</Label>
        <Input
          id="alt"
          disabled={decorative || uploading}
          required={!decorative}
          value={alt}
          onChange={event => setAlt(event.target.value)}
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="decorative"
            disabled={uploading}
            checked={decorative}
            onCheckedChange={checked => setDecorative(checked === true)}
          />
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
        <section className="flex flex-col gap-4" aria-labelledby="snippet-title">
          <FieldSet>
            <FieldLegend variant="label">스니펫 형식</FieldLegend>
            <RadioGroup
              aria-label="스니펫 형식"
              value={format}
              className="grid-cols-2"
              onValueChange={value => {
                const option = SNIPPET_FORMATS.find(option => option.value === value);
                if (option) setFormat(option.value);
                setMessage('');
              }}
            >
              {SNIPPET_FORMATS.map(option => (
                <Field key={option.value} orientation="horizontal">
                  <RadioGroupItem value={option.value} id={`format-${option.value}`} />
                  <FieldLabel htmlFor={`format-${option.value}`}>{option.label}</FieldLabel>
                </Field>
              ))}
            </RadioGroup>
          </FieldSet>
          <p id="snippet-help" className="text-sm text-muted-foreground">
            {selectedFormat.description}
          </p>
          <Label id="snippet-title" htmlFor="snippet">
            {selectedFormat.label} snippet
          </Label>
          <Textarea id="snippet" aria-describedby="snippet-help" readOnly rows={12} value={snippet} />
          <Button
            type="button"
            variant="outline"
            disabled={!decorative && !alt.trim()}
            onClick={() => copySnippet(snippet, `${selectedFormat.label} snippet`)}
          >
            snippet 복사
          </Button>
          {format === 'next' && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                next.config의 images.remotePatterns 배열에 아래 항목을 추가하세요.
              </p>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                <code>{NEXT_IMAGE_REMOTE_PATTERN}</code>
              </pre>
              <Button
                type="button"
                variant="outline"
                onClick={() => copySnippet(NEXT_IMAGE_REMOTE_PATTERN, '도메인 설정')}
              >
                도메인 설정 복사
              </Button>
            </div>
          )}
        </section>
      ) : null}
    </form>
  );
}

export { ImageUploadForm };
