import { useTimeZone } from '@/components/time-zone-provider';
import type { ModeData } from '@/hooks/use-dashboard-controller';
import type { DashboardSnapshot } from '@/lib/dashboard-schema';

function DataContext({ snapshot, query }: { snapshot: DashboardSnapshot; query: ModeData }) {
  const { formatDateTime, timeZone } = useTimeZone();
  const now = Math.max(
    Date.parse(query.lastAttemptAt ?? snapshot.asOf),
    Date.parse(query.lastSuccessAt ?? snapshot.asOf)
  );

  // Use formatToParts: locale output ordering must not decide whether a month is historical.
  const monthParts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(now));
  const nyMonth = `${monthParts.find(part => part.type === 'year')?.value}-${monthParts.find(part => part.type === 'month')?.value}`;
  const period =
    snapshot.month < nyMonth ? '과거 기록' : snapshot.month > nyMonth ? '미래 회차 · 상태 미확인' : '현재 월 기록';
  const lastFill = snapshot.fills.reduce<string | null>(
    (latest, fill) => (!latest || Date.parse(fill.at) > Date.parse(latest) ? fill.at : latest),
    null
  );
  function clock(value: string | undefined | null, absent: string) {
    if (!value) return absent;
    if (!Number.isFinite(Date.parse(value)) || Date.parse(value) > now) return '시각 확인 필요 · 미래 또는 잘못된 시각';
    return formatDateTime(value);
  }

  return (
    <section aria-label="자료 출처와 조회 상태" className="border border-border bg-card p-4 text-xs leading-6 sm:p-5">
      <h3 className="font-semibold text-sm">자료 출처와 조회 상태</h3>
      <p className="mt-2">
        {snapshot.mode === 'paper' ? '공개 모의 운용 · 가상 자금 · 실계좌 아님' : '소유자 전용 실운용 기록'}
      </p>
      <p className="text-muted-foreground">
        {snapshot.source === 'forward-paper-ledger'
          ? '출처: PAPER 원장 기록(원천 선언) · 격리 LAB·합성 테스트와 합산하지 않음'
          : '출처: 실운용 원장 기록(원천 선언)'}
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3 [&>div]:min-w-0 [&_dd]:break-words [&_dt]:text-muted-foreground">
        <div>
          <dt>회차 범위(웹 조회 시점)</dt>
          <dd>
            {period} · {snapshot.month}
          </dd>
        </div>
        <div>
          <dt>원장 기준</dt>
          <dd>{clock(snapshot.asOf, '미연결')}</dd>
        </div>
        <div>
          <dt>내보냄</dt>
          <dd>{clock(snapshot.exportedAt, '미연결')}</dd>
        </div>
        <div>
          <dt>웹 조회</dt>
          <dd>
            {query.status === 'loading'
              ? '재조회 중 · 이전 성공 자료'
              : query.status === 'paused'
                ? '조회 일시정지 · 이전 성공 자료'
                : '조회 성공'}{' '}
            · {clock(query.lastSuccessAt, '미조회')}
          </dd>
        </div>
        <div>
          <dt>DB 적재 확인</dt>
          <dd>미연결</dd>
        </div>
        <div>
          <dt>시장 일정·수집·발행 건강상태</dt>
          <dd>미연결 · 정상/장애 판단 불가</dd>
        </div>
        <div>
          <dt>최근 체결 시각</dt>
          <dd>{clock(lastFill, '저장된 체결 없음')}</dd>
        </div>
        <div>
          <dt>최근 판단·현재 위험상태</dt>
          <dd>미연결 · 보유/체결 수로 추정하지 않음</dd>
        </div>
      </dl>
      <p className="mt-3 text-muted-foreground">
        내보냄·웹 조회 성공은 원장·종목 시세 갱신이나 수집 정상의 증거가 아닙니다. 원장 상태는 운영 건강상태와
        별개입니다.
      </p>
      <p className="text-muted-foreground">
        거래일 구간: 미국 뉴욕 기준 · 표시 시간대: {timeZone}. 종목 평가 시각은 보유 내역에서 확인합니다.
      </p>
    </section>
  );
}

export { DataContext };
