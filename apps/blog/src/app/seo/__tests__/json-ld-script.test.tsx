import { render } from '@testing-library/react';

import { JsonLdScript } from '../json-ld-script';

describe('JsonLdScript', () => {
  it('should render a JSON-LD script tag with serialized data', () => {
    const { container } = render(<JsonLdScript data={{ '@type': 'WebSite', name: 'Wan Sim' }} />);
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script).not.toBeNull();
    expect(script?.innerHTML).toContain('"@type":"WebSite"');
    expect(script?.innerHTML).toContain('"name":"Wan Sim"');
  });

  it('should escape "<" so content cannot break out of the script context', () => {
    const { container } = render(<JsonLdScript data={{ name: '</script><img src=x onerror=alert(1)>' }} />);
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script?.innerHTML).not.toContain('</script');
    expect(script?.innerHTML).toContain('\\u003c/script');
  });
});
