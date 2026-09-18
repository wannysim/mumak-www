type MdxNode = {
  type: string;
  name?: string | null;
  alt?: string | null;
  attributes?: { type?: string; name?: string; value?: unknown }[];
  children?: MdxNode[];
};

function isDecorativeImage(node: MdxNode): boolean {
  if (['image', 'imageReference'].includes(node.type)) return !node.alt;

  return Boolean(
    node.attributes?.some(
      attribute =>
        (attribute.name === 'alt' && attribute.value === '') ||
        (attribute.name === 'role' && ['presentation', 'none'].includes(String(attribute.value))) ||
        (attribute.name === 'aria-hidden' && attribute.value === 'true')
    )
  );
}

function stringAttribute(node: MdxNode | undefined, name: string): string | undefined {
  const value = node?.attributes?.find(attribute => attribute.name === name)?.value;
  return typeof value === 'string' ? value : undefined;
}

function optimizePicture(picture: MdxNode, image: MdxNode | undefined): MdxNode {
  const src = stringAttribute(image, 'src');
  const source = picture.children?.find(child => child.name === 'source');
  const webp = stringAttribute(source, 'srcSet');
  const hasDimensions = ['width', 'height'].every(name => /^[1-9]\d*$/.test(stringAttribute(image, name) ?? ''));

  if (
    !image ||
    !hasDimensions ||
    !src ||
    picture.attributes?.length ||
    !/^https:\/\/img\.wannysim\.com\/blog\/[0-9a-f]{64}\/content-v[1-9]\d*\/image\.jpg$/.test(src) ||
    webp !== src.replace(/\.jpg$/, '.webp') ||
    stringAttribute(source, 'type') !== 'image/webp' ||
    source?.attributes?.some(attribute => !['type', 'srcSet'].includes(attribute.name ?? '')) ||
    picture.children?.filter(child => child.name).length !== 2
  ) {
    return picture;
  }

  return {
    type: picture.type,
    name: 'ContentImage',
    attributes: [...(image.attributes ?? []), { type: 'mdxJsxAttribute', name: 'zoomSrc', value: webp }],
    children: [],
  };
}

export function remarkContentImages() {
  function transform(node: MdxNode, zoomAllowed = true): void {
    if (!node.children) return;

    const canZoom =
      zoomAllowed &&
      !['link', 'linkReference'].includes(node.type) &&
      !['a', 'button', 'ImageZoom'].includes(node.name ?? '');

    node.children = node.children.map(child => {
      const isPicture = child.name === 'picture';
      const image = isPicture ? child.children?.find(node => node.name === 'img') : child;
      const isImage = ['image', 'imageReference'].includes(child.type) || child.name === 'img';

      if (isPicture || isImage) {
        const content = isPicture ? optimizePicture(child, image) : child;
        if (!canZoom || !image || isDecorativeImage(image)) return content;

        return {
          type: child.type === 'mdxJsxFlowElement' ? 'mdxJsxFlowElement' : 'mdxJsxTextElement',
          name: 'ImageZoom',
          attributes: [],
          children: [content],
        };
      }

      transform(child, canZoom);
      return child;
    });
  }

  return (tree: MdxNode) => transform(tree);
}
