import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WizardStepper } from '@/components/dashboard/agents/agent-wizard/wizard-stepper';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('lucide-react', () => ({
  Check: () => <svg data-testid="check-icon" />,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WizardStepper', () => {
  // -----------------------------------------------------------------------
  // Step Labels
  // -----------------------------------------------------------------------

  describe('Step Labels', () => {
    it('should render all 5 step labels', () => {
      render(<WizardStepper currentStep={1} />);

      expect(screen.getByText('Basic Info')).toBeInTheDocument();
      expect(screen.getByText('Model & Config')).toBeInTheDocument();
      expect(screen.getByText('Tool Policy')).toBeInTheDocument();
      expect(screen.getByText(/Channels/)).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Active Step Highlighting
  // -----------------------------------------------------------------------

  describe('Active Step Highlighting', () => {
    it('should display step number for the current step', () => {
      render(<WizardStepper currentStep={1} />);
      // Step 1 should show "1" as text
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should apply primary background to current step circle', () => {
      const { container } = render(<WizardStepper currentStep={2} />);
      // All step circles are rendered as divs with rounded-full
      const circles = container.querySelectorAll('.rounded-full.flex.items-center');
      // Step 2 (index 1) should have primary background
      expect(circles[1]?.className).toContain('bg-primary-500');
    });

    it('should apply neutral background to future steps', () => {
      const { container } = render(<WizardStepper currentStep={1} />);
      const circles = container.querySelectorAll('.rounded-full.flex.items-center');
      // Steps 2-5 (indices 1-4) should have neutral background
      expect(circles[1]?.className).toContain('bg-neutral-100');
      expect(circles[4]?.className).toContain('bg-neutral-100');
    });
  });

  // -----------------------------------------------------------------------
  // Completed Steps
  // -----------------------------------------------------------------------

  describe('Completed Steps', () => {
    it('should render check icon for completed steps', () => {
      render(<WizardStepper currentStep={3} />);
      // Steps 1 and 2 should be completed (show check icon)
      const checkIcons = screen.getAllByTestId('check-icon');
      expect(checkIcons.length).toBe(2);
    });

    it('should apply primary background to completed step circles', () => {
      const { container } = render(<WizardStepper currentStep={3} />);
      const circles = container.querySelectorAll('.rounded-full.flex.items-center');
      // Steps 1 and 2 (completed) should have primary bg
      expect(circles[0]?.className).toContain('bg-primary-500');
      expect(circles[1]?.className).toContain('bg-primary-500');
    });

    it('should not render step numbers for completed steps', () => {
      render(<WizardStepper currentStep={4} />);
      // Steps 1, 2, 3 are completed; step 4 shows "4"; step 5 shows "5"
      expect(screen.queryByText('1')).not.toBeInTheDocument();
      expect(screen.queryByText('2')).not.toBeInTheDocument();
      expect(screen.queryByText('3')).not.toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Step Click Navigation
  // -----------------------------------------------------------------------

  describe('Step Click Navigation', () => {
    it('should call onStepClick when a completed step is clicked', async () => {
      const user = userEvent.setup();
      const onStepClick = jest.fn();

      render(<WizardStepper currentStep={3} onStepClick={onStepClick} />);

      // Step 1 is completed, click it
      const step1Label = screen.getByText('Basic Info');
      const step1Container = step1Label.closest('[class*="cursor-pointer"]');
      if (step1Container) {
        await user.click(step1Container);
      }

      expect(onStepClick).toHaveBeenCalledWith(1);
    });

    it('should call onStepClick when the current step is clicked', async () => {
      const user = userEvent.setup();
      const onStepClick = jest.fn();

      render(<WizardStepper currentStep={2} onStepClick={onStepClick} />);

      // Step 2 is current, should also be clickable (stepNum <= currentStep)
      const step2Label = screen.getByText('Model & Config');
      const step2Container = step2Label.closest('[class*="cursor-pointer"]');
      if (step2Container) {
        await user.click(step2Container);
      }

      expect(onStepClick).toHaveBeenCalledWith(2);
    });

    it('should not call onStepClick when a future step is clicked', async () => {
      const user = userEvent.setup();
      const onStepClick = jest.fn();

      render(<WizardStepper currentStep={2} onStepClick={onStepClick} />);

      // Step 4 is future, should not trigger callback
      const step4Label = screen.getByText(/Channels/);
      const step4Container = step4Label.closest('[class*="cursor-pointer"]');
      if (step4Container) {
        await user.click(step4Container);
      }

      expect(onStepClick).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Connector Lines
  // -----------------------------------------------------------------------

  describe('Connector Lines', () => {
    it('should render 4 connector lines between 5 steps', () => {
      const { container } = render(<WizardStepper currentStep={1} />);
      // Connector lines are flex-1 h-0.5 elements
      const connectors = container.querySelectorAll('.flex-1.h-0\\.5');
      expect(connectors.length).toBe(4);
    });

    it('should color completed connectors with primary color', () => {
      const { container } = render(<WizardStepper currentStep={3} />);
      const connectors = container.querySelectorAll('.flex-1.h-0\\.5');
      // Connectors before step 3 (indices 0, 1) should be primary
      expect(connectors[0]?.className).toContain('bg-primary-500');
      expect(connectors[1]?.className).toContain('bg-primary-500');
    });

    it('should color future connectors with neutral color', () => {
      const { container } = render(<WizardStepper currentStep={3} />);
      const connectors = container.querySelectorAll('.flex-1.h-0\\.5');
      // Connectors after step 3 (indices 2, 3) should be neutral
      expect(connectors[2]?.className).toContain('bg-neutral-200');
      expect(connectors[3]?.className).toContain('bg-neutral-200');
    });
  });
});
