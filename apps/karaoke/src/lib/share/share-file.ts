import { serializeKaraokeShareBundle, type KaraokeShareBundle } from '@/lib/share/bundle';

type ShareFileFormat = 'json' | 'text';

function createShareFile(content: string, format: ShareFileFormat = 'json'): File {
  const isJson = format === 'json';
  return new File([content], `karaoke-share-${new Date().toISOString().slice(0, 10)}.${isJson ? 'json' : 'txt'}`, {
    type: isJson ? 'application/json' : 'text/plain',
  });
}

// Source: https://www.w3.org/TR/web-share/#sharing-a-file
// canShare()는 파일 형식을 검증하지 않는다(Chrome은 share() 시점에 브라우저 프로세스의
// 확장자 safelist로 걸러 .json을 프롬프트 없이 NotAllowedError "Permission denied"로
// 거부한다). 형식 탐지가 불가능하므로 기기 공유는 safelist에 있는 .txt(text/plain)로 고정한다.
export function supportedShareFileFormat(): ShareFileFormat | null {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function'
  ) {
    return null;
  }
  try {
    return navigator.canShare({ files: [createShareFile('{}', 'text')] }) ? 'text' : null;
  } catch {
    return null;
  }
}

export function downloadShareFile(bundle: KaraokeShareBundle): void {
  const file = createShareFile(serializeKaraokeShareBundle(bundle));
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** 사용자가 취소한 경우(AbortError)에만 조용히 넘어간다. 나머지는 호출자가 문구로 바꾼다. */
export async function shareBundleToDevice(bundle: KaraokeShareBundle, format: ShareFileFormat): Promise<void> {
  const file = createShareFile(serializeKaraokeShareBundle(bundle), format);
  if (
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function' ||
    !navigator.canShare({ files: [file] })
  ) {
    throw new Error('이 공유 파일은 기기로 바로 보낼 수 없습니다. 공유 파일 저장을 이용해 주세요.');
  }
  await navigator.share({ title: 'MUMAK Karaoke 공유', files: [file] });
}
