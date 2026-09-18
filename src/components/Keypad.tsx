const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function Keypad({
  value,
  onChange,
  max = 3,
}: {
  value: string;
  onChange: (next: string) => void;
  max?: number;
}) {
  const press = (k: string) => {
    if (value.length >= max) return;
    if (k === '0' && value === '') return;
    onChange(value + k);
  };

  return (
    <div className="keypad">
      {KEYS.map((k) => (
        <button key={k} type="button" onClick={() => press(k)} aria-label={`digit ${k}`}>
          {k}
        </button>
      ))}
      <button type="button" onClick={() => onChange('')} className="wide" aria-label="clear distance">
        Clear
      </button>
      <button type="button" onClick={() => press('0')} aria-label="digit 0">
        0
      </button>
    </div>
  );
}
