const MARKDOWN_IMAGE_PATTERN = /(?:^|[^\\])(?:\\\\)*!\[(?!\[)/;
const PICTURE_BLOCK_PATTERN = /<picture\b[^>]*>[\s\S]*?<\/picture\s*>/g;
const IMAGE_ELEMENT_PATTERN = /<\/?(?:picture|source|img|image)\b[^>]*>/i;
const ASSET_URL_PATTERN =
  /^https:\/\/img\.wannysim\.com\/blog\/([0-9a-f]{64})\/(content-v[1-9]\d*)\/image\.(jpg|webp)$/;

function stripInlineCode(content) {
  let cursor = 0;
  let result = '';

  while (cursor < content.length) {
    const opening = /`+/.exec(content.slice(cursor));
    if (!opening) return result + content.slice(cursor);

    const openingStart = cursor + opening.index;
    const openingEnd = openingStart + opening[0].length;
    const closingRuns = content.slice(openingEnd).matchAll(/`+/g);
    const closing = [...closingRuns].find(match => match[0].length === opening[0].length);

    if (!closing) return result + content.slice(cursor);

    const closingEnd = openingEnd + closing.index + closing[0].length;
    result += content.slice(cursor, openingStart) + ' '.repeat(closingEnd - openingStart);
    cursor = closingEnd;
  }

  return result;
}

function stripCodeSamples(content) {
  let fence;

  const withoutFences = content
    .split('\n')
    .map(line => {
      if (fence) {
        const closing = line.match(/^\s*(?:>\s*)*(`{3,}|~{3,})\s*$/);
        if (closing && closing[1][0] === fence.marker && closing[1].length >= fence.length) {
          fence = undefined;
        }
        return '';
      }

      const opening = line.match(/^\s*(?:>\s*)*(`{3,}|~{3,})/);
      if (opening) {
        fence = { marker: opening[1][0], length: opening[1].length };
        return '';
      }

      return line;
    })
    .join('\n');

  return stripInlineCode(withoutFences);
}

function parseAttributes(rawAttributes) {
  const attributes = new Map();
  const attributePattern = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
  let cursor = 0;

  while (cursor < rawAttributes.length) {
    while (/\s/.test(rawAttributes[cursor] ?? '')) cursor += 1;
    if (cursor === rawAttributes.length) break;

    attributePattern.lastIndex = cursor;
    const match = attributePattern.exec(rawAttributes);
    if (!match) return null;

    const name = match[1].toLowerCase();
    if (attributes.has(name)) return null;
    attributes.set(name, match[2] ?? match[3] ?? '');
    cursor = attributePattern.lastIndex;
  }

  return attributes;
}

function parseAssetUrl(value, expectedExtension) {
  const match = value?.match(ASSET_URL_PATTERN);
  if (!match || match[3] !== expectedExtension) return null;
  return { hash: match[1], version: match[2] };
}

function validatePicture(block) {
  const errors = [];
  const body = block.replace(/^<picture\b[^>]*>/, '').replace(/<\/picture\s*>$/, '');
  const children = body.match(/^\s*<source\b([^>]*)\/>\s*<img\b([^>]*)\/>\s*$/);

  if (!children) {
    return ['<picture>에는 lowercase WebP <source />와 JPEG <img />만 순서대로 있어야 합니다.'];
  }

  const source = parseAttributes(children[1]);
  const image = parseAttributes(children[2]);
  if (!source || !image) return ['이미지 속성은 중복 없이 따옴표 문자열로 작성해야 합니다.'];

  const sourceAttributes = new Set(['type', 'srcset']);
  const imageAttributes = new Set([
    'src',
    'alt',
    'width',
    'height',
    'loading',
    'decoding',
    'fetchpriority',
    'role',
    'aria-hidden',
  ]);
  if ([...source.keys()].some(name => !sourceAttributes.has(name))) {
    errors.push('<source>에는 type과 srcSet만 사용할 수 있습니다.');
  }
  if ([...image.keys()].some(name => !imageAttributes.has(name))) {
    errors.push('<img>에는 검증된 native image 속성만 사용할 수 있습니다.');
  }

  if (source.get('type') !== 'image/webp') {
    errors.push('<source> type은 "image/webp"여야 합니다.');
  }

  const webp = parseAssetUrl(source.get('srcset'), 'webp');
  const jpeg = parseAssetUrl(image.get('src'), 'jpg');
  if (!webp || !jpeg) {
    errors.push('이미지 URL은 img.wannysim.com의 full lowercase SHA-256 content-vN 경로여야 합니다.');
  } else if (webp.hash !== jpeg.hash || webp.version !== jpeg.version) {
    errors.push('WebP와 JPEG URL은 같은 hash와 version을 사용해야 합니다.');
  }

  for (const dimension of ['width', 'height']) {
    if (!/^[1-9]\d*$/.test(image.get(dimension) ?? '')) {
      errors.push(`<img> ${dimension}는 양의 정수여야 합니다.`);
    }
  }

  const alt = image.get('alt');
  const isDecorative = alt === '' && image.get('role') === 'presentation' && image.get('aria-hidden') === 'true';
  const hidesMeaningfulAlt =
    alt?.trim() && (image.get('role') === 'presentation' || image.get('aria-hidden') === 'true');

  if (alt === undefined || (!alt.trim() && !isDecorative)) {
    errors.push('의미 있는 alt 또는 alt="" + role="presentation" + aria-hidden="true"가 필요합니다.');
  } else if (hidesMeaningfulAlt) {
    errors.push('의미 있는 alt가 있는 이미지를 presentation/aria-hidden으로 숨길 수 없습니다.');
  }

  return errors;
}

export function validateContentImages(content) {
  const errors = [];
  const withoutCode = stripCodeSamples(content);

  if (MARKDOWN_IMAGE_PATTERN.test(withoutCode)) {
    errors.push('Markdown 이미지 문법은 허용하지 않습니다. lowercase <picture>를 사용하세요.');
  }

  const withoutPictures = withoutCode.replace(PICTURE_BLOCK_PATTERN, block => {
    errors.push(...validatePicture(block));
    return '';
  });

  if (IMAGE_ELEMENT_PATTERN.test(withoutPictures)) {
    errors.push('이미지는 lowercase <picture> 안의 WebP <source /> + JPEG <img />로 작성해야 합니다.');
  }

  return errors;
}
