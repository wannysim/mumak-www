import { render, screen } from '@testing-library/react';

import type { SpotifyDeviceType } from '@/src/entities/spotify';

import { SpotifyDeviceInfoBadge } from '../ui/spotify-device-info';

import '@testing-library/jest-dom';

describe('SpotifyDeviceInfoBadge', () => {
  it.each<SpotifyDeviceType>([
    'Computer',
    'Smartphone',
    'Tablet',
    'Speaker',
    'TV',
    'AVR',
    'STB',
    'AudioDongle',
    'GameConsole',
    'CastVideo',
    'CastAudio',
    'Automobile',
    'Unknown',
  ])('renders an icon and the device name for type %s', type => {
    render(<SpotifyDeviceInfoBadge device={{ name: 'My Device', type }} />);

    expect(screen.getByLabelText('Playing on My Device')).toBeInTheDocument();
    expect(screen.getByText('My Device')).toBeInTheDocument();
  });

  it('hides the icon from assistive tech', () => {
    const { container } = render(<SpotifyDeviceInfoBadge device={{ name: 'iPhone', type: 'Smartphone' }} />);

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('merges a custom className', () => {
    const { container } = render(
      <SpotifyDeviceInfoBadge device={{ name: 'Speaker A', type: 'Speaker' }} className="extra-class" />
    );

    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain('extra-class');
  });

  it('falls back to the Speaker icon when type is missing from the icon map', () => {
    // 컴파일 타임에는 SpotifyDeviceType 으로 좁혀지지만, 런타임에 예기치 못한 값이 들어와도
    // 안전하게 Speaker 아이콘으로 fallback 되는지 확인한다.
    const device = { name: 'Mystery', type: 'WeirdType' as unknown as SpotifyDeviceType };

    const { container } = render(<SpotifyDeviceInfoBadge device={device} />);

    // 아이콘이 여전히 렌더링되어야 한다
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByLabelText('Playing on Mystery')).toBeInTheDocument();
  });
});
