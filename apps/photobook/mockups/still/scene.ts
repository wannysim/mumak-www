// 정지 화면 시안의 장면 하나를 해시(#<변형 id>)에 맞춰 전체 화면으로 그린다.
// 해시가 없거나 모르는 변형이면 변형 목록 링크를 보여 준다. 움직임과 상호작용은 없다.

import { findStillVariantByHash, sceneHref, stillVariants, variantLabel, type StillVariant } from './variants';

function requireElement<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (!element) {
    throw new Error(`scene.html에 ${selector} 요소가 없다`);
  }
  return element;
}

const sceneRoot = requireElement<HTMLElement>('#scene-root');
const runningHead = requireElement<HTMLElement>('.running-head');
const folio = requireElement<HTMLElement>('[data-folio]');

function cloneSceneTemplate(variant: StillVariant): DocumentFragment {
  const template = requireElement<HTMLTemplateElement>(`template[data-scene="${variant.sceneId}"]`);
  const fragment = document.importNode(template.content, true);

  for (const element of fragment.querySelectorAll<HTMLElement>('[data-variants]')) {
    const letters = (element.dataset.variants ?? '').split(/\s+/);
    if (!letters.includes(variant.letter)) {
      element.remove();
    }
  }

  return fragment;
}

function renderVariant(variant: StillVariant): void {
  sceneRoot.replaceChildren(cloneSceneTemplate(variant));
  document.documentElement.dataset.scene = variant.sceneId;
  document.documentElement.dataset.variant = variant.id;
  document.body.classList.remove('scene-page--index');
  folio.textContent = variant.folio;
  runningHead.hidden = false;
  document.title = `${variantLabel(variant)} · 정지 화면 시안`;
}

function createVariantIndex(): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'scene-index';
  nav.setAttribute('aria-labelledby', 'scene-index-heading');

  const heading = document.createElement('h1');
  heading.id = 'scene-index-heading';
  heading.textContent = '정지 화면 시안';

  const guide = document.createElement('p');
  guide.textContent = '주소 끝의 #변형이 없거나 모르는 이름이다. 아래에서 하나를 고른다.';

  const list = document.createElement('ul');
  for (const variant of stillVariants) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = sceneHref(variant);
    link.textContent = variantLabel(variant);
    item.append(link);
    list.append(item);
  }

  const overviewLink = document.createElement('a');
  overviewLink.href = './';
  overviewLink.textContent = '개요로 돌아가기';

  nav.append(heading, guide, list, overviewLink);
  return nav;
}

function renderVariantIndex(): void {
  sceneRoot.replaceChildren(createVariantIndex());
  delete document.documentElement.dataset.scene;
  delete document.documentElement.dataset.variant;
  document.body.classList.add('scene-page--index');
  runningHead.hidden = true;
  document.title = '정지 화면 시안';
}

function renderFromHash(): void {
  const variant = findStillVariantByHash(window.location.hash);
  if (variant) {
    renderVariant(variant);
  } else {
    renderVariantIndex();
  }
}

window.addEventListener('hashchange', renderFromHash);
renderFromHash();
