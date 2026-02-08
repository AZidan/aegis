import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatsCard, ProgressRing, Trend } from '@/components/dashboard/stats-card';

// ---------------------------------------------------------------------------
// StatsCard
// ---------------------------------------------------------------------------

describe('StatsCard', () => {
  it('should render the title text', () => {
    render(
      <StatsCard title="Active Agents">
        <p>3</p>
      </StatsCard>
    );
    expect(screen.getByText('Active Agents')).toBeInTheDocument();
  });

  it('should render children content', () => {
    render(
      <StatsCard title="Messages">
        <p>847</p>
      </StatsCard>
    );
    expect(screen.getByText('847')).toBeInTheDocument();
  });

  it('should render footer text when provided', () => {
    render(
      <StatsCard title="Active Agents" footer="2 slots remaining on Pro plan">
        <p>3</p>
      </StatsCard>
    );
    expect(screen.getByText('2 slots remaining on Pro plan')).toBeInTheDocument();
  });

  it('should not render footer when not provided', () => {
    const { container } = render(
      <StatsCard title="Active Agents">
        <p>3</p>
      </StatsCard>
    );
    // Footer paragraph has specific class text-[11px]
    const footerElements = container.querySelectorAll('p.mt-3');
    expect(footerElements.length).toBe(0);
  });

  it('should render rightContent when provided', () => {
    render(
      <StatsCard
        title="Active Agents"
        rightContent={<span data-testid="ring">Ring</span>}
      >
        <p>3</p>
      </StatsCard>
    );
    expect(screen.getByTestId('ring')).toBeInTheDocument();
  });

  it('should not render rightContent wrapper when not provided', () => {
    const { container } = render(
      <StatsCard title="Test">
        <p>Value</p>
      </StatsCard>
    );
    // The wrapper div only renders when rightContent is truthy
    const flexContainer = container.querySelector('.flex.items-center.justify-between');
    expect(flexContainer).toBeTruthy();
    // Should have exactly 1 child div (the left side only)
    expect(flexContainer?.children.length).toBe(1);
  });

  it('should apply custom className', () => {
    const { container } = render(
      <StatsCard title="Test" className="custom-class">
        <p>Value</p>
      </StatsCard>
    );
    const card = container.firstElementChild;
    expect(card?.className).toContain('custom-class');
  });
});

// ---------------------------------------------------------------------------
// ProgressRing
// ---------------------------------------------------------------------------

describe('ProgressRing', () => {
  it('should display the percentage value', () => {
    render(<ProgressRing value={3} max={5} />);
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('should display 0% when max is 0', () => {
    render(<ProgressRing value={0} max={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should display 100% when value equals max', () => {
    render(<ProgressRing value={5} max={5} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('should render an SVG element', () => {
    const { container } = render(<ProgressRing value={3} max={5} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('should render two circle elements for track and progress', () => {
    const { container } = render(<ProgressRing value={3} max={5} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });

  it('should apply custom size', () => {
    const { container } = render(<ProgressRing value={3} max={5} size={64} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe('64px');
    expect(wrapper.style.height).toBe('64px');
  });
});

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

describe('Trend', () => {
  it('should display the absolute value and label', () => {
    render(<Trend value={12} label="vs yesterday" />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('vs yesterday')).toBeInTheDocument();
  });

  it('should apply emerald color class for positive values', () => {
    const { container } = render(<Trend value={12} label="vs yesterday" />);
    const trendSpan = container.querySelector('.text-emerald-600');
    expect(trendSpan).toBeTruthy();
  });

  it('should apply red color class for negative values', () => {
    const { container } = render(<Trend value={-5} label="vs yesterday" />);
    const trendSpan = container.querySelector('.text-red-600');
    expect(trendSpan).toBeTruthy();
  });

  it('should display the suffix when provided', () => {
    const { container } = render(<Trend value={12} label="vs yesterday" suffix="%" />);
    // The value "12" and suffix "%" are rendered as adjacent text nodes
    // inside the same parent span with font-semibold class
    const trendSpan = container.querySelector('.font-semibold');
    expect(trendSpan?.textContent).toContain('12');
    expect(trendSpan?.textContent).toContain('%');
  });

  it('should display the absolute value for negative numbers', () => {
    render(<Trend value={-8} label="vs last week" />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});
