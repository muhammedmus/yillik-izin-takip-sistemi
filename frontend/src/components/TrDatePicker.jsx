import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { CalendarIcon, X } from "lucide-react";
import { tr } from "date-fns/locale";
import { format, parseISO, isValid, parse } from "date-fns";

/**
 * Türkçe GG.AA.YYYY tarih alanı — hem klavyeden hem takvimden girilebilir.
 * Klavyede kullanıcı 26.05.2003 yazabilir; nokta yazmasa da 26052003 gibi 8 rakam
 * girerse otomatik olarak 26.05.2003 formatına maskelenir. Geçersiz tarih kabul edilmez.
 * Sağdaki takvim ikonuna basılırsa Popover ile takvim de açılır.
 *
 * props: value (ISO YYYY-MM-DD veya ""), onChange(iso|""), placeholder, disabled,
 *        testId, clearable, fromYear, toYear.
 */
export function TrDatePicker({
  value,
  onChange,
  placeholder = "GG.AA.YYYY",
  disabled = false,
  testId,
  clearable = true,
  fromYear = 1950,
  toYear,
}) {
  const parsed = useMemo(() => {
    if (!value) return null;
    const s = typeof value === "string" ? value.slice(0, 10) : "";
    const d = s ? parseISO(s) : (value instanceof Date ? value : null);
    return d && isValid(d) ? d : null;
  }, [value]);

  const maxYear = toYear || new Date().getFullYear() + 5;
  const [text, setText] = useState(parsed ? format(parsed, "dd.MM.yyyy") : "");
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);

  // ISO değeri değiştiğinde metin görselini senkron tut
  useEffect(() => {
    setText(parsed ? format(parsed, "dd.MM.yyyy") : "");
    setInvalid(false);
  }, [parsed]);

  // "12021979" gibi 8 rakamı "12.02.1979"a maskele; nokta zaten varsa dokunma
  const applyMask = (raw) => {
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    if (raw.includes(".") || digits.length !== 8) return raw;
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
  };

  const commit = (raw) => {
    const masked = applyMask((raw || "").trim());
    setText(masked);
    if (!masked) { setInvalid(false); onChange(""); return; }
    // dd.MM.yyyy strict parse — 31.02.2026 gibi geçersiz tarihler reddedilir
    const d = parse(masked, "dd.MM.yyyy", new Date());
    if (!isValid(d) || format(d, "dd.MM.yyyy") !== masked) {
      setInvalid(true); return;
    }
    setInvalid(false);
    onChange(format(d, "yyyy-MM-dd"));
  };

  const onInputChange = (e) => {
    const v = e.target.value;
    setText(v);
    if (invalid) setInvalid(false);
    // Anlık maskeleme (nokta olmadan 8 rakam yazınca)
    const digits = v.replace(/\D/g, "");
    if (!v.includes(".") && digits.length === 8) {
      const masked = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
      setText(masked);
      const d = parse(masked, "dd.MM.yyyy", new Date());
      if (isValid(d) && format(d, "dd.MM.yyyy") === masked) {
        onChange(format(d, "yyyy-MM-dd"));
      }
    }
  };

  return (
    <div className="relative w-full">
      <Input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        disabled={disabled}
        value={text}
        onChange={onInputChange}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(e.target.value); } }}
        maxLength={10}
        className={`pr-16 tabular-nums ${invalid ? "border-red-400 focus-visible:ring-red-300" : ""}`}
        data-testid={testId}
        aria-invalid={invalid || undefined}
      />
      <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
        {parsed && clearable && !disabled && (
          <button
            type="button"
            onClick={() => { setText(""); setInvalid(false); onChange(""); }}
            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700"
            title="Tarihi temizle"
            data-testid={testId ? `${testId}-clear` : undefined}
          >
            <X size={13} />
          </button>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              title="Takvimden seç"
              data-testid={testId ? `${testId}-cal-icon` : undefined}
            >
              <CalendarIcon size={15} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              locale={tr}
              selected={parsed || undefined}
              defaultMonth={parsed || new Date()}
              onSelect={(d) => {
                if (d) onChange(format(d, "yyyy-MM-dd"));
                else onChange("");
                setOpen(false);
              }}
              weekStartsOn={1}
              fromYear={fromYear}
              toYear={maxYear}
              captionLayout="dropdown"
              classNames={{
                caption_label: "hidden",
                caption_dropdowns: "flex gap-2 justify-center items-center",
                dropdown: "text-sm bg-white border border-slate-300 rounded px-2 py-1 cursor-pointer",
                dropdown_month: "relative",
                dropdown_year: "relative",
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {invalid && (
        <div className="text-[11px] text-red-600 mt-1" data-testid={testId ? `${testId}-error` : undefined}>
          Geçersiz tarih. Örnek: 26.05.2003
        </div>
      )}
    </div>
  );
}

export default TrDatePicker;
