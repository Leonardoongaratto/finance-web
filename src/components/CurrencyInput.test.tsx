import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { CurrencyInput } from './CurrencyInput';

function TestWrapper({ initial = '' }: { initial?: string }) {
  const [val, setVal] = useState(initial);
  return <CurrencyInput value={val} onChange={setVal} aria-label="Valor" />;
}

describe('CurrencyInput', () => {
  it('renders with prefix and handles typing', async () => {
    render(<TestWrapper />);
    const input = screen.getByLabelText('Valor');
    expect(screen.getByText('R$')).toBeInTheDocument();
    await userEvent.type(input, '150');
    expect(input).toHaveValue('150');
  });

  it('shows live preview while typing and focused', async () => {
    render(<TestWrapper />);
    const input = screen.getByLabelText('Valor');
    await userEvent.click(input);
    await userEvent.type(input, '1200');
    expect(screen.getByText(/Formatado:/)).toBeInTheDocument();
    expect(screen.getByText('R$ 1.200,00')).toBeInTheDocument();
  });

  it('formats standard Brazilian currency on blur', async () => {
    render(<TestWrapper />);
    const input = screen.getByLabelText('Valor');
    await userEvent.type(input, '12000');
    await userEvent.tab();
    expect(input).toHaveValue('12.000,00');
  });

  it('does not format invalid or empty values on blur', async () => {
    render(<TestWrapper />);
    const input = screen.getByLabelText('Valor');
    await userEvent.type(input, 'abc');
    await userEvent.tab();
    expect(input).toHaveValue('abc');
  });
});
