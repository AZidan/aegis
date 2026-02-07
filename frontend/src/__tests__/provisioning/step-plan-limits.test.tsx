import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepPlanLimits } from '@/components/admin/provisioning/step-plan-limits';
import type { Step2FormData } from '@/lib/validations/provisioning';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultData(): Step2FormData {
  return {
    plan: 'growth',
    billingCycle: 'monthly',
    maxAgents: 10,
    maxSkills: 25,
    storageLimitGb: 100,
  };
}

function renderStep(overrides?: Partial<Step2FormData>) {
  const data = { ...defaultData(), ...overrides };
  const onChange = jest.fn();
  const { rerender } = render(
    <StepPlanLimits data={data} onChange={onChange} />
  );
  return { onChange, rerender, data };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StepPlanLimits', () => {
  it('should render all three plan cards', () => {
    renderStep();

    expect(screen.getByTestId('plan-card-starter')).toBeInTheDocument();
    expect(screen.getByTestId('plan-card-growth')).toBeInTheDocument();
    expect(screen.getByTestId('plan-card-enterprise')).toBeInTheDocument();
  });

  it('should show the "Popular" badge on the Pro plan card', () => {
    renderStep();

    expect(screen.getByText('Popular')).toBeInTheDocument();
  });

  it('should call onChange when selecting a different plan', async () => {
    const user = userEvent.setup();
    const { onChange } = renderStep();

    const starterCard = screen.getByTestId('plan-card-starter');
    await user.click(starterCard);

    expect(onChange).toHaveBeenCalledWith('plan', 'starter');
  });

  it('should render plan prices in monthly mode', () => {
    renderStep({ billingCycle: 'monthly' });

    expect(screen.getByText('$99')).toBeInTheDocument();
    expect(screen.getByText('$299')).toBeInTheDocument();
    expect(screen.getByText('$799')).toBeInTheDocument();
  });

  it('should render plan prices in annual mode', () => {
    renderStep({ billingCycle: 'annual' });

    expect(screen.getByText('$79')).toBeInTheDocument();
    expect(screen.getByText('$239')).toBeInTheDocument();
    expect(screen.getByText('$639')).toBeInTheDocument();
  });

  it('should render the billing cycle toggle', () => {
    renderStep();

    expect(screen.getByTestId('billing-toggle')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Annual')).toBeInTheDocument();
    expect(screen.getByText('Save 20%')).toBeInTheDocument();
  });

  it('should call onChange when toggling billing cycle', async () => {
    const user = userEvent.setup();
    const { onChange } = renderStep({ billingCycle: 'monthly' });

    const toggle = screen.getByTestId('billing-toggle');
    await user.click(toggle);

    expect(onChange).toHaveBeenCalledWith('billingCycle', 'annual');
  });

  it('should render agent slider with correct value', () => {
    renderStep({ maxAgents: 7 });

    const slider = screen.getByTestId('agent-slider');
    expect(slider).toHaveValue('7');
  });

  it('should render skill slider with correct value', () => {
    renderStep({ maxSkills: 50 });

    const slider = screen.getByTestId('skill-slider');
    expect(slider).toHaveValue('50');
  });

  it('should call onChange when agent slider changes', () => {
    const { onChange } = renderStep();

    const slider = screen.getByTestId('agent-slider');
    fireEvent.change(slider, { target: { value: '5' } });

    expect(onChange).toHaveBeenCalledWith('maxAgents', 5);
  });

  it('should call onChange when skill slider changes', () => {
    const { onChange } = renderStep();

    const slider = screen.getByTestId('skill-slider');
    fireEvent.change(slider, { target: { value: '100' } });

    expect(onChange).toHaveBeenCalledWith('maxSkills', 100);
  });

  it('should render storage limit dropdown', () => {
    renderStep();

    expect(screen.getByLabelText(/storage limit/i)).toBeInTheDocument();
  });

  it('should render section headings', () => {
    renderStep();

    expect(screen.getByText('Select a Plan')).toBeInTheDocument();
    expect(screen.getByText('Resource Limits')).toBeInTheDocument();
    expect(screen.getByText('Billing Cycle')).toBeInTheDocument();
  });

  it('should show feature list items in plan cards', () => {
    renderStep();

    // Check for agent limits in cards - use getAllByText for values that appear in sliders too
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Unlimited')).toBeInTheDocument();
  });
});
