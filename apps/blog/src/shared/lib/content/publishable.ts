const isProduction = () => process.env.NODE_ENV === 'production';

const isE2eIncludeDraft = () => process.env.E2E_INCLUDE_DRAFT === 'true' || process.env.E2E_INCLUDE_DRAFT === '1';

export function isPublishable(content: { draft?: boolean }): boolean {
  return !isProduction() || isE2eIncludeDraft() || !content.draft;
}
