import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// C-1(빌드 다이어트) 회귀 가드. 본문 폰트가 다시 풀셋(2.1MB)으로 바뀌거나 깨진
// 산출물로 교체되는 것을 막는다. 글리프 커버리지 검증은 scripts/subset-body-font.sh와
// 빌드/E2E가 담당하고, 여기서는 "전송 비용이 의도한 범위 안인지"만 싸게 고정한다.
describe('body font subset (Pretendard Variable)', () => {
  const fontPath = join(process.cwd(), 'fonts', 'PretendardVariableSubset.woff2');

  it('is a valid woff2 file', () => {
    const header = readFileSync(fontPath).subarray(0, 4).toString('ascii');
    expect(header).toBe('wOF2');
  });

  it('stays within the diet budget (not the 2.1MB full font, not empty/corrupt)', () => {
    const bytes = statSync(fontPath).size;
    // 현재 서브셋 ~1.24MB. 하한은 손상/빈 파일, 상한은 풀셋 회귀를 잡는다.
    expect(bytes).toBeGreaterThan(700_000);
    expect(bytes).toBeLessThan(1_450_000);
  });
});
