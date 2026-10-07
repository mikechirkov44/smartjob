import './custom-checkbox.css';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  variant?: 'checkbox' | 'toggle';
  disabled?: boolean;
  id?: string;
};

export function CustomCheckbox({
  checked,
  onChange,
  label,
  description,
  variant = 'checkbox',
  disabled = false,
  id,
}: Props) {
  const inputId = id || `cc-${label.replace(/\s+/g, '-').slice(0, 24)}`;

  return (
    <label
      className={`custom-check ${variant} ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`}
      htmlFor={inputId}
    >
      <input
        id={inputId}
        type="checkbox"
        className="custom-check-input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="custom-check-control" aria-hidden="true">
        {variant === 'checkbox' && (
          <svg viewBox="0 0 16 16" width="12" height="12">
            <path
              d="M3.5 8.2l2.8 2.8 6.2-6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {variant === 'toggle' && <span className="custom-check-knob" />}
      </span>
      <span className="custom-check-text">
        <span className="custom-check-label">{label}</span>
        {description && <span className="custom-check-desc">{description}</span>}
      </span>
    </label>
  );
}
