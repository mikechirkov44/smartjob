import { useEffect, useRef, useState } from 'react';
import './custom-select.css';

export type SelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Выберите',
  className = '',
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = options.find((o) => o.value === value)?.label || placeholder;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div
      className={`custom-select ${open ? 'open' : ''} ${className}`}
      ref={ref}
    >
      <button
        type="button"
        className="custom-select-trigger"
        aria-label={ariaLabel || placeholder}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <span className="custom-select-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="custom-select-menu" role="listbox">
          {options.map((o) => (
            <button
              key={o.value || '__empty'}
              type="button"
              role="option"
              aria-selected={value === o.value}
              className={value === o.value ? 'active' : ''}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
