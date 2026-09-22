import { CircleAlert } from 'lucide-react';
import { lazy, Suspense, useMemo, useRef, useState } from 'react';

import { Button } from '@mumak/ui/components/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@mumak/ui/components/table';

import { FillDetails } from '@/components/fill-details';
import { StockLink } from '@/components/stock-link';
import { useTimeZone } from '@/components/time-zone-provider';
import type { DashboardFill, DashboardHolding, DashboardSnapshot } from '@/lib/dashboard-schema';
import { fillAmount, formatDecimal, formatMoney, formatPercent, valueTone } from '@/lib/format';

// recharts는 이 차트에서만 쓰이는데 엔트리 청크의 큰 부분을 차지한다.
// 별도 청크로 분리해 첫 화면(요약·보유·체결)이 먼저 그려지게 한다.
const PerformanceChart = lazy(() =>
  import('@/components/performance-chart').then(module => ({ default: module.PerformanceChart }))
);

function Panel({ className = '', ...props }: React.ComponentProps<'section'>) {
  return <section className={`border border-border bg-card ${className}`} {...props} />;
}

function SectionHeading({ kicker, children }: React.ComponentProps<'h2'> & { kicker: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-b border-border pb-3">
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
      <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">{kicker}</span>
    </div>
  );
}

function SummaryGrid({ snapshot }: { snapshot: DashboardSnapshot }) {
  const metrics = [
    ['월 시작 NAV', formatMoney(snapshot.summary.startingNav, snapshot.currency), 'neutral'],
    ['현재 NAV', formatMoney(snapshot.summary.currentNav, snapshot.currency), 'neutral'],
    ['현금', formatMoney(snapshot.summary.cash, snapshot.currency), 'neutral'],
    ['순외부입출금', formatMoney(snapshot.summary.netContributions, snapshot.currency), 'neutral'],
    ['월 손익', formatMoney(snapshot.summary.profit, snapshot.currency), valueTone(snapshot.summary.profit)],
    ['월 수익률', formatPercent(snapshot.summary.returnPct), valueTone(snapshot.summary.returnPct)],
  ] as const;

  return (
    <div className="grid border-l border-t border-border sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map(([label, value, tone]) => (
        <div key={label} className="min-w-0 border-b border-r border-border bg-card p-4 sm:p-5">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd
            className={`mt-3 overflow-hidden text-ellipsis font-mono text-xl font-semibold tabular-nums sm:text-2xl ${tone === 'neutral' ? '' : tone}`}
          >
            {value}
          </dd>
        </div>
      ))}
    </div>
  );
}

function MobileHolding({ holding, currency }: { holding: DashboardHolding; currency: string }) {
  const { formatDateTime } = useTimeZone();
  return (
    <article className="border-b border-border p-4 last:border-b-0">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h3 className="font-mono text-base font-semibold">
          <StockLink symbol={holding.symbol} />
        </h3>
        <span className={`font-mono text-sm tabular-nums ${valueTone(holding.returnPct)}`}>
          {formatPercent(holding.returnPct)}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <div>
          <dt className="text-muted-foreground">수량</dt>
          <dd className="mt-1 font-mono tabular-nums">{formatDecimal(holding.quantity)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">평균 단가</dt>
          <dd className="mt-1 font-mono tabular-nums">{formatMoney(holding.averageCost, currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">평가액</dt>
          <dd className="mt-1 font-mono tabular-nums">{formatMoney(holding.marketValue, currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">미실현 손익</dt>
          <dd className={`mt-1 font-mono tabular-nums ${valueTone(holding.unrealizedPnl)}`}>
            {formatMoney(holding.unrealizedPnl, currency)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">평가 시각</dt>
          <dd className="mt-1 font-mono tabular-nums">
            {holding.markAsOf ? formatDateTime(holding.markAsOf) : '평가 없음'}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function Holdings({ holdings, currency }: { holdings: DashboardHolding[]; currency: string }) {
  const { formatDateTime } = useTimeZone();
  if (holdings.length === 0)
    return <p className="py-12 text-center text-sm text-muted-foreground">보유 종목이 없습니다.</p>;
  return (
    <>
      <div className="md:hidden">
        {holdings.map(holding => (
          <MobileHolding key={holding.symbol} holding={holding} currency={currency} />
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>종목</TableHead>
              <TableHead className="text-right">수량</TableHead>
              <TableHead className="text-right">평균 단가</TableHead>
              <TableHead className="text-right">평가 단가</TableHead>
              <TableHead>평가 시각</TableHead>
              <TableHead className="text-right">평가액</TableHead>
              <TableHead className="text-right">미실현 손익</TableHead>
              <TableHead className="text-right">매수 후 수익률</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map(holding => (
              <TableRow key={holding.symbol}>
                <TableCell className="font-mono font-semibold">
                  <StockLink symbol={holding.symbol} />
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatDecimal(holding.quantity)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatMoney(holding.averageCost, currency)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatMoney(holding.markPrice, currency)}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {holding.markAsOf ? formatDateTime(holding.markAsOf) : '—'}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatMoney(holding.marketValue, currency)}
                </TableCell>
                <TableCell className={`text-right font-mono tabular-nums ${valueTone(holding.unrealizedPnl)}`}>
                  {formatMoney(holding.unrealizedPnl, currency)}
                </TableCell>
                <TableCell className={`text-right font-mono tabular-nums ${valueTone(holding.returnPct)}`}>
                  {formatPercent(holding.returnPct)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function MobileFill({ fill, currency }: { fill: DashboardFill; currency: string }) {
  const { formatDateTime } = useTimeZone();
  return (
    <article className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0">
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2">
        <FillDetails fill={fill} currency={currency} />
        <strong className="min-w-0 break-all font-mono text-sm">
          <StockLink symbol={fill.symbol} />
        </strong>
        <p className="text-right font-mono text-sm font-semibold tabular-nums">
          {formatMoney(fillAmount(fill), currency)}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <p className="tabular-nums">
          {formatDecimal(fill.quantity)}주 × {formatMoney(fill.price, currency)}
        </p>
        <p className="tabular-nums">수수료 {formatMoney(fill.commission, currency)}</p>
      </div>
      <time dateTime={fill.at} className="text-xs text-muted-foreground">
        {formatDateTime(fill.at)}
      </time>
    </article>
  );
}

const FILLS_PER_PAGE = 20;

function Fills({ fills, currency }: { fills: DashboardFill[]; currency: string }) {
  const { formatDateTime } = useTimeZone();
  const [page, setPage] = useState(0);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  function changePage(nextPage: number) {
    setPage(nextPage);
    summaryRef.current?.focus();
  }
  const sorted = useMemo(
    () =>
      fills.toSorted((left, right) => Date.parse(right.at) - Date.parse(left.at) || left.id.localeCompare(right.id)),
    [fills]
  );
  const pageCount = Math.ceil(sorted.length / FILLS_PER_PAGE);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const start = currentPage * FILLS_PER_PAGE;
  const visible = sorted.slice(start, start + FILLS_PER_PAGE);
  if (fills.length === 0)
    return <p className="py-12 text-center text-sm text-muted-foreground">최근 체결이 없습니다.</p>;
  return (
    <>
      <p
        ref={summaryRef}
        tabIndex={-1}
        role="status"
        className="scroll-mt-4 px-4 pb-3 text-xs text-muted-foreground focus:outline-none sm:px-6"
      >
        조회 월 전체 {fills.length}건 · 최신순 · {start + 1}–{Math.min(start + FILLS_PER_PAGE, fills.length)}건 표시
      </p>
      <div className="md:hidden">
        {visible.map(fill => (
          <MobileFill key={fill.id} fill={fill} currency={currency} />
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>구분</TableHead>
              <TableHead>종목</TableHead>
              <TableHead className="text-right">체결 금액</TableHead>
              <TableHead className="text-right">수량</TableHead>
              <TableHead className="text-right">체결 단가</TableHead>
              <TableHead className="text-right">수수료</TableHead>
              <TableHead className="text-right">체결 시각</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map(fill => (
              <TableRow key={fill.id}>
                <TableCell className="w-20">
                  <FillDetails fill={fill} currency={currency} />
                </TableCell>
                <TableCell>
                  <strong className="font-mono">
                    <StockLink symbol={fill.symbol} />
                  </strong>
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">
                  {formatMoney(fillAmount(fill), currency)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                  {formatDecimal(fill.quantity)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                  {formatMoney(fill.price, currency)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                  {formatMoney(fill.commission, currency)}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                  <time dateTime={fill.at}>{formatDateTime(fill.at)}</time>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 && (
        <nav
          aria-label="체결 내역 페이지"
          className="flex items-center justify-between gap-3 border-t border-border p-4"
        >
          <Button
            variant="outline"
            className="min-h-11"
            disabled={currentPage === 0}
            onClick={() => changePage(currentPage - 1)}
          >
            이전
          </Button>
          <span className="text-xs tabular-nums">
            {currentPage + 1} / {pageCount} 페이지
          </span>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={currentPage === pageCount - 1}
            onClick={() => changePage(currentPage + 1)}
          >
            다음
          </Button>
        </nav>
      )}
    </>
  );
}

function SnapshotDashboard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { formatDateTime } = useTimeZone();
  const delayed = Date.now() - Date.parse(snapshot.asOf) > 15 * 60 * 1000;
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 border border-border bg-muted/40 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          <span>
            실시간 시세가 아닌 저장된 운용 현황입니다.{delayed ? ' 데이터 기준 시각으로부터 15분 이상 지났습니다.' : ''}
          </span>
        </div>
        <time dateTime={snapshot.asOf} className="shrink-0 font-mono tabular-nums">
          데이터 기준 시각 {formatDateTime(snapshot.asOf)}
        </time>
      </div>
      <SummaryGrid snapshot={snapshot} />
      <Panel className="p-4 sm:p-6">
        <SectionHeading kicker="NAV / RETURN">성과 추이</SectionHeading>
        {/* 높이를 고정해 청크가 늦게 도착해도 아래 패널이 밀리지 않게 한다. */}
        <Suspense fallback={<div className="min-h-[21rem] w-full animate-pulse rounded-md bg-muted/40" />}>
          <PerformanceChart
            key={`${snapshot.mode}:${snapshot.episodeId}:${snapshot.month}`}
            history={snapshot.history}
            currency={snapshot.currency}
          />
        </Suspense>
      </Panel>
      <Panel>
        <div className="p-4 pb-0 sm:p-6 sm:pb-0">
          <SectionHeading kicker={`${snapshot.holdings.length} POSITIONS`}>보유 종목</SectionHeading>
        </div>
        <Holdings holdings={snapshot.holdings} currency={snapshot.currency} />
      </Panel>
      <Panel>
        <div className="p-4 pb-0 sm:p-6 sm:pb-0">
          <SectionHeading kicker={`${snapshot.fills.length} FILLS`}>최근 체결</SectionHeading>
        </div>
        <Fills
          key={`${snapshot.mode}:${snapshot.episodeId}:${snapshot.month}`}
          fills={snapshot.fills}
          currency={snapshot.currency}
        />
      </Panel>
      {snapshot.notes.length > 0 && (
        <Panel className="p-4 sm:p-6">
          <SectionHeading kicker="PORTFOLIO NOTES">운용 메모</SectionHeading>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {snapshot.notes.map(note => (
              <li key={note} className="before:mr-2 before:text-primary before:content-['—']">
                {note}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

export { Panel, SnapshotDashboard };
