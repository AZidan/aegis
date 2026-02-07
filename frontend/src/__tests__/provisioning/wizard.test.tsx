import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WizardStepper } from '@/components/admin/provisioning/wizard-stepper';
import {
  step1Schema,
  step2Schema,
} from '@/lib/validations/provisioning';

// ---------------------------------------------------------------------------
// Mock lucide-react icons (they're SVGs that can cause issues in jsdom)
// ---------------------------------------------------------------------------

jest.mock('lucide-react', () => ({
  Check: () => <svg data-testid="check-icon" />,
  ChevronLeft: () => <svg data-testid="chevron-left" />,
  ChevronRight: () => <svg data-testid="chevron-right" />,
  Copy: () => <svg data-testid="copy-icon" />,
  CheckCircle2: () => <svg data-testid="check-circle-icon" />,
  Loader2: () => <svg data-testid="loader-icon" />,
  Plus: () => <svg data-testid="plus-icon" />,
  AlertCircle: () => <svg data-testid="alert-icon" />,
}));

// ---------------------------------------------------------------------------
// WizardStepper Tests
// ---------------------------------------------------------------------------

const steps = [
  { number: 1, label: 'Company Details' },
  { number: 2, label: 'Plan & Limits' },
  { number: 3, label: 'Provision' },
];

describe('WizardStepper', () => {
  it('should render all step labels', () => {
    render(
      <WizardStepper steps={steps} currentStep={1} />
    );

    expect(screen.getByText('Company Details')).toBeInTheDocument();
    expect(screen.getByText('Plan & Limits')).toBeInTheDocument();
    expect(screen.getByText('Provision')).toBeInTheDocument();
  });

  it('should show step 1 as active when currentStep is 1', () => {
    render(
      <WizardStepper steps={steps} currentStep={1} />
    );

    const step1Circle = screen.getByTestId('step-circle-1');
    expect(step1Circle).toHaveTextContent('1');
    expect(step1Circle.className).toContain('bg-primary-500');
  });

  it('should show step 1 as completed and step 2 as active when currentStep is 2', () => {
    render(
      <WizardStepper steps={steps} currentStep={2} />
    );

    // Step 1 should have a check icon (completed)
    const step1Circle = screen.getByTestId('step-circle-1');
    expect(step1Circle.className).toContain('bg-primary-500');
    expect(step1Circle.querySelector('[data-testid="check-icon"]')).toBeTruthy();

    // Step 2 should show number 2 (active)
    const step2Circle = screen.getByTestId('step-circle-2');
    expect(step2Circle).toHaveTextContent('2');
    expect(step2Circle.className).toContain('bg-primary-500');
  });

  it('should show step 3 as pending when currentStep is 1', () => {
    render(
      <WizardStepper steps={steps} currentStep={1} />
    );

    const step3Circle = screen.getByTestId('step-circle-3');
    expect(step3Circle.className).toContain('bg-neutral-200');
  });

  it('should call onStepClick when clicking a completed step', async () => {
    const user = userEvent.setup();
    const onStepClick = jest.fn();

    render(
      <WizardStepper
        steps={steps}
        currentStep={3}
        onStepClick={onStepClick}
      />
    );

    // Step 1 is completed, should be clickable
    const step1Circle = screen.getByTestId('step-circle-1');
    await user.click(step1Circle);

    expect(onStepClick).toHaveBeenCalledWith(1);
  });

  it('should not call onStepClick when clicking the active step', async () => {
    const user = userEvent.setup();
    const onStepClick = jest.fn();

    render(
      <WizardStepper
        steps={steps}
        currentStep={2}
        onStepClick={onStepClick}
      />
    );

    // Step 2 is active, should not be clickable
    const step2Circle = screen.getByTestId('step-circle-2');
    await user.click(step2Circle);

    expect(onStepClick).not.toHaveBeenCalled();
  });

  it('should not call onStepClick when clicking a pending step', async () => {
    const user = userEvent.setup();
    const onStepClick = jest.fn();

    render(
      <WizardStepper
        steps={steps}
        currentStep={1}
        onStepClick={onStepClick}
      />
    );

    // Step 3 is pending, should not be clickable
    const step3Circle = screen.getByTestId('step-circle-3');
    await user.click(step3Circle);

    expect(onStepClick).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Validation Schema Tests
// ---------------------------------------------------------------------------

describe('Step 1 Validation', () => {
  it('should pass with valid data', () => {
    const result = step1Schema.safeParse({
      companyName: 'Acme Corp',
      adminEmail: 'admin@acme.com',
      deploymentRegion: 'us-east-1',
    });

    expect(result.success).toBe(true);
  });

  it('should fail if company name is too short', () => {
    const result = step1Schema.safeParse({
      companyName: 'Ab',
      adminEmail: 'admin@acme.com',
      deploymentRegion: 'us-east-1',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('companyName');
    }
  });

  it('should fail if company name is missing', () => {
    const result = step1Schema.safeParse({
      companyName: '',
      adminEmail: 'admin@acme.com',
      deploymentRegion: 'us-east-1',
    });

    expect(result.success).toBe(false);
  });

  it('should fail if admin email is invalid', () => {
    const result = step1Schema.safeParse({
      companyName: 'Acme Corp',
      adminEmail: 'not-an-email',
      deploymentRegion: 'us-east-1',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('adminEmail');
    }
  });

  it('should fail if deployment region is empty', () => {
    const result = step1Schema.safeParse({
      companyName: 'Acme Corp',
      adminEmail: 'admin@acme.com',
      deploymentRegion: '',
    });

    expect(result.success).toBe(false);
  });

  it('should allow optional fields to be omitted', () => {
    const result = step1Schema.safeParse({
      companyName: 'Acme Corp',
      adminEmail: 'admin@acme.com',
      deploymentRegion: 'us-east-1',
    });

    expect(result.success).toBe(true);
  });

  it('should fail if notes exceed 500 characters', () => {
    const result = step1Schema.safeParse({
      companyName: 'Acme Corp',
      adminEmail: 'admin@acme.com',
      deploymentRegion: 'us-east-1',
      notes: 'x'.repeat(501),
    });

    expect(result.success).toBe(false);
  });
});

describe('Step 2 Validation', () => {
  it('should pass with valid data', () => {
    const result = step2Schema.safeParse({
      plan: 'growth',
      billingCycle: 'monthly',
      maxAgents: 10,
      maxSkills: 25,
      storageLimitGb: 100,
    });

    expect(result.success).toBe(true);
  });

  it('should fail with invalid plan', () => {
    const result = step2Schema.safeParse({
      plan: 'invalid_plan',
      billingCycle: 'monthly',
      maxAgents: 10,
      maxSkills: 25,
      storageLimitGb: 100,
    });

    expect(result.success).toBe(false);
  });

  it('should fail with invalid billing cycle', () => {
    const result = step2Schema.safeParse({
      plan: 'growth',
      billingCycle: 'weekly',
      maxAgents: 10,
      maxSkills: 25,
      storageLimitGb: 100,
    });

    expect(result.success).toBe(false);
  });

  it('should accept all valid plan values', () => {
    for (const plan of ['starter', 'growth', 'enterprise']) {
      const result = step2Schema.safeParse({
        plan,
        billingCycle: 'monthly',
        maxAgents: 10,
        maxSkills: 25,
        storageLimitGb: 100,
      });
      expect(result.success).toBe(true);
    }
  });
});
