import { ImageUploadForm } from '@/components/image-upload-form';

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-8 px-5 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Private operator tool</p>
        <h1 className="text-3xl font-semibold tracking-tight">블로그 이미지 발행</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          JPEG 한 장을 검증하고 불변 JPEG/WebP 주소와 MDX snippet을 만듭니다.
        </p>
      </header>
      <ImageUploadForm />
    </main>
  );
}
