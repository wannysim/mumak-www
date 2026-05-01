import manifest from '@/app/manifest';

describe('manifest', () => {
  it('should declare the site name and short_name', () => {
    const result = manifest();

    expect(result.name).toBe('Wan Sim');
    expect(result.short_name).toBe('Wan Sim');
  });

  it('should set start_url to root', () => {
    expect(manifest().start_url).toBe('/');
  });

  it('should declare a description', () => {
    expect(manifest().description).toBeTruthy();
  });

  it('should reference the dynamic /icon route', () => {
    const result = manifest();

    expect(result.icons).toHaveLength(1);
    expect(result.icons?.[0]).toMatchObject({
      src: '/icon',
      sizes: '512x512',
      type: 'image/png',
    });
  });

  it('should declare display mode and theme/background colors', () => {
    const result = manifest();

    expect(result.display).toBe('standalone');
    expect(result.theme_color).toMatch(/^#[0-9a-fA-F]{3,6}$/);
    expect(result.background_color).toMatch(/^#[0-9a-fA-F]{3,6}$/);
  });
});
