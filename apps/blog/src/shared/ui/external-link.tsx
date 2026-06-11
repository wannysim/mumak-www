import * as React from 'react';

import { EXTERNAL_LINK_REL } from '@/src/shared/lib/url';

/**
 * Anchor for links that leave the site. Always opens in a new tab and pins the
 * safe `rel`, so hand-authored external links never regress on those.
 */
export function ExternalLink({ children, ...props }: React.ComponentProps<'a'>) {
  return (
    <a data-slot="external-link" {...props} target="_blank" rel={EXTERNAL_LINK_REL}>
      {children}
    </a>
  );
}
