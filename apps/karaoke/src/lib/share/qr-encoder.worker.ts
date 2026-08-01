import { encodeQrBatch, type QrEncodeRequest, type QrEncodeResponse } from '@/lib/share/qr-matrix';

/**
 * 이 앱의 tsconfig `lib`에는 DOM만 있다. `/// <reference lib="webworker" />`를 넣으면
 * `navigator`가 전역에서 `WorkerNavigator`로 덮여 카메라 코드(`navigator.mediaDevices`)가 깨지므로,
 * 배관이 실제로 쓰는 두 멤버만 모듈 스코프로 좁혀 선언한다.
 */
declare const self: {
  addEventListener: (type: 'message', listener: (event: MessageEvent<QrEncodeRequest>) => void) => void;
  postMessage: (message: QrEncodeResponse, transfer: ArrayBufferLike[]) => void;
};

self.addEventListener('message', event => {
  const response = encodeQrBatch(event.data);
  // 비트버퍼는 transfer로 넘긴다(zero-copy). 이 시점부터 워커 쪽 참조는 detach된다.
  self.postMessage(
    response,
    response.bits.map(bits => bits.buffer)
  );
});
