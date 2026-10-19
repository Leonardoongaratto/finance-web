import { useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from 'react';
import { formatBRL, parseBRL } from '../lib/format';

export interface CurrencyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  value: string;
  onChange: (value: string) => void;
  showPreview?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  showPreview = true,
  onBlur,
  placeholder = '0,00',
  className = '',
  ...props
}: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const cents = parseBRL(value);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    setFocused(false);
    if (cents !== null && cents > 0) {
      const formatted = (cents / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      onChange(formatted);
    }
    onBlur?.(event);
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    setFocused(true);
    props.onFocus?.(event);
  }

  return (
    <div className="currency-input-wrapper">
      <div className="currency-input-row">
        <span className="currency-prefix" aria-hidden="true">
          R$
        </span>
        <input
          {...props}
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`currency-input ${className}`.trim()}
        />
      </div>
      {showPreview && focused && cents !== null && cents > 0 && (
        <div className="currency-preview" aria-live="polite">
          Formatado: <strong>{formatBRL(cents)}</strong>
        </div>
      )}
    </div>
  );
}
