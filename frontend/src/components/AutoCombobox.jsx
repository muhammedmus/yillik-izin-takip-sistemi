import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { ChevronDown } from "lucide-react";

/**
 * Departman/Görev/Şirket gibi alanlarda kullanılan hafif autocomplete/combobox.
 *
 * Özellikleri:
 * - Serbest metin girilebilir (yeni değerler kabul edilir — Select değildir).
 * - Türkçe karakterlerde büyük/küçük duyarsız arama (İ / i / I doğru eşleşir).
 * - Öneriler ilk harften itibaren eşleşenler + içerik eşleşenler ayrı gruplansın diye
 *   önce prefix-match, sonra substring-match sıralanır.
 * - `suggestions` prop'u dışardan cache'li olarak verilir (her tuşta backend'e istek yok).
 *
 * props:
 *   value: current string
 *   onChange(v): callback
 *   suggestions: string[] (cached)
 *   placeholder, testId, disabled
 */
export function AutoCombobox({
  value,
  onChange,
  suggestions = [],
  placeholder = "",
  testId,
  disabled = false,
  maxItems = 12,
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(-1);
  const wrapRef = useRef(null);

  const norm = (s) => (s || "").toString()
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/i̇/g, "i")
    .toLocaleLowerCase("tr");

  const q = norm(value);
  const filtered = useMemo(() => {
    if (!suggestions?.length) return [];
    const uniq = Array.from(new Set(suggestions.filter(Boolean)));
    if (!q) return uniq.slice(0, maxItems);
    const prefix = [];
    const contains = [];
    for (const s of uniq) {
      const n = norm(s);
      if (n === q) continue;                                // birebir eşleşme zaten yazılı
      if (n.startsWith(q)) prefix.push(s);
      else if (n.includes(q)) contains.push(s);
    }
    return [...prefix, ...contains].slice(0, maxItems);
  }, [q, suggestions, maxItems]);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = (s) => { onChange(s); setOpen(false); setHover(-1); };

  const onKey = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHover((h) => Math.min(filtered.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHover((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter" && hover >= 0) { e.preventDefault(); pick(filtered[hover]); }
    else if (e.key === "Escape") { setOpen(false); setHover(-1); }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <Input
        value={value || ""}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHover(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="pr-8"
        data-testid={testId}
      />
      <button type="button" tabIndex={-1}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
        onClick={() => setOpen((v) => !v)}
        title="Önerileri göster"
      >
        <ChevronDown size={14} />
      </button>
      {open && filtered.length > 0 && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-56 overflow-auto text-sm"
             data-testid={testId ? `${testId}-list` : undefined}>
          {filtered.map((s, i) => (
            <button
              key={s + i}
              type="button"
              className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 ${hover === i ? "bg-slate-100" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setHover(i)}
              data-testid={testId ? `${testId}-opt-${i}` : undefined}
            >{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AutoCombobox;
