/** @jest-environment node */

import { remarkContentImages } from '../remark-content-images';

type MdxNode = Parameters<ReturnType<typeof remarkContentImages>>[0];

const photo = (): MdxNode => ({
  type: 'mdxJsxFlowElement',
  name: 'img',
  attributes: [
    { name: 'src', value: 'photo.jpg' },
    { name: 'alt', value: 'A garden' },
  ],
});

describe('remarkContentImages', () => {
  const managedPicture = (): MdxNode => ({
    type: 'mdxJsxFlowElement',
    name: 'picture',
    children: [
      {
        type: 'mdxJsxFlowElement',
        name: 'source',
        attributes: [
          { name: 'type', value: 'image/webp' },
          { name: 'srcSet', value: `https://img.wannysim.com/blog/${'a'.repeat(64)}/content-v1/image.webp` },
        ],
      },
      {
        ...photo(),
        attributes: [
          { name: 'src', value: `https://img.wannysim.com/blog/${'a'.repeat(64)}/content-v1/image.jpg` },
          { name: 'alt', value: 'A garden' },
          { name: 'width', value: '1600' },
          { name: 'height', value: '1067' },
          { name: 'loading', value: 'lazy' },
        ],
      },
    ],
  });

  it('optimizes the published picture contract while preserving dimensions, alt and a full zoom source', () => {
    const tree: MdxNode = { type: 'root', children: [managedPicture()] };
    remarkContentImages()(tree);
    const optimized = tree.children?.[0]?.children?.[0];
    expect(tree.children?.[0]?.name).toBe('ImageZoom');
    expect(optimized?.name).toBe('ContentImage');
    expect(optimized?.attributes).toEqual(
      expect.arrayContaining([
        { name: 'width', value: '1600' },
        { name: 'height', value: '1067' },
        { name: 'alt', value: 'A garden' },
        { name: 'loading', value: 'lazy' },
        {
          type: 'mdxJsxAttribute',
          name: 'zoomSrc',
          value: `https://img.wannysim.com/blog/${'a'.repeat(64)}/content-v1/image.webp`,
        },
      ])
    );
  });

  it('optimizes linked and decorative pictures without adding a zoom button', () => {
    const decorative = managedPicture();
    decorative.children?.[1]?.attributes?.push({ name: 'role', value: 'presentation' });
    const tree: MdxNode = { type: 'root', children: [{ type: 'link', children: [managedPicture()] }, decorative] };
    remarkContentImages()(tree);
    expect(tree.children?.[0]?.children?.[0]?.name).toBe('ContentImage');
    expect(tree.children?.[1]?.name).toBe('ContentImage');
  });

  it('preserves native pictures with custom layout or missing intrinsic dimensions', () => {
    const styled = managedPicture();
    styled.attributes = [{ name: 'className', value: 'custom-layout' }];
    const responsive = managedPicture();
    responsive.children?.[0]?.attributes?.push({ name: 'media', value: '(min-width: 640px)' });
    const missingDimensions = managedPicture();
    if (missingDimensions.children?.[1]) {
      missingDimensions.children[1].attributes = missingDimensions.children[1].attributes?.filter(
        attribute => attribute.name !== 'width'
      );
    }
    const tree: MdxNode = { type: 'root', children: [styled, responsive, missingDimensions] };
    remarkContentImages()(tree);
    expect(tree.children?.map(child => child.children?.[0]?.name)).toEqual(['picture', 'picture', 'picture']);
  });

  it('wraps a complete picture once, preserving source order and native image props', () => {
    const picture: MdxNode = {
      type: 'mdxJsxFlowElement',
      name: 'picture',
      children: [
        { type: 'mdxJsxFlowElement', name: 'source', attributes: [{ name: 'srcSet', value: 'photo.webp' }] },
        photo(),
      ],
    };
    const tree: MdxNode = { type: 'root', children: [picture] };

    remarkContentImages()(tree);

    expect(tree.children).toEqual([
      { type: 'mdxJsxFlowElement', name: 'ImageZoom', attributes: [], children: [picture] },
    ]);
    expect(picture.children?.map(child => child.name)).toEqual(['source', 'img']);
  });

  it.each(['image', 'imageReference'])('keeps %s and inline JSX images inside their paragraph', type => {
    const images: MdxNode[] = [
      { type, alt: 'A garden' },
      { ...photo(), type: 'mdxJsxTextElement' },
    ];
    const tree: MdxNode = { type: 'root', children: [{ type: 'paragraph', children: images }] };

    remarkContentImages()(tree);

    expect(tree.children?.[0]?.children).toEqual(
      images.map(image => ({ type: 'mdxJsxTextElement', name: 'ImageZoom', attributes: [], children: [image] }))
    );
  });

  it.each(['link', 'linkReference', 'a', 'button', 'ImageZoom'])(
    'preserves images already inside %s without nesting interactive elements',
    kind => {
      const container: MdxNode = { type: kind, name: kind, children: [photo()] };
      const tree: MdxNode = { type: 'root', children: [container] };
      const original = structuredClone(tree);

      remarkContentImages()(tree);

      expect(tree).toEqual(original);
    }
  );

  it('leaves decorative images and code examples alone', () => {
    const tree: MdxNode = {
      type: 'root',
      children: [
        { type: 'image', alt: '' },
        { type: 'imageReference', alt: '' },
        { ...photo(), attributes: [{ name: 'alt', value: '' }] },
        { ...photo(), attributes: [{ name: 'role', value: 'presentation' }] },
        { ...photo(), attributes: [{ name: 'aria-hidden', value: 'true' }] },
        {
          type: 'mdxJsxFlowElement',
          name: 'picture',
          children: [{ ...photo(), attributes: [{ name: 'alt', value: '' }] }],
        },
        { type: 'code' },
        { type: 'inlineCode' },
      ],
    };
    const original = structuredClone(tree);

    remarkContentImages()(tree);

    expect(tree).toEqual(original);
  });
});
