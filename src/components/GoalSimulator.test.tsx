import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { calculateGoalPlan, GoalSimulator } from './GoalSimulator';

describe('calculateGoalPlan', () => {
  it('returns invalid for blank or zero target', () => {
    expect(calculateGoalPlan('', '2027-10-01', '2026-10-01')).toEqual({
      valid: false,
      cents: 0,
      monthsLeft: 0,
      monthlyNeededCents: 0,
    });
    expect(calculateGoalPlan('0', '2027-10-01', '2026-10-01')).toEqual({
      valid: false,
      cents: 0,
      monthsLeft: 0,
      monthlyNeededCents: 0,
    });
  });

  it('calculates monthly needed cents evenly', () => {
    // R$ 12.000 in 12 months = R$ 1.000 / month
    const plan = calculateGoalPlan('12000', '2027-10-01', '2026-10-01');
    expect(plan).toEqual({
      valid: true,
      cents: 1200000,
      monthsLeft: 12,
      monthlyNeededCents: 100000,
    });
  });

  it('handles past deadline gracefully', () => {
    const plan = calculateGoalPlan('5000', '2025-01-01', '2026-10-01');
    expect(plan.valid).toBe(false);
    expect(plan.message).toContain('Escolha uma data futura');
  });

  it('handles current month deadline with at least 1 month', () => {
    const plan = calculateGoalPlan('3000', '2026-10-25', '2026-10-01');
    expect(plan.valid).toBe(true);
    expect(plan.monthsLeft).toBe(1);
    expect(plan.monthlyNeededCents).toBe(300000);
  });
});

describe('GoalSimulator component', () => {
  it('renders nothing when target or deadline are incomplete', () => {
    const { container } = render(
      <GoalSimulator targetText="" deadlineText="2027-10-01" today="2026-10-01" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('displays the calculated monthly plan in real time', () => {
    render(<GoalSimulator targetText="12.000" deadlineText="2027-10-01" today="2026-10-01" />);
    expect(screen.getByRole('region', { name: 'Simulação do plano' })).toBeInTheDocument();
    expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument();
    expect(screen.getByText(/12 meses/)).toBeInTheDocument();
    expect(screen.getByText('R$ 12.000,00')).toBeInTheDocument();
  });

  it('displays warning when deadline is in the past', () => {
    render(<GoalSimulator targetText="1000" deadlineText="2025-01-01" today="2026-10-01" />);
    expect(screen.getByText(/Escolha uma data futura/)).toBeInTheDocument();
  });
});
