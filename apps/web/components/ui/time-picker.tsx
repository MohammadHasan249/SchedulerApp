"use client";

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function to12(time: string): { hour: number; minute: string; period: "AM" | "PM" } {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const minute = String(Math.round(m / 5) * 5 % 60).padStart(2, "0");
  return { hour, minute, period };
}

function to24(hour: number, minute: string, period: string): string {
  let h = hour;
  if (period === "AM" && hour === 12) h = 0;
  else if (period === "PM" && hour !== 12) h = hour + 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const selectCls =
  "h-8 rounded-md border border-input bg-background px-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed";

export function TimePicker({ value, onChange, disabled }: TimePickerProps) {
  const { hour, minute, period } = to12(value);

  return (
    <div className="flex items-center gap-1">
      <select
        value={hour}
        onChange={(e) => onChange(to24(Number(e.target.value), minute, period))}
        disabled={disabled}
        className={`${selectCls} w-14`}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-muted-foreground text-sm select-none">:</span>
      <select
        value={minute}
        onChange={(e) => onChange(to24(hour, e.target.value, period))}
        disabled={disabled}
        className={`${selectCls} w-14`}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        value={period}
        onChange={(e) => onChange(to24(hour, minute, e.target.value))}
        disabled={disabled}
        className={`${selectCls} w-16`}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
