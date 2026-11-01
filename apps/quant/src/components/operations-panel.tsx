import { createContext, useContext, useEffect, useCallback, useState } from 'react';

import { Button } from '@mumak/ui/components/button';
import { Input } from '@mumak/ui/components/input';

import { RiskObservations } from '@/components/risk-observations';
import { useTimeZone } from '@/components/time-zone-provider';
import { useOperationsQuery, type QueryState } from '@/hooks/use-operations-controller';
import type { OperationsClient } from '@/lib/operations-client';
import type { Candidate, SessionOperations, Stage, StageId, Status, Strategy } from '@/lib/operations-schema';

const labels: Record<StageId, string> = {
  collection: '데이터 수집',
  screening: '후보 평가',
  decision: '장전 판단',
  risk: '위험 검사',
  'paper-action': 'PAPER 실행',
  report: '보고 준비',
  publication: '발행 확인',
};
const statuses: Record<Status, string> = {
  running: '진행',
  succeeded: '완료',
  failed: '실패',
  skipped: '건너뜀',
  waiting: '대기',
  blocked: '차단',
  'not-recorded': '기록 없음',
};
const reasons: Record<string, string> = {
  'unverified-identity': '상품·신원 미검증',
  'unknown-classification': '분류 미확인',
  'unknown-sector': '섹터 미확인',
  'unknown-lookthrough': '기초자산 미확인',
  'history-gap': '이력 부족',
  'price-threshold': '가격 기준 미달',
  'liquidity-threshold': '유동성 기준 미달',
  'fetch-failed': '수집 실패',
  'source-ineligible': '원천 부적격',
  'other-not-public': '기타 정제 사유',
  'daily-loss-stop': '일간 손실 경계',
  'monthly-loss-stop': '월간 손실 경계',
  'data-hold': '자료 보류',
  'corporate-hold': '기업행사 보류',
  'manual-hold': '수동 보류',
  'permission-hold': '권한 보류',
  'missed-window': '실행창 경과',
  'outside-schedule': '일정 외',
  'not-due': '예정 전',
  'no-action-recorded': '행동 기록 없음',
  'verification-failed': '검증 실패',
  'publication-failed': '발행 실패',
  'review-required': '검토 필요',
};
const box = 'min-w-0 border border-border bg-card p-4 sm:p-5';
const control = 'min-h-11 min-w-0 w-full max-w-full border border-border bg-background px-3 text-sm';
const Now = createContext(0);
function Expand({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="min-w-0">
      <summary
        onKeyDown={event => {
          if (event.key === 'Escape' && event.currentTarget.parentElement instanceof HTMLDetailsElement) {
            event.currentTarget.parentElement.open = false;
            event.currentTarget.focus();
            event.stopPropagation();
          }
        }}
        className="min-h-11 cursor-pointer content-center font-medium focus-visible:outline-2 focus-visible:outline-primary"
      >
        {title}
      </summary>
      <div className="mt-2 space-y-2 break-words text-xs leading-6 text-muted-foreground">{children}</div>
    </details>
  );
}
function Clock({ at, planned = false }: { at: string | null; planned?: boolean }) {
  const { formatDateTime } = useTimeZone();
  const now = useContext(Now);
  return <>{at ? (!planned && Date.parse(at) > now ? '미래 시각 · 확인 필요' : formatDateTime(at)) : '미제공'}</>;
}
function QueryNotice({ query, empty }: { query: QueryState<unknown> & { retry: () => Promise<void> }; empty: string }) {
  const text =
    query.status === 'error'
      ? {
          'not-provisioned': '운영 데이터 기능이 아직 배포되지 않았습니다.',
          access: '운영 자료 조회 권한을 확인하지 못했습니다.',
          schema: '운영 응답 검증에 실패했습니다.',
          transport: '운영 자료 연결에 실패했습니다.',
        }[query.error ?? 'transport']
      : query.status === 'loading'
        ? '운영 자료 조회 중…'
        : query.status === 'paused' || query.status === 'idle'
          ? '화면이 보이면 운영 자료를 조회합니다.'
          : empty;
  return (
    <div role={query.status === 'error' ? 'alert' : 'status'} className="text-sm leading-6 text-muted-foreground">
      <p>{text}</p>
      {query.status === 'error' && (
        <Button variant="outline" className="mt-2 min-h-11 rounded-none" onClick={() => void query.retry()}>
          이 영역 다시 조회
        </Button>
      )}
    </div>
  );
}
function StrategyDetails({ strategy }: { strategy: Strategy }) {
  const now = useContext(Now);
  const r = strategy.rules;
  const effective = strategy.effectiveFrom.value;
  return (
    <article className="min-w-0 border-l-2 border-primary pl-4">
      <h4 className="break-words text-sm font-semibold">
        완료 일봉 추세 · {strategy.variant}{' '}
        <span className="font-mono text-xs text-muted-foreground">{strategy.version}</span>
      </h4>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">
        뉴욕 세션 {strategy.sessionFrom} – {strategy.sessionThrough} ·{' '}
        {strategy.authority === 'runtime-receipt'
          ? '실행 근거'
          : strategy.authority === 'preserved-policy'
            ? '보존 정책 설명'
            : '등록 정책 설명'}{' '}
        · 당일 실제 적용 버전은 별도 판단 기록으로 확인
      </p>
      {effective && (
        <p className="text-xs leading-6">
          구성 적용 경계: <Clock at={effective} planned /> ·{' '}
          {strategy.activationObservedAt.value ? (
            <>
              실행 확인 <Clock at={strategy.activationObservedAt.value} />
            </>
          ) : Date.parse(effective) > now ? (
            '적용 예정 · 실행 미확인'
          ) : (
            '예정시각 경과 · 실행 미확인'
          )}
        </p>
      )}
      <Expand title="공식·배분·위험 규칙">
        <p>
          목적: 완료 일봉 기반 추세 선택 · 매일 후보 평가, 최초/월요일 정기 진입 · 위험 수시 감시. 매일 수집은 매일
          매수가 아닙니다.
        </p>
        <p className="font-mono break-words">
          S = ((Pₜ / Pₜ₋{r.returnWindows[0]} − 1) + (Pₜ / Pₜ₋{r.returnWindows[1]} − 1)) / 2
        </p>
        <p>
          입력 P: 전 거래일까지의 수정종가. window는 거래 세션.{' '}
          {r.positiveScoreRequired ? 'S > 0' : '점수 양수 필수 아님'}, Pₜ &gt; SMA{r.smaWindow}. 점수는 ratio, 표시
          수익률은 ×100. 점수 내림차순·동점 티커 오름차순.
        </p>
        <p>
          변동성: 최근 {r.volatilityWindow}개 일간 단순수익률의 표본 표준편차(ddof={r.volatilityDof}) · 비연율. 상위{' '}
          {r.maxPositions}개 선별 후 역변동성 배분.
        </p>
        <p className="font-mono">
          wᵢ = ({r.inverseVolBudget}/{r.budgetDivisor}) × (1/σᵢ) / Σ(1/σⱼ)
        </p>
        <p>
          주식 {r.stockCap}, ETF {r.etfCap}, 섹터 {r.sectorCap}, 기초기업 {r.underlyingCompanyCap} ratio cap. 제한 후 빈
          비중 재분배·하위 순위 보충 없음. 최소 현금 {r.minCash}. NAV×{r.sizingNavFactor} 정수주 내림 후 비용·현금·한도
          재확인.
        </p>
        <p>
          자료: {r.historyWindow}개 완료 세션 이력 · universe coverage ≥{r.minUniverseCoverage}, 보유 coverage{' '}
          {r.requiredHoldingsCoverage}. 명목 종가 ≥USD {r.minPriceUsd}, 최근 {r.liquidityWindow}거래일 평균 종가×거래량
          ≥USD {r.minMeanDollarVolumeUsd}. SPY 날짜별 대리 universe 정책: 주식 {r.nominalUniverseEquities}·ETF{' '}
          {r.nominalUniverseEtfs}. ETF 상한은 상품 검증/거래 허용의 증거가 아닙니다.
        </p>
        <p>
          위험 규칙: 이전종가 NAV 대비 일간 손실 {r.dailyLossStop}, 월간 누적 {r.monthlyLossStop} 계좌 전체 방어. 현재
          위험 통과 여부와 별개입니다. 가정 비용: 편도 수수료 {r.commissionBps}bps·슬리피지 {r.slippageBps}bps. 실제
          브로커 비용이 아닙니다.
        </p>
        <p>
          정기 진입: 최초/월요일 개장+{r.entryWindowOpenMinutes}–{r.entryWindowCloseMinutes}분. 장중 관측: 보유·실행
          예정 후보의 UTC {r.quoteSlotMinutes}분 slot. 실제 다음 scheduler 실행은 미제공입니다.
        </p>
        {strategy.variant === 'C1' && (
          <p>
            C1은 새 랭킹 전략이 아닙니다. 구성 적용 경계 이후 실제 위험청산의 동결 basket만 다음날 이후 조건부 재진입
            검토. 같은날 재진입·과거 청산 소급·hold 자동 해제 없음. 월요일 정기선택 복귀 · 경제적 우월성 미입증.
          </p>
        )}
        <p>
          출처 별칭: {strategy.evidenceIds.join(', ')} · 정책 기간은 NY inclusive, 적용 종료시각은 exclusive:{' '}
          {strategy.effectiveTo.value ?? '미제공'}.
        </p>
      </Expand>
    </article>
  );
}
function StageCard({ stage }: { stage: Stage }) {
  const now = useContext(Now);
  const expired = stage.status === 'running' && (!stage.leaseUntil || Date.parse(stage.leaseUntil) <= now);
  const future = !!stage.evidenceAt && Date.parse(stage.evidenceAt) > now;
  const tone =
    future || expired
      ? 'text-muted-foreground'
      : stage.status === 'failed' || stage.status === 'blocked'
        ? 'text-destructive'
        : stage.status === 'succeeded'
          ? 'text-primary'
          : 'text-muted-foreground';
  return (
    <li className="min-w-0 border border-border p-3">
      <Expand
        title={`${labels[stage.id]} · ${future ? '시각 확인 필요' : expired ? '실행 기록 · 현재 미확인' : statuses[stage.status]}`}
      >
        <p className={tone}>
          근거: <Clock at={stage.evidenceAt} />
        </p>
        {stage.reasonCode && <p>이유: {reasons[stage.reasonCode]}</p>}
        {stage.progress.value && (
          <p>
            관측 진척: {stage.progress.value.processed}/{stage.progress.value.total} · fetch 오류{' '}
            {stage.progress.value.fetchErrors} · 현재 실행 여부와 별개
          </p>
        )}
        {stage.action.value && (
          <p>
            기록 행동:{' '}
            {{ buy: '매수', sell: '매도', 'buy-and-sell': '매수·매도', hold: '보유 유지' }[stage.action.value]}
          </p>
        )}
        {stage.risk.value && (
          <dl>
            {Object.entries(stage.risk.value).map(([key, fact]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{fact.value === null ? '미제공' : fact.value ? '보류' : '해당 gate 보류 아님'}</dd>
              </div>
            ))}
          </dl>
        )}
        {stage.quality.value && (
          <dl>
            {Object.entries(stage.quality.value).map(([key, fact]) => (
              <div key={key}>
                <dt>
                  {
                    (
                      {
                        historyValid: '이력 유효 수',
                        historyCoverage: '이력 coverage',
                        historyGatePass: '이력 검사',
                        decisionVerified: '판단 검증',
                        closeVerified: '마감 검증',
                        ledgerReconciled: '원장 대사',
                        policyIntegrity: '정책 무결성',
                      } as Record<string, string>
                    )[key]
                  }
                </dt>
                <dd>
                  {fact.value === null
                    ? '미제공'
                    : typeof fact.value === 'boolean'
                      ? fact.value
                        ? '확인됨'
                        : '확인되지 않음'
                      : fact.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <p>
          시작 <Clock at={stage.startedAt} /> · 종료 <Clock at={stage.finishedAt} />
        </p>
        <p>
          다음 예정 <Clock at={stage.nextExpectedAt} planned /> · 예정 경계 <Clock at={stage.expectedBy} planned />
        </p>
        <p>출처 별칭: {stage.evidenceIds.join(', ') || '기록 없음'}</p>
      </Expand>
    </li>
  );
}
function CandidateBrowser({ payload }: { payload: SessionOperations }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('symbol');
  const [page, setPage] = useState(0);
  const candidates = payload.candidates.value;
  if (!candidates)
    return (
      <p className="text-sm text-muted-foreground">
        해당 세션의 후보 탐색 기록이 제공되지 않았습니다. 다른 날 후보로 채우지 않습니다.
      </p>
    );
  const match = (c: Candidate) =>
    c.symbol.includes(search.toUpperCase()) &&
    (filter === 'all' ||
      (filter === 'eligible' && c.collectorEligible.value === true) ||
      (filter === 'excluded' && c.collectorEligible.value === false) ||
      (filter === 'ranked' && c.signalQualified.value === true) ||
      (filter === 'selected' && c.selected.value === true) ||
      (filter === 'watched' && c.watched.value === true));
  const filtered = candidates
    .filter(match)
    .toSorted((a, b) =>
      sort === 'score'
        ? Number(b.score.value ?? '-Infinity') - Number(a.score.value ?? '-Infinity') ||
          a.symbol.localeCompare(b.symbol)
        : a.symbol.localeCompare(b.symbol)
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const safePage = Math.min(page, pages - 1);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label htmlFor="candidate-search" className="text-xs">
          후보 티커 검색
          <Input
            id="candidate-search"
            type="search"
            aria-label="후보 티커 검색"
            className="mt-1 min-h-11 rounded-none"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="grid text-xs">
          후보 분류
          <select
            className={control}
            value={filter}
            onChange={e => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">전체 {payload.counts.universe.value}</option>
            <option value="eligible">수집 적격 {payload.counts.collectorEligible.value}</option>
            <option value="excluded">수집 제외 {payload.counts.collectorExcluded.value}</option>
            {(
              [
                ['ranked', '신호 통과'],
                ['selected', '선정'],
                ['watched', '관심'],
              ] as const
            ).map(([key, label]) => (
              <option key={key} value={key} disabled={payload.counts[key].value === null}>
                {label} · {payload.counts[key].value ?? '미제공'}
              </option>
            ))}
          </select>
        </label>
        <label className="grid text-xs">
          후보 정렬
          <select
            className={control}
            value={sort}
            onChange={e => {
              setSort(e.target.value);
              setPage(0);
            }}
          >
            <option value="symbol">티커 오름차순</option>
            <option value="score" disabled={!candidates.some(c => c.score.value !== null)}>
              기록 점수 내림차순
            </option>
          </select>
        </label>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {filtered.length}개 검색 결과 · {filtered.length ? safePage * 25 + 1 : 0}–
        {Math.min((safePage + 1) * 25, filtered.length)} 표시 · 수집 적격 ≠ 신호 통과 ≠ 선정 ≠ 체결
      </p>
      <ul aria-label="후보 목록" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.slice(safePage * 25, (safePage + 1) * 25).map(c => (
          <li key={c.symbol} className="min-w-0 border border-border p-3 text-xs leading-6">
            <div className="flex flex-wrap justify-between gap-2">
              <strong className="font-mono text-sm">{c.symbol}</strong>
              <span>{c.kind === 'equity' ? '주식' : '상장지수상품'}</span>
            </div>
            <p>
              {c.collectorEligible.value === true
                ? '수집 적격'
                : c.collectorEligible.value === false
                  ? '수집 제외'
                  : '수집 적격 미제공'}
            </p>
            {(c.reasonCodes.value ?? []).map(r => (
              <p key={r} className="text-muted-foreground">
                {reasons[r]}
              </p>
            ))}
            {c.score.value !== null && (
              <p>
                점수 {c.score.value} · 순위 {c.rank.value ?? '미기록'} · 비연율 변동성 {c.volatility.value ?? '미기록'}
              </p>
            )}
            {c.targetWeight.value !== null && (
              <p>
                목표 비중(ratio) {c.targetWeight.value} · {c.selected.value ? '선정' : '미선정'}
              </p>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          className="min-h-11 rounded-none"
          disabled={safePage === 0}
          onClick={() => setPage(safePage - 1)}
        >
          후보 이전
        </Button>
        <span className="text-xs">
          {safePage + 1}/{pages} 페이지
        </span>
        <Button
          variant="outline"
          className="min-h-11 rounded-none"
          disabled={safePage + 1 >= pages}
          onClick={() => setPage(safePage + 1)}
        >
          후보 다음
        </Button>
      </div>
    </div>
  );
}
function SessionDetails({
  client,
  episodeId,
  month,
  session,
}: {
  client: OperationsClient;
  episodeId: string;
  month: string;
  session: string;
}) {
  const load = useCallback(
    (signal: AbortSignal) => client.fetchSession(episodeId, month, session, signal),
    [client, episodeId, month, session]
  );
  const query = useOperationsQuery(`${episodeId}:${month}:${session}`, load);
  const row = query.data;
  return (
    <div className="space-y-4" aria-label="선택일 운영 상세">
      {row ? (
        <>
          {query.status !== 'ready' && (
            <p role="status" className="text-xs text-muted-foreground">
              {query.status === 'paused' ? '조회 일시정지' : '재조회 중'} · 이전 성공 기록
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">뉴욕 {session} 운영 흐름</h4>
            <Button variant="outline" className="min-h-11 rounded-none" onClick={() => void query.retry()}>
              선택일 다시 조회
            </Button>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            당일 실행 전략: {row.payload.strategyVersion.value ?? '판단 binding 미제공'} · 근거 시각{' '}
            <Clock at={row.payload.sourceAsOf} /> · 현재 건강·장외·휴장 판정 아님
          </p>
          <ol aria-label="일별 자동화 단계" className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
            {row.payload.stages.map(stage => (
              <StageCard key={stage.id} stage={stage} />
            ))}
          </ol>
          <CandidateBrowser key={`${session}:${row.revision}`} payload={row.payload} />
          <Expand title="기록 출처와 서로 다른 시계">
            <p>
              sourceAsOf <Clock at={row.payload.sourceAsOf} /> · 내보냄 <Clock at={row.payload.exportedAt} /> · DB 저장{' '}
              <Clock at={row.storedAt} /> · 웹 조회 <Clock at={query.fetchedAt} />
            </p>
            <p>
              revision {row.revision} · 원장 관측 <Clock at={row.payload.ledgerAsOf.value} /> · source 시각은 수집·발행
              건강이 아닙니다. 보고 준비와 전달 성공도 다릅니다.
            </p>
            <ul>
              {row.payload.evidence.map(e => (
                <li key={e.id}>
                  {e.id} · {e.kind} · 사건 <Clock at={e.evidenceAt} /> · adapter 관측 <Clock at={e.observedAt} />
                </li>
              ))}
            </ul>
          </Expand>
        </>
      ) : (
        <QueryNotice query={query} empty="선택한 날짜의 운영 기록이 없습니다." />
      )}
    </div>
  );
}
function OperationsPanelContent({
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
  const loadMonth = useCallback(
    (signal: AbortSignal) => client!.fetchMonth(episodeId, month, signal),
    [client, episodeId, month]
  );
  const loadList = useCallback(
    (signal: AbortSignal) => client!.fetchSessions(episodeId, month, signal),
    [client, episodeId, month]
  );
  const policy = useOperationsQuery(`${episodeId}:${month}:month`, client ? loadMonth : null);
  const list = useOperationsQuery(`${episodeId}:${month}:list`, client ? loadList : null);
  const [selection, setSelection] = useState('');
  const session = selection || list.data?.[0]?.summary.session || '';
  return (
    <section aria-label="PAPER 전략과 일별 운영" className={box}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">전략과 일별 운영</h3>
        <span className="text-xs text-muted-foreground">PAPER ONLY · {month} · 뉴욕 세션 기준</span>
      </div>
      <RiskObservations client={client} episodeId={episodeId} month={month} financialAsOf={financialAsOf} />
      {!client ? (
        <p className="mt-3 text-sm text-muted-foreground">
          운영 조회 연결이 제공되지 않았습니다. 재무 내역은 독립적으로 표시합니다.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          <div className="space-y-4">
            {policy.data ? (
              <>
                {policy.data.payload.strategies.value?.map(strategy => (
                  <StrategyDetails key={strategy.version} strategy={strategy} />
                ))}
                <p className="text-xs text-muted-foreground">
                  등록 근거 <Clock at={policy.data.sourceAsOf} /> ·{' '}
                  {policy.status === 'ready' ? '정책 조회 성공' : '이전 성공 정책 · 재조회/일시정지'} · 실제 활성화
                  증명과 별개
                </p>
              </>
            ) : (
              <QueryNotice query={policy} empty="이 월에 등록된 전략 설명이 없습니다." />
            )}
          </div>
          <div className="border-t border-border pt-4">
            <h4 className="mb-3 text-sm font-semibold">일별 기록</h4>
            {list.data?.length ? (
              <>
                <label className="grid max-w-md gap-1 text-xs">
                  거래일 선택
                  <select
                    aria-label="거래일 선택"
                    className={control}
                    value={session}
                    onChange={e => setSelection(e.target.value)}
                  >
                    {list.data.map(row => (
                      <option key={row.summary.session} value={row.summary.session}>
                        {row.summary.session} ·{' '}
                        {row.summary.stages
                          .filter(s => s.status === 'succeeded')
                          .map(s => labels[s.id])
                          .join('·') || '저장 관측'}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="my-3 text-xs text-muted-foreground">
                  선택 월의 저장 기록만 표시합니다. 목록에 없는 날은 성공·실패로 채우지 않습니다. 다음 실행·휴장 일정
                  미제공.
                </p>
                {session && (
                  <SessionDetails
                    key={`${episodeId}:${month}:${session}`}
                    client={client}
                    episodeId={episodeId}
                    month={month}
                    session={session}
                  />
                )}
              </>
            ) : (
              <QueryNotice query={list} empty="이 월의 일별 운영 기록이 없습니다." />
            )}
          </div>
          <Expand title="연구·검증·개선 기록 (운영과 분리)">
            {policy.data?.payload.improvement.value ? (
              <>
                <p>
                  후보: {policy.data.payload.improvement.value.candidateVersion.value ?? '미제공'} · 결과:{' '}
                  {policy.data.payload.improvement.value.outcome.value ?? '미제공'}
                </p>
                <ul>
                  {policy.data.payload.improvement.value.stages.map(stage => (
                    <li key={stage.id}>
                      {stage.id} · {statuses[stage.status]} · <Clock at={stage.evidenceAt} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>
                자동 개선 단계 미제공. 공개 가능한 연구·오프라인 검증·독립 검토·승격 receipt가 필요합니다. LAB
                실험·소프트웨어 개발 완료를 운영 승격으로 추정하지 않습니다.
              </p>
            )}
          </Expand>
        </div>
      )}
    </section>
  );
}
function OperationsPanel(props: React.ComponentProps<typeof OperationsPanelContent>) {
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
  return (
    <Now value={now}>
      <OperationsPanelContent {...props} />
    </Now>
  );
}
export { OperationsPanel };
