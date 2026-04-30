import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

describe('Example Test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });

  it('should render a div', () => {
    render(<div data-testid="test-div">Hello World</div>);
    const element = screen.getByTestId('test-div');
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent('Hello World');
  });
});
