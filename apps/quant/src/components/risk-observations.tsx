import { useCallback, useEffect, useState } from 'react';

import { Button } from '@mumak/ui/components/button';

import { useTimeZone } from '@/components/time-zone-provider';
import { useOperationsQuery } from '@/hooks/use-operations-controller';
import type { AccountRisk, Health, Observation, SymbolRisk } from '@/lib/observation-schema';
import type { OperationsClient } from '@/lib/operations-client';

const card = 'min-w-0 border border-border bg-background p-4';
const stateLabels = {
  monitor: '감시',
  'full-exit': '전량 매도 판단',
  trim: '감축 판단',
  hold: '보류',
  unknown: 'UNKNOWN',
};
const reasonLabels = {
  none: '개별 조건 미발동 기록',
  'symbol-stop': '종목 손절 조건',
  'symbol-trim': '노출 proxy 초과',
  'account-stop': '계좌 방어 우선',
  'data-hold': '입력 자료 보류',
  'corporate-hold': '기업행사 기준 보류',
  unknown: '근거 미확인',
};
const reentryLabels = {
  'same-session-blocked': '같은 세션 재매수 금지',
  'regular-entry-only': '정기 진입 적격성 별도 확인',
  'hold-blocked': '보류 해제 전 재진입 금지',
  unknown: '재진입 제약 미확인',
};
const accountReasons = {
  none: '계좌 손실 경계 미발동 기록',
  'daily-loss-stop': '일간 손실 경계',
  'monthly-loss-stop': '월간 손실 경계',
  'both-loss-stops': '일간·월간 손실 경계',
  unknown: '계좌 기준 미확인',
};
function percent(value: string | null) {
  return value === null ? '미제공' : `${(Number(value) * 100).toFixed(2)}%`;
}
function Clock({ at }: { at: string | null }) {
  const { formatDateTime } = useTimeZone();
  return <>{at ? formatDateTime(at) : '미제공'}</>;
}
function freshness(v: { assessedAt: string; validUntil: string }, p: Observation, now: number) {
  if (Date.parse(v.assessedAt) > now || Date.parse(p.effectiveFrom) > now) return '미래 시각 · 확인 필요';
  if (Date.parse(v.validUntil) <= now || Date.parse(p.effectiveThrough) <= now) return '유효기간 경과 · 현재 UNKNOWN';
  return p.origin === 'synthetic' ? '합성 검증 기록 · 운영 아님' : '원천 유효범위 내 관측';
}
function HealthLine({
  name,
  value,
  payload,
  now,
}: {
  name: string;
  value: Health | null;
  payload: Observation;
  now: number;
}) {
  return (
    <div className="border-t border-border py-2">
      <dt>{name}</dt>
      <dd className="font-medium">
        {value
          ? `${{ succeeded: '성공 receipt', failed: '실패 receipt', running: '진행 receipt', unknown: 'UNKNOWN' }[value.status]} · ${freshness(value, payload, now)}`
          : '원천 receipt 미지원 · UNKNOWN'}
      </dd>
      {value && (
        <dd className="text-muted-foreground">
          평가 <Clock at={value.assessedAt} /> · 유효 종료 <Clock at={value.validUntil} />
        </dd>
      )}
    </div>
  );
}
function PriceRail({ risk }: { risk: SymbolRisk }) {
  const { entryPrice, highWater, mark, stopThreshold } = risk;
  if ([entryPrice, highWater, mark, stopThreshold].some(v => v === null))
    return (
      <p className="border border-dashed border-border p-3 text-xs text-muted-foreground">
        가격 기준 미제공 · 손절 거리 계산 안 함
      </p>
    );
  const values = [Number(stopThreshold), Number(entryPrice), Number(mark), Number(highWater)];
  const lo = Math.min(...values) * 0.97;
  const hi = Math.max(...values) * 1.03;
  const x = (value: string | null) => 16 + ((Number(value) - lo) / (hi - lo)) * 268;
  const distance = (Number(mark) / Number(stopThreshold) - 1) * 100;
  return (
    <div className="border border-border px-2 py-3">
      <svg
        viewBox="0 0 300 40"
        role="img"
        aria-label={`${risk.symbol} 가격 기준 비교: 손절 ${stopThreshold}, 진입 ${entryPrice}, 평가 ${mark}, 고점 ${highWater}`}
        className="h-12 w-full"
      >
        <line x1="16" y1="20" x2="284" y2="20" className="stroke-border" strokeWidth="3" />
        <line
          x1={x(stopThreshold)}
          y1="4"
          x2={x(stopThreshold)}
          y2="36"
          className="stroke-destructive"
          strokeWidth="3"
        />
        <rect x={x(entryPrice) - 4} y="16" width="8" height="8" className="fill-muted-foreground" />
        <path d={`M ${x(highWater)} 8 l -5 8 h 10 Z`} className="fill-foreground" />
        <circle cx={x(mark)} cy="20" r="5" className="fill-primary" />
      </svg>
      <p className="text-xs">
        손절선 대비 평가가격 {distance >= 0 ? '+' : ''}
        {distance.toFixed(2)}% · 표시용 거리
      </p>
      <p className="mt-1 text-[0.65rem] text-muted-foreground">│ 손절 · ■ 진입 · ● 평가 · ▲ 고점 · 시간축 아님</p>
    </div>
  );
}
function AccountCard({
  value,
  payload,
  now,
}: {
  value: AccountRisk | null;
  payload: Observation | undefined;
  now: number;
}) {
  return (
    <article className={card} aria-label="계좌 전체 위험">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">01 · 계좌 전체 방어</h4>
        <span className="border border-border px-2 py-1 text-xs">개별 판단보다 우선</span>
      </div>
      <p className="mt-3 text-lg font-semibold">
        {value
          ? value.state === 'stopped'
            ? '전체청산 경계 발동 기록'
            : value.state === 'clear'
              ? '경계 미발동 기록'
              : 'UNKNOWN'
          : 'UNKNOWN · 평가 receipt 없음'}
      </p>
      {value && payload && (
        <p className="mt-1 text-xs text-muted-foreground">
          {accountReasons[value.reason]} · {freshness(value, payload, now)}
        </p>
      )}
      <dl className="my-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted-foreground">일간 수익률 / 방어선</dt>
          <dd className="mt-1 font-mono">{percent(value?.dailyReturn ?? null)} / −1%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">월간 누적 / 방어선</dt>
          <dd className="mt-1 font-mono">{percent(value?.monthlyReturn ?? null)} / −30%</dd>
        </div>
      </dl>
      <p className="border-l-2 border-destructive pl-3 text-sm leading-6">
        일일 −1% 또는 월간 −30% 발동 시 이익 종목도 포함해 전체청산합니다. 종목별 손절·감축보다 계좌 stop이 먼저이며,
        비용 후 경계 초과도 방어 대상입니다.
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        보유 0·체결 수·HTTP 성공으로 현재 위험 해소를 추정하지 않습니다.
      </p>
      {value && (
        <p className="mt-3 text-xs">
          평가 <Clock at={value.assessedAt} /> · 유효 종료 <Clock at={value.validUntil} />
        </p>
      )}
    </article>
  );
}
function SymbolCard({ risk, payload, now }: { risk: SymbolRisk; payload: Observation; now: number }) {
  return (
    <li className={card}>
      <div className="flex flex-wrap justify-between gap-2">
        <h5 className="font-mono text-base font-semibold">{risk.symbol}</h5>
        <span className="border border-border px-2 py-1 text-xs font-semibold">{stateLabels[risk.state]}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {reasonLabels[risk.reason]} · {freshness(risk, payload, now)}
      </p>
      <div className="my-3">
        <PriceRail risk={risk} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        {[
          ['진입가 / 고점 (USD)', `${risk.entryPrice ?? '미제공'} / ${risk.highWater ?? '미제공'}`],
          ['평가 / 손절선 (USD)', `${risk.mark ?? '미제공'} / ${risk.stopThreshold ?? '미제공'}`],
          ['진입 동결 σ (비연율)', percent(risk.sigmaEntry)],
          ['노출 proxy / γ', `${percent(risk.exposureProxy)} / ${percent(risk.gamma)}`],
          ['관측 수량 → 판단 목표', `${risk.quantity} → ${risk.targetQuantity ?? '미제공'}주`],
          ['입력 신뢰도 (원천 선언)', risk.inputConfidence === 'validated' ? '검증 입력' : 'UNKNOWN'],
        ].map(([label, text]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words font-mono">{text}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-border pt-3 text-xs font-medium">{reentryLabels[risk.reentry]}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        평가 <Clock at={risk.assessedAt} /> · 유효 종료 <Clock at={risk.validUntil} />
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        근거 별칭 {risk.evidenceIds.join(', ')} · 판단은 체결 확인이 아닙니다.
      </p>
    </li>
  );
}
function CandidatePolicy() {
  return (
    <aside className="border border-dashed border-border p-4" aria-label="검토 완료 종목 위험 후보">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-semibold">종목별 위험관리 설계</h4>
        <span className="border border-primary px-2 py-1 text-xs text-primary">검토 완료 후보 / 적용 대기</span>
      </div>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        오프라인 기술 후보의 동작 검토 완료입니다. PAPER 설치·활성화 증거가 아니며 경제적 우월성은 미입증입니다. 합성
        시험·LAB·개발 완료와 실제 PAPER 관측을 합산하지 않습니다.
      </p>
      <ol className="mt-4 grid gap-3 text-xs leading-6 md:grid-cols-3">
        <li className="border-l-2 border-foreground pl-3">
          <strong>① 계좌 우선</strong>
          <p>일간·월간 경계 선행/동시/비용 후 발동 → 전체청산. 수익 종목의 유지도 보장하지 않음.</p>
        </li>
        <li className="border-l-2 border-primary pl-3">
          <strong>② 종목별 분리</strong>
          <p>
            B: 개별 손절 · C: 개별 손절 + 노출 proxy 감축. 해당 종목만 조정하고 다른 보유분 수량·잔여원가는 유지. 정기
            재선정·집중도 제한은 별도.
          </p>
        </li>
        <li className="border-l-2 border-muted-foreground pl-3">
          <strong>③ 재진입 제약</strong>
          <p>
            같은 세션 재매수 금지 · 개별 청산을 계좌 C1 basket으로 오인하지 않음. UNKNOWN·기업행사 보류는 자동 해제하지
            않음.
          </p>
        </li>
      </ol>
      <details className="mt-3">
        <summary
          className="min-h-11 cursor-pointer content-center text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary"
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.currentTarget.parentElement?.removeAttribute('open');
              e.currentTarget.focus();
            }
          }}
        >
          후보 공식과 승인 범위
        </summary>
        <div className="space-y-2 break-words text-xs leading-6 text-muted-foreground">
          <p>
            거리 d = min(10%, max(3%, k × σ_entry)). 손절선 = max(진입 모델 VWAP, 관측 고점) × (1 − d). 진입 시 64개
            완료 종가의 63개 단순수익률 표본 표준편차를 동결합니다.
          </p>
          <p>
            C: w × σ_entry &gt; γ이면 목표 수량을 내림해 감축. 이 값은 공분산 기반 위험기여가 아닌 노출 proxy입니다.
            k·γ와 적용 버전은 실제 원천 receipt 없이는 운영 값으로 표시하지 않습니다.
          </p>
          <p>
            기술 승인 197 + 독립 추가 7개 오프라인 시험. B/C는 기존 계좌 방어 유지. D는 미승인 오프라인 전용. 역사/PIT
            장중자료 부족으로 경제성 INSUFFICIENT.
          </p>
          <p>
            승인 근거: REVIEW539 / candidate537 · source SHA256
            47caa87eeaa43059af094b18af814d14ed0948c82024de36fb648bc660fc84e4
          </p>
        </div>
      </details>
    </aside>
  );
}
function RiskObservations({
  client,
  episodeId,
  month,
  financialAsOf,
}: {
  client: OperationsClient | undefined;
  episodeId: string;
  month: string;
  financialAsOf?: string;
}) {
  const load = useCallback(
    (signal: AbortSignal) => client!.fetchObservation!(episodeId, month, signal),
    [client, episodeId, month]
  );
  const query = useOperationsQuery(`${episodeId}:${month}:observation`, client?.fetchObservation ? load : null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  const p = query.data?.payload;
  const missing = !client?.fetchObservation
    ? '관측 adapter 미연결 · 재무 조회와 독립'
    : query.status === 'error'
      ? {
          'not-provisioned': '관측 DB/RPC 미설치',
          access: '관측 조회 권한 미확인',
          schema: '관측 계약 검증 실패',
          transport: '관측 연결 실패',
        }[query.error ?? 'transport']
      : query.status === 'ready'
        ? '해당 월 source-native receipt 미등록'
        : '관측 조회 중 또는 일시정지';
  const symbols = p?.symbols.value;
  const decision = p?.decision.value;
  const ingest = p?.ingest.value;
  const financialMatch = ingest && financialAsOf && Date.parse(ingest.snapshotAsOf) === Date.parse(financialAsOf);
  return (
    <div className="mt-4 space-y-4" aria-label="연결 근거와 위험 분리">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {p
            ? `뉴욕 ${p.session} · ${p.origin === 'synthetic' ? '합성 검증 자료 · 실제 PAPER 아님' : 'PAPER 원천 관측 (원천 선언)'}`
            : missing}
        </p>
        {client?.fetchObservation && (
          <Button variant="outline" className="min-h-11 rounded-none" onClick={() => void query.retry()}>
            연결·위험 다시 조회
          </Button>
        )}
      </div>
      {query.status === 'error' && (
        <p role="alert" className="text-xs text-destructive">
          {missing} · 다른 운영·재무 영역은 독립적으로 조회합니다.
        </p>
      )}
      {p && query.status !== 'ready' && (
        <p role="status" className="text-xs text-muted-foreground">
          이전 성공 관측 · 재조회/일시정지 · 원천 유효기간은 갱신하지 않음
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-3">
        <article className={card}>
          <h4 className="text-sm font-semibold">DB 적재 확인</h4>
          <p className="my-3 text-sm">
            {ingest
              ? financialMatch
                ? '선택 재무 snapshot과 readback receipt 일치'
                : 'readback receipt 있음 · 선택 재무 snapshot 일치 미확인'
              : '재무 적재 receipt 미지원 · UNKNOWN'}
          </p>
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-muted-foreground">재무 source / readback</dt>
              <dd>
                <Clock at={ingest?.snapshotAsOf ?? null} /> / <Clock at={ingest?.readbackAt ?? null} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">관측행 DB 저장 / revision</dt>
              <dd>
                <Clock at={query.data?.storedAt ?? null} /> / {query.data?.revision ?? '미제공'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">웹 관측 조회</dt>
              <dd>
                <Clock at={query.fetchedAt} />
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">관측행 저장은 재무행 적재 성공의 대체 증거가 아닙니다.</p>
        </article>
        <article className={card}>
          <h4 className="text-sm font-semibold">시장 일정·수집·발행 건강상태</h4>
          <dl className="mt-3 text-xs leading-6">
            {p ? (
              <>
                <HealthLine name="수집" value={p.collection.value} payload={p} now={now} />
                <HealthLine name="발행" value={p.publication.value} payload={p} now={now} />
              </>
            ) : (
              <div>
                <dt>수집 / 발행</dt>
                <dd>원천 receipt 미지원 · UNKNOWN</dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-xs">
            {p?.schedule.value ? (
              <>
                세션 <Clock at={p.schedule.value.opensAt} /> – <Clock at={p.schedule.value.closesAt} />
                <br />
                다음 예정 <Clock at={p.schedule.value.nextExpectedAt} /> · 기한{' '}
                <Clock at={p.schedule.value.expectedBy} /> · 예정 경과만으로 장애 판정 안 함
              </>
            ) : (
              '시장 일정·다음 실행 receipt 미지원 · 휴장/장외 추정 안 함'
            )}
          </p>
        </article>
        <article className={card}>
          <h4 className="text-sm font-semibold">최근 판단·현재 위험상태</h4>
          <p className="mt-3 text-sm">
            {decision
              ? `${{ buy: '매수', sell: '매도', hold: '보유 유지', blocked: '차단' }[decision.action]} 판단 기록 · 체결 확인 아님`
              : '판단 receipt 미지원 · UNKNOWN'}
          </p>
          {decision && (
            <p className="mt-2 text-xs">
              전략 {decision.strategyVersion} · <Clock at={decision.at} />
            </p>
          )}
          <p className="mt-3 text-xs">
            {p?.account.value ? freshness(p.account.value, p, now) : '계좌·종목 위험 receipt 미지원 · 현재 UNKNOWN'}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            월 내 최신 원천 관측입니다. 아래 거래일 선택의 과거 기록 및 현재 건강과 구별합니다.
          </p>
        </article>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <AccountCard value={p?.account.value ?? null} payload={p} now={now} />
        <section className="min-w-0" aria-label="종목별 위험">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">02 · 종목별 판단과 입력 근거</h4>
            <span className="text-xs text-muted-foreground">
              {symbols
                ? `${symbols.length}개 원천 평가 · 감시 ${symbols.filter(s => s.state === 'monitor').length} / 감축 ${symbols.filter(s => s.state === 'trim').length} / 전량 ${symbols.filter(s => s.state === 'full-exit').length} / 보류·UNKNOWN ${symbols.filter(s => s.state === 'hold' || s.state === 'unknown').length}`
                : '평가 목록 미제공'}
            </span>
          </div>
          {symbols?.length ? (
            <ul aria-label="종목별 위험 평가 목록" className="grid gap-3 md:grid-cols-2">
              {symbols.map(s => (
                <SymbolCard key={s.symbol} risk={s} payload={p!} now={now} />
              ))}
            </ul>
          ) : (
            <p className="border border-dashed border-border p-5 text-sm leading-6 text-muted-foreground">
              {symbols
                ? '원천은 빈 평가 목록을 기록했습니다. 빈 목록은 현재 위험 해소 증거가 아닙니다.'
                : '종목 평가 receipt가 없어 가격·σ·손절선·감축 이유를 만들지 않습니다. 보유 목록이나 현재 시세에서 재구성하지 않습니다.'}
            </p>
          )}
        </section>
      </div>
      <CandidatePolicy />
      {p && (
        <details>
          <summary className="min-h-11 cursor-pointer content-center text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary">
            관측 출처·유효범위·서로 다른 시계
          </summary>
          <div className="space-y-2 break-words text-xs leading-6 text-muted-foreground">
            <p>
              원천 <Clock at={p.sourceAsOf} /> · 내보냄 <Clock at={p.exportedAt} /> · DB 저장{' '}
              <Clock at={query.data!.storedAt} /> · 웹 조회 <Clock at={query.fetchedAt} />
            </p>
            <p>
              적용 범위 <Clock at={p.effectiveFrom} /> 이상 – <Clock at={p.effectiveThrough} /> 미만. 재조회는
              근거·유효기간을 갱신하지 않습니다.
            </p>
            <ul>
              {p.evidence.map(e => (
                <li key={e.id}>
                  {e.id} · {e.kind} · 사건 <Clock at={e.evidenceAt} /> · adapter 관측 <Clock at={e.observedAt} />
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
export { RiskObservations, PriceRail, freshness };
