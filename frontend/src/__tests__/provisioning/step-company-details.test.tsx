import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepCompanyDetails } from '@/components/admin/provisioning/step-company-details';
import type { Step1FormData } from '@/lib/validations/provisioning';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultData(): Step1FormData {
  return {
    companyName: '',
    adminEmail: '',
    industry: '',
    companySize: '',
    deploymentRegion: '',
    notes: '',
  };
}

function renderStep(
  overrides?: Partial<Step1FormData>,
  errors?: Partial<Record<keyof Step1FormData, string>>
) {
  const data = { ...defaultData(), ...overrides };
  const onChange = jest.fn();
  render(
    <StepCompanyDetails
      data={data}
      errors={errors ?? {}}
      onChange={onChange}
    />
  );
  return { onChange };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StepCompanyDetails', () => {
  it('should render all form fields', () => {
    renderStep();

    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/admin email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/industry/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company size/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/deployment region/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it('should show the section title and description', () => {
    renderStep();

    expect(screen.getByText('Company Details')).toBeInTheDocument();
    expect(
      screen.getByText(/enter the basic information/i)
    ).toBeInTheDocument();
  });

  it('should display validation errors for company name', () => {
    renderStep({}, { companyName: 'Company name is required' });

    expect(screen.getByText('Company name is required')).toBeInTheDocument();
  });

  it('should display validation errors for admin email', () => {
    renderStep({}, { adminEmail: 'Please enter a valid email address' });

    expect(
      screen.getByText('Please enter a valid email address')
    ).toBeInTheDocument();
  });

  it('should display validation errors for deployment region', () => {
    renderStep({}, { deploymentRegion: 'Deployment region is required' });

    expect(
      screen.getByText('Deployment region is required')
    ).toBeInTheDocument();
  });

  it('should call onChange when typing into company name', async () => {
    const user = userEvent.setup();
    const { onChange } = renderStep();

    const input = screen.getByLabelText(/company name/i);
    await user.type(input, 'A');

    expect(onChange).toHaveBeenCalledWith('companyName', 'A');
  });

  it('should call onChange when typing into admin email', async () => {
    const user = userEvent.setup();
    const { onChange } = renderStep();

    const input = screen.getByLabelText(/admin email/i);
    await user.type(input, 'a');

    expect(onChange).toHaveBeenCalledWith('adminEmail', 'a');
  });

  it('should call onChange when selecting a region', async () => {
    const user = userEvent.setup();
    const { onChange } = renderStep();

    const select = screen.getByLabelText(/deployment region/i);
    await user.selectOptions(select, 'us-east-1');

    expect(onChange).toHaveBeenCalledWith('deploymentRegion', 'us-east-1');
  });

  it('should show notes character counter', () => {
    renderStep({ notes: 'Hello world' });

    expect(screen.getByText('11/500')).toBeInTheDocument();
  });

  it('should pre-fill values from data prop', () => {
    renderStep({
      companyName: 'Acme Corp',
      adminEmail: 'admin@acme.com',
      deploymentRegion: 'eu-west-1',
    });

    expect(screen.getByLabelText(/company name/i)).toHaveValue('Acme Corp');
    expect(screen.getByLabelText(/admin email/i)).toHaveValue(
      'admin@acme.com'
    );
    expect(screen.getByLabelText(/deployment region/i)).toHaveValue(
      'eu-west-1'
    );
  });

  it('should mark required fields with an asterisk', () => {
    renderStep();

    // Company Name, Admin Email, Deployment Region are required
    const requiredMarkers = screen.getAllByText('*');
    expect(requiredMarkers.length).toBe(3);
  });
});
