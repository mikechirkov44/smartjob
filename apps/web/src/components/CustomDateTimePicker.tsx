import { useEffect, useMemo, useRef, useState } from 'react';
import './custom-datetime.css';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Parse `YYYY-MM-DDTHH:mm` or ISO-ish string into local parts. */
function parseValue(value: string): { date: Date; hour: number; minute: number } | null {
  if (!value) return null;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/,
  );
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = match[4] != null ? Number(match[4]) : 0;
  const minute = match[5] != null ? Number(match[5]) : 0;
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  return { date, hour, minute };
}

function toValue(date: Date, hour: number, minute: number) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:${pad(minute)}`;
}

function formatDisplay(value: string) {
  const parsed = parseValue(value);
  if (!parsed) return '';
  const { date, hour, minute } = parsed;
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(hour)}:${pad(minute)}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildCalendarDays(viewMonth: Date) {
  const first = startOfMonth(viewMonth);
  const startWeekday = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const prevDays = new Date(first.getFullYear(), first.getMonth(), 0).getDate();
  const cells: { day: number; inMonth: boolean; date: Date }[] = [];

  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const day = prevDays - i;
    cells.push({
      day,
      inMonth: false,
      date: new Date(first.getFullYear(), first.getMonth() - 1, day),
    });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      inMonth: true,
      date: new Date(first.getFullYear(), first.getMonth(), day),
    });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const day = cells.length - (startWeekday + daysInMonth) + 1;
    cells.push({
      day,
      inMonth: false,
      date: new Date(first.getFullYear(), first.getMonth() + 1, day),
    });
  }
  return cells;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CustomDateTimePicker({
  value,
  onChange,
  placeholder = 'ДД.ММ.ГГГГ --:--',
  className = '',
  ariaLabel = 'Дата и время',
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const parsed = parseValue(value);
  const selectedDate = parsed?.date ?? null;
  const selectedHour = parsed?.hour ?? 12;
  const selectedMinute = parsed?.minute ?? 0;

  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(selectedDate ?? new Date()),
  );

  useEffect(() => {
    if (open && selectedDate) {
      setViewMonth(startOfMonth(selectedDate));
    }
  }, [open, selectedDate]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    const scrollSelected = (el: HTMLDivElement | null, index: number) => {
      if (!el) return;
      const item = el.children[index] as HTMLElement | undefined;
      if (item) {
        el.scrollTop = item.offsetTop - el.clientHeight / 2 + item.clientHeight / 2;
      }
    };
    requestAnimationFrame(() => {
      scrollSelected(hoursRef.current, selectedHour);
      scrollSelected(minutesRef.current, selectedMinute);
    });
  }, [open, selectedHour, selectedMinute]);

  const days = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);
  const display = formatDisplay(value) || placeholder;
  const hasValue = Boolean(parsed);

  const commit = (date: Date, hour: number, minute: number) => {
    onChange(toValue(date, hour, minute));
  };

  const today = new Date();

  return (
    <div
      className={`custom-datetime ${open ? 'open' : ''} ${className}`}
      ref={ref}
    >
      <button
        type="button"
        className={`custom-datetime-trigger ${hasValue ? '' : 'placeholder'}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{display}</span>
        <svg
          className="custom-datetime-icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden
        >
          <rect
            x="3"
            y="5"
            width="18"
            height="16"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M3 10h18M8 3v4M16 3v4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className="custom-datetime-panel" role="dialog" aria-label={ariaLabel}>
          <div className="custom-datetime-body">
            <div className="custom-datetime-cal">
              <div className="custom-datetime-cal-head">
                <span className="custom-datetime-month">
                  {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                </span>
                <div className="custom-datetime-nav">
                  <button
                    type="button"
                    aria-label="Предыдущий месяц"
                    onClick={() =>
                      setViewMonth(
                        new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
                      )
                    }
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Следующий месяц"
                    onClick={() =>
                      setViewMonth(
                        new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
                      )
                    }
                  >
                    ›
                  </button>
                </div>
              </div>
              <div className="custom-datetime-weekdays">
                {WEEKDAYS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="custom-datetime-grid">
                {days.map((cell) => {
                  const isSelected = selectedDate ? sameDay(cell.date, selectedDate) : false;
                  const isToday = sameDay(cell.date, today);
                  return (
                    <button
                      key={`${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`}
                      type="button"
                      className={[
                        'custom-datetime-day',
                        cell.inMonth ? '' : 'outside',
                        isSelected ? 'selected' : '',
                        isToday ? 'today' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => commit(cell.date, selectedHour, selectedMinute)}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="custom-datetime-time">
              <div className="custom-datetime-time-col" ref={hoursRef}>
                {Array.from({ length: 24 }, (_, h) => (
                  <button
                    key={h}
                    type="button"
                    className={h === selectedHour ? 'active' : ''}
                    onClick={() =>
                      commit(selectedDate ?? today, h, selectedMinute)
                    }
                  >
                    {pad(h)}
                  </button>
                ))}
              </div>
              <div className="custom-datetime-time-col" ref={minutesRef}>
                {Array.from({ length: 60 }, (_, m) => (
                  <button
                    key={m}
                    type="button"
                    className={m === selectedMinute ? 'active' : ''}
                    onClick={() =>
                      commit(selectedDate ?? today, selectedHour, m)
                    }
                  >
                    {pad(m)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="custom-datetime-footer">
            <button
              type="button"
              className="custom-datetime-link"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Очистить
            </button>
            <button
              type="button"
              className="custom-datetime-link"
              onClick={() => {
                const now = new Date();
                commit(now, now.getHours(), now.getMinutes());
                setViewMonth(startOfMonth(now));
              }}
            >
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
