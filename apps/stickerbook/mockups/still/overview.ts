// 정지 화면 시안 개요. 장면별 변형을 실제 뷰포트 크기 iframe으로 띄우고 transform으로 축소해 나란히 둔다.

import {
  decisionTitles,
  sceneHref,
  stillScenes,
  stillVariants,
  variantLabel,
  type DecisionId,
  type StillScene,
  type StillVariant,
} from './variants';

function requireElement<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (!element) {
    throw new Error(`index.html에 ${selector} 요소가 없다`);
  }
  return element;
}

function createTextElement<TagName extends keyof HTMLElementTagNameMap>(
  tagName: TagName,
  text: string,
  className?: string
): HTMLElementTagNameMap[TagName] {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) {
    element.className = className;
  }
  return element;
}

// 축소본은 실제 뷰포트 크기로 그린 뒤 틀 폭에 맞춰 줄인다. 틀 폭이 바뀌면 배율을 다시 잰다.
const frameScaleObserver = new ResizeObserver(entries => {
  for (const entry of entries) {
    const frame = entry.target;
    if (!(frame instanceof HTMLElement)) {
      continue;
    }
    const viewportWidth = Number(frame.dataset.viewportWidth);
    if (viewportWidth > 0) {
      frame.style.setProperty('--frame-scale', String(entry.contentRect.width / viewportWidth));
    }
  }
});

function createPreviewFrame(scene: StillScene, variant: StillVariant): HTMLElement {
  const frame = document.createElement('div');
  frame.className = 'frame';
  frame.dataset.viewportWidth = String(scene.viewport.width);
  frame.style.setProperty('--viewport-w', String(scene.viewport.width));
  frame.style.setProperty('--viewport-h', String(scene.viewport.height));

  // 미리보기는 보기 전용이다. 키보드 초점과 보조기기는 아래 '실제 크기로 열기' 링크로 간다.
  const iframe = document.createElement('iframe');
  iframe.src = sceneHref(variant);
  iframe.title = `${variantLabel(variant)} 축소 미리보기`;
  iframe.tabIndex = -1;
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('scrolling', 'no');

  frame.append(iframe);
  frameScaleObserver.observe(frame);
  return frame;
}

function formatDecisionIds(decisionIds: readonly DecisionId[]): string {
  return `관련 결정 ${decisionIds.join(' · ')}`;
}

function createVariantItem(scene: StillScene, variant: StillVariant): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'variant';

  const text = document.createElement('div');
  text.className = 'variant__text';

  const title = document.createElement('h3');
  title.append(createTextElement('span', variant.letter.toUpperCase(), 'variant__letter'), variant.summary);

  const link = createTextElement('a', '실제 크기로 열기', 'variant__open');
  link.href = sceneHref(variant);
  link.append(createTextElement('span', ` (${variantLabel(variant)})`, 'visually-hidden'));

  text.append(title, createTextElement('p', formatDecisionIds(variant.decisionIds), 'variant__decisions'));
  item.append(createPreviewFrame(scene, variant), text, link);
  return item;
}

function createSceneSection(scene: StillScene): HTMLElement {
  const section = document.createElement('section');
  section.className = `scene-section scene-section--${scene.id}`;
  const headingId = `scene-${scene.id}-heading`;
  section.setAttribute('aria-labelledby', headingId);

  const head = document.createElement('div');
  head.className = 'scene-section__head';
  const heading = createTextElement(
    'h2',
    `${scene.number} ${scene.title} · ${scene.viewport.width}×${scene.viewport.height}`
  );
  heading.id = headingId;
  head.append(heading, createTextElement('p', scene.note, 'overview__muted'));

  const list = document.createElement('ul');
  list.className = 'variant-list';
  for (const variant of stillVariants) {
    if (variant.sceneId === scene.id) {
      list.append(createVariantItem(scene, variant));
    }
  }

  section.append(head, list);
  return section;
}

function renderDecisionList(): void {
  const list = requireElement<HTMLDListElement>('#decision-list');
  for (const [decisionId, decisionTitle] of Object.entries(decisionTitles)) {
    list.append(createTextElement('dt', decisionId), createTextElement('dd', decisionTitle));
  }
}

function renderOverview(): void {
  requireElement<HTMLElement>('#overview-scenes').replaceChildren(...stillScenes.map(createSceneSection));
  renderDecisionList();
}

renderOverview();
