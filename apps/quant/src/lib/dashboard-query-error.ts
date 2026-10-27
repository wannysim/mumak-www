type QueryErrorKind = 'access' | 'schema' | 'transport';

class DashboardQueryError extends Error {
  constructor(readonly kind: QueryErrorKind) {
    super('운용 내역 조회 실패');
    this.name = 'DashboardQueryError';
  }
}

export { DashboardQueryError, type QueryErrorKind };
