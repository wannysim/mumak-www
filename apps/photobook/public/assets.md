# Prototype assets

사진은 Unsplash 이미지 CDN에서 내려받은 로컬 테스트 자산이다. 아래 요청의 1200px 파생 JPEG를 그대로 저장했다. 네트워크 없이도 전시를 테스트할 수 있게 앱에서 로컬로 제공한다. 사용자 사진이 아니며 이 파생 이미지에 없는 EXIF를 생성하지 않는다.

| 파일                | 다운로드 원본                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------- |
| photos/meadow.jpg   | https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85 |
| photos/lake.jpg     | https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=85 |
| photos/forest.jpg   | https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=85 |
| photos/mountain.jpg | https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85 |
| photos/night.jpg    | https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=85 |
| photos/deer.jpg     | https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=85 |

디자인 초기화(2026-10-29) 이후 이 JPG들은 보존된 콘텐츠 자산이며 현재 화면에서는 사용하지 않는다. 임시 여우 SVG와 전용 서체는 제거했다.

## 표지 (covers/)

2026-11-18 사용자가 준 Meoru 명함 앞뒷면이다. 원본은 사용자의 Figma "Meoru Name Card"에서 내보낸 SVG(2228×4010, 5:9)이고, 둘 다 안에 PNG를 품고 있어 웹용으로 다시 만들었다.

| 파일              | 원본                                                                                                | 변환                                                                                                                                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| covers/front.webp | `Front 2.0.svg`(6MB): 주황 `#FF9738` 바탕 + 기울인 일러스트 PNG(3226×3717)                          | Chromium으로 1500×2700에 그린 뒤 `cwebp -q 90 -m 6 -sharp_yuv`(248KB). 무손실 렌더 대비 PSNR 39.5dB                                                                                                                                                                                               |
| covers/back.svg   | `Back 2.1.svg`(45KB): 보라 `#4614C4` 바탕 + QR PNG(392×392, `mix-blend-mode: screen`) + 윤곽선 글자 | QR을 41×41 모듈 벡터로 다시 그렸다(8px 모듈, 모든 모듈이 단색임을 확인). screen 합성 결과(흰 바탕 + 보라 모듈)를 그대로 칠해 blend mode를 없앴다. Chromium은 clip-path 그룹 안 blend를 격리해 검은 모듈로 그리고 WebKit은 보라로 그려 엔진마다 달랐다. 글자 path는 그대로 옮겼다(40KB, gzip 10KB) |

뒷면 QR은 `https://x.com/Meoru_butler`로 읽힌다(뒤에 그림용 `#` 조각이 붙는다). 원본과 변환본 모두 macOS CoreImage로 같은 주소가 읽히는 것을 확인했다.
