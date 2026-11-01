import type { Page } from '@playwright/test';

import { emptyCloudProgress, type CloudProgress, type ProgressWrite } from '../lib/cloud-progress';

export function cloudFixture() {
  let document = emptyCloudProgress();
  let offline = false;
  let dropAcknowledgement = false;
  return {
    get document(): CloudProgress {
      return document;
    },
    set offline(value: boolean) {
      offline = value;
    },
    loseNextAcknowledgement() {
      dropAcknowledgement = true;
    },
    async attach(page: Page) {
      await page.route('**/api/progress', async route => {
        if (offline) return route.abort();
        let status = 200;
        if (route.request().method() === 'PUT') {
          const write = route.request().postDataJSON() as ProgressWrite;
          if (document.revision === write.revision) {
            // Retry of a committed request is idempotent.
          } else if (document.revision !== write.baseRevision) status = 409;
          else document = { revision: write.revision, progress: write.progress };
          if (dropAcknowledgement) {
            dropAcknowledgement = false;
            return route.abort();
          }
        }
        return route.fulfill({ status, json: document });
      });
    },
  };
}
