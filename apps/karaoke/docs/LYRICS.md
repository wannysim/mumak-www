# 가사 만드는 법

곡 하나에 필요한 건 `public/lyrics/<slug>.json` 하나다. 형식:

```json
[{ "time": 12.3, "jp": "君を握った", "pron": "키미오 니깃타", "ko": "너를 붙잡았어" }]
```

`time`은 초 단위이고 **곡 안에서 순증가해야 한다**. 앱의 `currentLineIndex`가 정렬을
전제로 `findLastIndex`를 쓰기 때문에, 시간이 뒤로 가면 엉뚱한 줄이 하이라이트된다.

가사 원문은 저작물이라 `public/lyrics/`는 gitignore다. 커밋되지 않으니 각자 만들어야 하고,
그래서 이 문서가 있다.

---

## 경로 1 — lrclib에 싱크 가사가 있는 경우 (대부분)

[lrclib](https://lrclib.net)은 타임스탬프가 붙은 LRC를 공개로 제공한다. 9곡 중 9곡이
여기서 나왔다.

```bash
python3 scripts/fetch-lyrics.py <slug>            # 확인만 (stdout)
python3 scripts/fetch-lyrics.py <slug> --write    # public/lyrics/<slug>.json 저장
```

`jp`와 `time`이 채워지고 `pron`·`ko`는 빈 문자열로 남는다. 그 둘은 사람이나 에이전트가
채운다. 에이전트에게 맡길 때는 **time과 jp를 바꾸지 말 것, 줄 수와 순서를 유지할 것**을
명시해야 한다. 안 그러면 슬쩍 줄을 합치거나 늘린다.

마지막으로 검증한다:

```bash
python3 scripts/check-lyrics.py
```

### 여기서 두 번 데였다

**제목 표기가 갈린다.** lrclib은 등록자가 붙인 이름을 쓴다. 「タイムパラドックス」는
로마자 `Time Paradox`로만 올라와 있어서, 원제로만 검색했을 때 "싱크 가사 없음"으로
잘못 결론 냈었다. 스크립트가 원제 · 아티스트 조합 · 자유 검색을 모두 시도하는 이유다.
그래도 안 나오면 `--title`로 다른 표기를 직접 넣어 본다.

```bash
python3 scripts/fetch-lyrics.py time-paradox --title "Time Paradox" --write
```

**길이가 맞아야 싱크가 맞는다.** 같은 곡도 MV · 앨범 · 리레코딩 버전이 섞여 있고 각각
타임스탬프가 다르다. 스크립트는 실제로 재생할 `videoId`의 길이를 YouTube에서 읽어
가장 가까운 후보를 고르고, 차이가 2초를 넘으면 경고한다. 경고가 뜨면 들어 보고 판단해라.

같은 이유로 **곡 파일의 `videoId`는 MV가 아니라 공식 오디오(`Vaundy - Topic` 채널)여야
한다.** MV는 인트로·연출 때문에 원곡과 어긋난다.

---

## 경로 2 — 싱크 가사가 없는 경우: 앱의 싱크 편집 모드

컨트롤 줄의 타이머 아이콘을 누르면 열린다.

1. 가사를 한 줄에 한 소절씩 `日本語 | 발음 | 번역` 형식으로 붙여 넣는다.
   구분자 `|`는 생략 가능하고, 없으면 발음·번역이 빈 값이 된다.
2. 노래를 재생하고, 화면에 뜨는 "다음: ○○○" 줄이 **실제로 시작되는 순간** "지금!"을 누른다.
3. 잘못 눌렀으면 되돌리기 버튼으로 마지막 스탬프만 취소한다.
4. 다 끝나면 복사 버튼 → 클립보드의 JSON을 `public/lyrics/<slug>.json`으로 저장한다.
5. `python3 scripts/check-lyrics.py`로 검증한다.

발음·번역을 먼저 채워 두고 시작하면 탭에만 집중할 수 있다. 반대로 일본어만 붙여 넣고
타이밍을 먼저 찍은 뒤 나머지를 채워도 된다.

---

## 새 곡 추가하기

1. `src/songs/<slug>.ts`를 만든다. `videoId`는 **공식 오디오** 영상으로.

   ```ts
   import type { Song } from './index';

   export const someSong: Song = {
     slug: 'some-song',
     titleJa: '原題',
     titleKo: '한국어 제목',
     videoId: 'xxxxxxxxxxx',
   };
   ```

2. `src/songs/index.ts`의 import와 `songs` 배열에 추가한다. 배열 순서가 곡 목록과
   이전/다음 순환 순서다.
3. 위 경로 1 또는 2로 가사를 만든다.

`videoId`가 공식 오디오인지 확인하려면:

```bash
curl -s "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<ID>&format=json" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["title"], "|", d["author_name"])'
```

`author_name`이 `Vaundy - Topic`이면 공식 오디오다.

---

## 폰에서 보려면

`public/lyrics/`는 커밋되지 않으므로, 빌드해서 배포해도 가사는 따라가지 않는다.
가사를 포함해 내보내려면 빌드 산출물(`dist/lyrics/`)을 직접 챙겨야 하고, 저작물이라
공개 범위를 먼저 정해야 한다. 아직 정해진 배포 경로가 없다.

한 번이라도 접속하면 서비스워커가 가사를 캐시하므로 그 뒤에는 오프라인에서도 열린다
(재생은 네트워크 필요).
