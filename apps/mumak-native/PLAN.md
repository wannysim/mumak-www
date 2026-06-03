# mumak-native 템플릿 견고화 계획

본격 앱 개발에 앞서 `apps/mumak-native/`를 **"폴더만 복사하면 바로 새 앱을 시작할 수 있는 템플릿"** 으로 마감하기 위한 실행 계획 및 도입 런북.

- 작성일: 2026-06-04
- 브랜치: `chore/mumak-native-template-hardening` (base: `develop`)
- 범위: `apps/mumak-native/` 한정. 워크스페이스 루트 파일(`.github/**`, `dependabot.yml`)은 "별도 PR"로 표기.
- 지식 기준일 주의: 본 문서의 EAS 스캐폴드(C그룹)는 작성 시점 지식 기반. **도입 시점에 `eas build:configure` 산출물 + 최신 Expo 공식 문서로 정확한 키/문법 재검증** 후 사용.

## 0. 그룹 정의 (실행 시점)

| 그룹  | 성격                                       | 실행 시점                                          |
| ----- | ------------------------------------------ | -------------------------------------------------- |
| **A** | 즉시·안전 (되돌리기 쉬움, 무논쟁)          | **이 브랜치에서 바로**                             |
| **B** | 템플릿 마감 (데모 정리·테스트·복제 친화성) | 방향 확정 후, 이 브랜치 또는 후속                  |
| **C** | EAS 빌드·배포 **도입 런북**                | 첫 내부 테스트(TestFlight/Play Internal) 착수 시점 |
| 보류  | 진짜 나중 / 범위 밖                        | 트리거 발생 시                                     |

> A/B는 "템플릿 자체"를 다듬는 작업이고, C는 "복제한 앱을 실제로 빌드·배포할 때 그대로 따라 하는 절차서"다. C는 지금 파일을 만들지 않고 문서로만 준비한다(실 자격증명·스토어 계정이 전제라 선행 생성은 무의미·위험).

---

## 1. 점검 스냅샷 (실측)

| 단계                               | 결과          | 비고                                                                |
| ---------------------------------- | ------------- | ------------------------------------------------------------------- |
| `check-types` (`tsc --noEmit`)     | 통과          | 깨끗                                                                |
| `lint` (`oxlint .`)                | 통과          | 0 warnings / 0 errors, 23 files, 160 rules                          |
| `test:ci` (`jest --ci --coverage`) | 통과          | `__tests__/smoke.test.ts`의 `1+1=2` 1개뿐 (실 컴포넌트 커버리지 0%) |
| `format:check` (`oxfmt --check .`) | **로컬 실패** | `coverage/` 생성물(.js/.css) 검사 → [A-1]                           |

구조·컨벤션 자체는 양호(Expo 표준 디렉터리, named export, `React.ComponentProps` 패턴 준수). 핵심 이슈는 **로컬 검증 깨짐 1건 + 문서 drift + 템플릿 마감 미완** 세 가지.

핵심 버전 사실(실측):

- 실제: **Expo SDK 56**, **React Native 0.85.3**, **React 19.2.3**, **jest 29.7.0** (jest-expo lock-step), TypeScript 6.0.3.
- 문서 표기: README/AGENTS/jest 주석이 **SDK 54 / RN 0.81 / jest 30**으로 어긋남 → [A-3].

---

## 2. A그룹 — 즉시 처리 (안전·무논쟁)

### [A-1] `format:check` 로컬 실패 수정 — `.gitignore`에 산출물 추가

- **증상**: 테스트를 한 번이라도 돌려 `coverage/`가 생기면 그 다음 `format:check`(= `ci-preflight`)가 빨갛게 됨.
- **근본 원인**: oxfmt는 **cwd의 로컬 `.gitignore`만** 존중. `apps/mumak-native/.gitignore`에 `coverage`/`.turbo`가 없음. 루트 `.oxfmtrc.jsonc`의 `ignorePatterns: ["coverage/**", ...]`는 **루트 기준 경로**라 `apps/mumak-native/coverage/`를 못 거름. `apps/blog/.gitignore`에는 `/coverage`가 있어 회피 중 — mumak-native만 누락.
- **CI가 초록인 이유**: CI는 `quality(format:check)`가 `test:ci`보다 먼저 실행돼 coverage가 아직 없음 → 우연히 가려진 함정. 템플릿에 그대로 남으면 복제 앱마다 상속.
- **변경**: `apps/mumak-native/.gitignore` 끝에 추가
  ```gitignore
  # test infra artifacts (oxfmt가 로컬 .gitignore만 존중 → format:check가 coverage 검사 방지)
  /coverage
  .turbo/
  ```
- **검증**(이미 1회 재현·수정 통과 확인함): `pnpm --filter mumak-native test:ci` 후 `pnpm --filter mumak-native format:check` → "All matched files use the correct format".
- **리스크/롤백**: 사실상 0. `.gitignore` 한 줄, 추적 파일 영향 없음.
- [ ] 완료

### [A-2] `test:ci`에서 `--passWithNoTests` 제거

- **이유**: jest 이슈 해소로 실제 테스트가 도는데도 플래그가 남아, 향후 테스트가 0개로 회귀해도 CI가 못 잡음(무방비 통과).
- **변경**: `apps/mumak-native/package.json`
  ```diff
  -    "test:ci": "jest --ci --coverage --passWithNoTests",
  +    "test:ci": "jest --ci --coverage",
  ```
- **전제**: 스모크 테스트가 있어 A그룹만으로도 통과. B-2에서 baseline 테스트로 보강.
- **검증**: `pnpm --filter mumak-native test:ci` 통과.
- [ ] 완료

### [A-3] 문서 drift 일괄 정정

이미 적용된 변경이 문서에 반영 안 돼, 다음 작업자가 "이미 해결된 문제"를 재작업할 위험.

| 파일                        | 현재(stale)                                              | 정정                                                                    |
| --------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `README.md` L3              | "Expo **SDK 54** + expo-router 기반"                     | "Expo **SDK 56** + expo-router 기반"                                    |
| `README.md` 기술스택 표     | "Expo **SDK 54** (React Native **0.81**)"                | "Expo **SDK 56** (React Native **0.85**)"                               |
| `README.md` "개발 환경"     | Node/Xcode/JDK 버전                                      | 실제 `engines`/EAS 이미지 기준과 대조 후 갱신                           |
| `jest.config.mjs` L1–6 주석 | "jest **30** incompatibility … `--passWithNoTests`"      | jest 29 해소 반영, 주석 축약(배경 1–2줄만)                              |
| `jest.setup.ts` L1 주석     | "jest-expo **SDK 54** + jest **30**"                     | "jest-expo **SDK 56** + jest **29**"                                    |
| `AGENTS.md` 테스트 섹션     | "미해결 / 해소방법 확정 / `--passWithNoTests`로 통과 중" | **"jest 29 다운그레이드로 해소됨"** + 원인분석은 "히스토리"로 압축 보존 |

- **원인분석 보존 이유**: 다음 Expo SDK bump 때 jest-expo가 jest 30을 지원하는지 재평가하는 단서가 됨 → 삭제하지 말고 "해결됨(배경)" 형태로 축약.
- **검증**: 육안 정합성 + `pnpm --filter mumak-native format:check`.
- [ ] 완료

---

## 3. B그룹 — 템플릿 마감 (방향 확정 후)

### [B-1] Stock 데모 잔재 정리 (권장: 진행)

`create-expo-app --template default` 데모가 그대로라 "삭 복사용 템플릿"의 최대 노이즈. README가 G1–G6로 참조 그래프를 정확히 매핑해 둠. 아래는 **실제 파일 재확인** 반영.

**삭제 대상**

- G1 자산: `assets/images/{react-logo.png, react-logo@2x.png, react-logo@3x.png, partial-react-logo.png}`
- G2 컴포넌트: `components/{hello-wave.tsx, parallax-scroll-view.tsx, external-link.tsx}`, `components/ui/{collapsible.tsx, icon-symbol.ios.tsx}`
- G6 스크립트: `scripts/reset-project.js` + `package.json`의 `scripts.reset-project`
  - 주의: `reset-project.js`는 `app/`·`components/`·`hooks/`·`constants/`·`scripts/`를 통째로 옮기는 **파괴적** 스크립트. 직접 실행 금지, 파일째 제거.

**교체 대상 (placeholder 재작성, 라우팅 골격 유지)**

- `app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx`: `ThemedView`+`ThemedText` 기반 최소 placeholder. 다크모드 토대가 동작함을 그대로 증명. 예시:

  ```tsx
  import { StyleSheet } from 'react-native';

  import { ThemedText } from '@/components/themed-text';
  import { ThemedView } from '@/components/themed-view';

  export default function HomeScreen() {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Home</ThemedText>
        <ThemedText>Edit app/(tabs)/index.tsx to get started.</ThemedText>
      </ThemedView>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  });
  ```

- `app/modal.tsx`: **삭제**. 동시에 `app/_layout.tsx` **L19**의 `<Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />` 등록도 함께 제거.
  - **실측 정정**: README는 "modal이 `_layout.tsx`에 미등록"이라 했으나 **실제로는 L19에 등록돼 있음**. 삭제 시 등록 라인 동반 제거 필수(안 그러면 expo-router가 없는 라우트를 참조).
  - 단, modal presentation은 흔한 패턴 → "예시로 남길지" 1줄 결정 포인트. 기본 권장: 제거(최소 골격), 필요 시 재도입.

**보존 (G4 — 다크모드 토대, 재활용 가치 높음)**

- `components/{themed-text, themed-view, haptic-tab}.tsx`, `components/ui/icon-symbol.tsx`
- `hooks/{use-color-scheme.ts, use-color-scheme.web.ts, use-theme-color.ts}`
- `constants/theme.ts`
- 앱 아이콘/스플래시(G5): `assets/images/{icon, splash-icon, favicon, android-icon-*}.png` — `app.json` 직접 참조, 보존.

**주의**

- `*.web.ts`/`*.ios.tsx`는 Metro platform resolver가 자동 선택 → knip이 unused로 오탐. **knip 자동 삭제 금지.**
- placeholder 교체 후 typed routes 캐시(`.expo/types/router.d.ts`) stale 가능 → `pnpm --filter mumak-native clean` 권장.

**검증/롤백**: 각 단계 후 `check-types && lint && format:check`, 가능하면 `expo start` 부팅 1회. 롤백은 git revert(파일 삭제라 추적 가능).

- [ ] G1 자산 삭제 [ ] G2 컴포넌트 삭제 [ ] G3 placeholder + modal 제거(+ `_layout.tsx` 등록 제거) [ ] G6 제거

### [B-2] 토대 컴포넌트 baseline 테스트

- **목적**: 복제 즉시 "테스트 인프라 동작" 증명 + 토대 컴포넌트 회귀 방지. 스모크 1개는 인프라 증명으로 부족.
- **대상(colocate `__tests__/`)**: `themed-text`(type별 스타일 적용), `themed-view`(테마 배경색), `use-theme-color`(light/dark 분기), `icon-symbol`(SF→Material 매핑 `MAPPING`).
- **컨벤션**: 접근성 selector(`getByText`/`getByRole`) 우선, `@testing-library/react-native`. 새 native module 사용 시 `jest.setup.ts` mock 확장.
- **검증**: `pnpm --filter mumak-native test:ci` 통과 후, 측정치 기준 coverage threshold baseline 도입 검토(점진 상향, blog 패턴).
- [ ] 완료

### [B-3] 복제 친화성 보강

- **app.json placeholder/체크리스트**: `name`/`slug`/`scheme`가 `mumak-native`/`mumaknative` 하드코딩 → 복제마다 수동 변경. 권장: **현행 값 유지 + README 상단 "복제 후 바꿀 값" 체크리스트** (Expo가 placeholder 토큰에 민감할 수 있어 동작값 유지가 안전). 바꿀 항목: `app.json`의 `name`·`slug`·`scheme`·iOS `bundleIdentifier`(미설정)·Android `package`(미설정), `package.json`의 `name`·`version`.
- **버전 정합성**: `package.json` `1.6.2` vs `app.json` `1.0.0` 불일치. 복제 시 `package.json`이 1.6.2 상속(릴리즈 툴링 부산물 추정). 템플릿 기준값(예: `0.1.0`)으로 양쪽 정렬 검토.
- **`.env.example` 추가**(추적 대상):
  ```dotenv
  # 클라이언트 번들에 inline되는 공개 값만 EXPO_PUBLIC_ 접두어 사용
  # 시크릿(API key 등)은 여기에 넣지 말 것 → EAS env(C-3) 경유
  # EXPO_PUBLIC_API_BASE_URL=
  ```
  `.gitignore`의 `.env*.local`과 충돌 없음(`.env.example`은 추적됨) 확인.
- **secret `.gitignore` 패턴 선제 추가**(Firebase 등 대비):
  ```gitignore
  google-services.json
  GoogleService-Info.plist
  ```
  현재 Expo 기본 `.gitignore`는 `*.jks`/`*.p8`/`*.p12`/`*.key`/`*.mobileprovision`만 커버.
- **`@mumak/shared` 배선 증명**: 의존성 선언만 있고 실제 import 0건. 권장: placeholder 화면에 예시 import 1줄(예: 공유 util/type)로 모노레포 배선이 살아있음을 증명. (대안: 현행 유지, 첫 공유 로직 사용 시 자연 연결.)
- **검증**: `check-types && lint && format:check`.
- [ ] 완료

---

## 4. C그룹 — EAS 빌드·배포 인프라 (도입 런북)

> 트리거: 첫 내부 테스트 배포(iOS TestFlight / Android Play Internal Testing) 착수. 그 전까지는 **문서로만 준비**. 실 자격증명·스토어 계정·Apple/Google 멤버십이 전제다.

### C-0 전제 / 사전 준비

- Expo 계정 + 조직, EAS 프로젝트 연결(`eas init` → `app.json`에 `extra.eas.projectId`·`owner` 기록).
- Apple Developer Program(iOS), Google Play Console + 결제(Android).
- `eas-cli` 설치(전역 또는 `pnpm dlx eas-cli`), `eas login`.
- 시작점: `cd apps/mumak-native && eas build:configure` → `eas.json` 생성 + `app.json`에 projectId 주입.

### C-1 `eas.json` 빌드 프로파일 (스캐폴드)

`apps/mumak-native/eas.json` (도입 시 `eas build:configure` 산출물에 맞춰 조정):

```jsonc
{
  "cli": {
    "version": ">= 16.0.0", // 도입 시 설치된 eas-cli 버전으로
    "appVersionSource": "remote", // 빌드 번호를 EAS가 원격 관리(권장). local이면 app.json 수동 관리
    "requireCommit": true, // 더티 트리 빌드 방지(모노레포 재현성)
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
    },
    "preview": {
      "distribution": "internal", // TestFlight 외 ad-hoc/내부 배포
      "channel": "preview",
    },
    "production": {
      "channel": "production",
      "autoIncrement": true, // 빌드 번호 자동 증가
    },
  },
  "submit": {
    "production": {
      "ios": { "appleId": "...", "ascAppId": "...", "appleTeamId": "..." },
      "android": { "serviceAccountKeyPath": "../path/to/play-service-account.json", "track": "internal" },
    },
  },
}
```

- 프로파일 3종: `development`(dev client), `preview`(QA 내부 배포), `production`(스토어).
- `channel`은 EAS Update 채널과 1:1로 묶어 빌드↔OTA 정합성 유지(C-7).
- **검증**: 키/문법은 도입 시 `eas build:configure` 출력 및 공식 문서로 재확인.

### C-2 자격증명 (Credentials)

- **권장: EAS 원격 관리("Let EAS handle it")**. 로컬 키 파일 관리 부담 제거.
  - iOS: Distribution Certificate + Provisioning Profile(EAS 생성/저장). 푸시 쓰면 APNs Key(.p8).
  - Android: Upload Keystore(EAS 생성/저장). 분실 시 복구 불가하므로 **EAS 관리 + 백업**.
- 조회/수정: `eas credentials`. 자격증명 파일은 **절대 커밋 금지**(`.gitignore`가 `*.jks`/`*.p8`/`*.p12` 커버, B-3에서 Firebase 패턴 보강).

### C-3 환경변수 / 시크릿

- **공개값**: `EXPO_PUBLIC_*` → 빌드 시 번들에 inline. 시크릿 아님. `.env`/`.env.example`로 관리.
- **시크릿**: EAS Environment Variables(프로젝트 스코프, visibility `sensitive`/`secret`)로 관리. 설정: `eas env:create` 또는 대시보드. 빌드 프로파일별 환경 분리(`development`/`preview`/`production`).
- **CI 토큰**: 비대화형 빌드(C-5)용 `EXPO_TOKEN`(Robot Access Token). GitHub Actions Secret 또는 EAS 환경에 보관.
- 원칙: 시크릿을 `EXPO_PUBLIC_*`나 `app.json`/저장소에 박지 말 것.

### C-4 버전 / 런타임 버전 정책

- **사용자 버전**: `app.json`의 `version`(예: 1.0.0). 빌드 번호(iOS `buildNumber`/Android `versionCode`)는 `appVersionSource: "remote"` + `autoIncrement`로 EAS가 관리.
- **런타임 버전(EAS Update 호환 게이팅)**: `app.json`에 정책 지정. SDK 52+ 권장값:

  ```json
  "runtimeVersion": { "policy": "fingerprint" }
  ```

  - `fingerprint`: 네이티브 의존성 변경을 해시로 감지해 호환 OTA만 매칭(가장 안전). 대안 `appVersion`(버전 문자열 기준).

- 네이티브 모듈 추가/제거 시 런타임 버전이 바뀌어야 구버전 앱에 비호환 JS가 푸시되는 사고를 막음.

### C-5 CI: 빌드 자동화 (옵션 2택)

기존 `.github/workflows/ci.yml`은 **코드 품질(lint/types/test)만** 담당. 네이티브 빌드/제출은 별도 트랙으로 분리한다.

**옵션 A (권장): EAS Workflows** — `apps/mumak-native/.eas/workflows/*.yml`. Expo 인프라에서 build/submit/update를 선언적으로 실행, 유지보수 YAML 최소.

```yaml
# .eas/workflows/build-and-submit.yml  (문법은 도입 시 공식 문서로 검증)
name: Build and submit (production)
on:
  push:
    branches: ['main']
jobs:
  build_ios:
    type: build
    params: { platform: ios, profile: production }
  build_android:
    type: build
    params: { platform: android, profile: production }
  submit_ios:
    needs: [build_ios]
    type: submit
    params: { platform: ios, profile: production }
  submit_android:
    needs: [build_android]
    type: submit
    params: { platform: android, profile: production }
```

실행: `eas workflow:run build-and-submit.yml` 또는 트리거 브랜치 push.

**옵션 B (대안): GitHub Actions** — 기존 CI 인프라와 일관. `EXPO_TOKEN`으로 비대화형 빌드.

```yaml
# .github/workflows/eas-build.yml  (별도 PR, 루트 워크플로 범위)
name: EAS Build
on:
  workflow_dispatch:
    inputs:
      profile: { type: choice, options: [preview, production] }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - uses: expo/expo-github-action@v8
        with: { eas-version: latest, token: ${{ secrets.EXPO_TOKEN }} }
      - run: pnpm install --frozen-lockfile
      - run: eas build --platform all --profile ${{ inputs.profile }} --non-interactive --no-wait
        working-directory: apps/mumak-native
```

- **선택 기준**: 빌드/제출/OTA를 한곳에서 선언적으로 → A. 기존 GH Actions 권한·시크릿·관례 재사용 → B.
- A·B 모두 워크플로 파일은 **C 도입 시점에 별도 PR**(루트/`.eas/` 신설이라 본 브랜치 범위 밖).

### C-6 스토어 제출 (EAS Submit)

- iOS: `eas submit -p ios --profile production` → App Store Connect 업로드(TestFlight 자동 노출). `submit.production.ios`에 `ascAppId`/`appleTeamId` 필요.
- Android: `eas submit -p android --profile production` → Play Console. Service Account JSON 필요(`track: internal`로 내부 테스트부터).
- 빌드와 체이닝: `eas build --auto-submit` 또는 워크플로의 `submit` job(C-5 옵션 A).

### C-7 OTA 업데이트 (EAS Update)

- 패키지: `expo-updates`. 채널은 C-1 빌드 `channel`과 매칭.
- 배포: `eas update --branch production --message "..."` → 동일 런타임 버전 빌드에 JS/asset OTA.
- 게이팅: C-4 런타임 버전으로 비호환 푸시 차단.
- 도입 트리거: 스토어 심사 없이 JS 핫픽스가 필요해질 때. 초기엔 미도입 가능.

### C-8 모노레포(pnpm + Turborepo) 주의

- `eas build`는 **`apps/mumak-native/`에서 실행**. eas-cli가 워크스페이스 루트를 감지해 전체 repo를 업로드(.gitignore/`.easignore` 존중).
- **업로드 슬리밍**: `apps/mumak-native/.easignore`로 타 앱 산출물(`apps/blog/.next`, `coverage`, 빌드 캐시) 제외 → 업로드/빌드 시간 단축.
- **pnpm 버전 고정**: 루트 `package.json`의 `packageManager` 필드를 EAS 빌드 이미지가 사용. 미설정이면 도입 시 추가(재현성).
- `metro.config.js`는 이미 모노레포 대응(watchFolders·nodeModulesPaths·심볼릭 링크) → EAS Build가 그대로 사용. 별도 작업 불필요.
- `package.json`의 `build` no-op(`echo … EAS`)은 EAS와 무관(EAS는 자체 prebuild+네이티브 빌드 수행) → 충돌 없음.
- Node 버전: EAS 빌드 이미지 Node를 `eas.json` 또는 `app.json` 기준과 맞춤(루트 `engines`와 정합).

### C-9 도입 체크리스트 (순서)

- [ ] `eas login` → `eas init`(projectId/owner 기록)
- [ ] `eas build:configure` → `eas.json` 생성, C-1 기준 프로파일 정리
- [ ] 자격증명: iOS/Android EAS 원격 관리 설정(`eas credentials`)
- [ ] EAS env: 시크릿/프로파일별 변수 등록(`eas env:create`), `EXPO_TOKEN` 발급
- [ ] 런타임 버전 정책(`fingerprint`) + `appVersionSource: remote` 확정
- [ ] `apps/mumak-native/.easignore` 추가(업로드 슬리밍)
- [ ] 첫 빌드: `eas build -p ios --profile preview` / `-p android` 성공
- [ ] 첫 제출: `eas submit`(iOS TestFlight / Android Internal)
- [ ] CI 워크플로(C-5 A 또는 B) 별도 PR로 추가
- [ ] (선택) `expo-updates` + `eas update` OTA 도입

---

## 5. 보류 / 별도 판단

- **web 빌드 CI 검증**: web 실배포 의도 생기면 `expo export --platform web` step 추가. 의도 없으면 `react-dom`/`react-native-web` 제거 후보(현재 보존).
- **`.github/dependabot.yml`에 expo/react-native/react-navigation 그룹 추가**: 루트 파일이라 본 계획(app 한정) 밖. AGENTS.md에 설계안 기록됨 → 별도 PR. (native deps 30+개라 그룹화 안 하면 PR 폭주.)
- **app.json `slug`/`scheme`/bundle id 실값**: 실제 새 앱 부트스트랩 시점에 확정.

---

## 6. 실행 순서

1. A-1 → A-2 → A-3 (안전 수정 한 묶음)
2. `ci-preflight` 전체 통과 확인(coverage 생성 후 format도 통과되는지 포함)
3. B-1 데모 정리 (G1 → G2 → G3 → G6, 단계별 부팅 검증)
4. B-2 baseline 테스트 → B-3 복제 친화성
5. 최종 `ci-preflight` + `expo start` 부팅 + 문서 최종 정합성
6. C는 첫 네이티브 배포 트리거 시 C-9 체크리스트로 실행(별도 PR)

## 7. 검증 매트릭스

| 항목 | 검증 명령 / 기준                                                |
| ---- | --------------------------------------------------------------- |
| A-1  | `test:ci` 후 `format:check` 통과                                |
| A-2  | `test:ci` 통과(스모크/baseline 존재)                            |
| A-3  | 문서 육안 정합 + `format:check`                                 |
| B-1  | `check-types && lint && format:check` + `expo start` 부팅       |
| B-2  | `test:ci` 통과, 커버리지 0 → baseline 상승                      |
| B-3  | `check-types && lint && format:check`, `.env.example` 추적 확인 |
| C-\* | `eas build`(preview) 성공 → `eas submit` 성공 (도입 시)         |

## 8. 리스크 & 롤백

- A그룹: 리스크 최소(설정/문서/스크립트 플래그). 전부 git revert 가능.
- B-1 삭제: orphan 검증(README G1–G6 매핑) 선행. 단계별 부팅으로 회귀 조기 발견. knip 오탐 파일(`*.web.ts`/`*.ios.tsx`) 자동 삭제 금지.
- C그룹: 실 자격증명/스토어 영향 → **반드시 `preview`/`internal` 트랙 선검증 후 production**. 문서 스캐폴드는 도입 시 공식 문서로 문법 재검증.

## 9. 완료 기준 (Definition of Done)

- [ ] `check-types`/`lint`/`format:check`/`test:ci`를 **로컬에서 연속 실행** 시 모두 통과(coverage 생성 후 format도 통과)
- [ ] 데모 잔재 0(react-logo·hello-wave 등 제거, 화면은 깔끔한 placeholder)
- [ ] 토대 컴포넌트 baseline 테스트 통과, `--passWithNoTests` 제거됨
- [ ] README/AGENTS/jest 주석이 실제 상태(SDK 56·RN 0.85·jest 29)와 일치
- [ ] README에 "복제 후 바꿀 값" 체크리스트 존재
- [ ] EAS 도입 런북(C그룹)이 `eas build:configure`만 하면 바로 따라갈 수준으로 구체화됨
