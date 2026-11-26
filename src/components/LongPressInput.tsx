import React, { useEffect, useRef, useState } from 'react';
import { Check, ClipboardPaste, Copy, Scissors, Trash2 } from 'lucide-react';

const IN_APP_CLIPBOARD_KEY = 'taiz_traffic_in_app_clipboard';
const CLOSE_MENUS_EVENT = 'taiz-traffic-close-field-menus';

function saveInAppClipboard(text: string) {
  try {
    sessionStorage.setItem(IN_APP_CLIPBOARD_KEY, text);
  } catch {
    // Ignore storage quota errors
  }
}

function readInAppClipboard(): string {
  try {
    return sessionStorage.getItem(IN_APP_CLIPBOARD_KEY) || '';
  } catch {
    return '';
  }
}

async function copyTextSafe(text: string): Promise<boolean> {
  saveInAppClipboard(text);
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'fixed -top-[9999px] opacity-0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export interface LongPressInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onValueChange: (val: string) => void;
}

export const LongPressInput: React.FC<LongPressInputProps> = ({
  value,
  onValueChange,
  className = '',
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerMove,
  onContextMenu,
  ...rest
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const menuIdRef = useRef(`lpm-${Math.random().toString(36).slice(2, 9)}`);

  const [menuOpen, setMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  };

  const openMenu = () => {
    window.dispatchEvent(
      new CustomEvent(CLOSE_MENUS_EVENT, { detail: menuIdRef.current })
    );
    setMenuOpen(true);
    setFeedback(null);
  };

  useEffect(() => {
    const handleCloseOthers = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail !== menuIdRef.current) {
        setMenuOpen(false);
      }
    };
    const handleOutsidePointer = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    window.addEventListener(CLOSE_MENUS_EVENT, handleCloseOthers);
    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimer();
      window.removeEventListener(CLOSE_MENUS_EVENT, handleCloseOthers);
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const showTransientFeedback = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => {
      setFeedback((prev) => (prev === msg ? null : prev));
    }, 1600);
  };

  const getSelectedOrFullText = (): {
    text: string;
    hasSelection: boolean;
    start: number;
    end: number;
  } => {
    const el = inputRef.current;
    if (
      el &&
      typeof el.selectionStart === 'number' &&
      typeof el.selectionEnd === 'number' &&
      el.selectionEnd > el.selectionStart
    ) {
      return {
        text: value.slice(el.selectionStart, el.selectionEnd),
        hasSelection: true,
        start: el.selectionStart,
        end: el.selectionEnd,
      };
    }
    return {
      text: value,
      hasSelection: false,
      start: 0,
      end: value.length,
    };
  };

  const handleCopy = async () => {
    const { text } = getSelectedOrFullText();
    if (!text) {
      showTransientFeedback('الحقل فارغ');
      setMenuOpen(false);
      return;
    }
    await copyTextSafe(text);
    setMenuOpen(false);
    showTransientFeedback('تم النسخ');
  };

  const handleCut = async () => {
    const { text, hasSelection, start, end } = getSelectedOrFullText();
    if (!text) {
      setMenuOpen(false);
      return;
    }
    await copyTextSafe(text);
    if (hasSelection) {
      onValueChange(value.slice(0, start) + value.slice(end));
    } else {
      onValueChange('');
    }
    setMenuOpen(false);
    showTransientFeedback('تم القص');
  };

  const handlePaste = async () => {
    let pastedText = '';
    if (navigator.clipboard?.readText) {
      try {
        pastedText = await navigator.clipboard.readText();
      } catch {
        pastedText = '';
      }
    }
    if (!pastedText) {
      pastedText = readInAppClipboard();
    }

    if (!pastedText) {
      setMenuOpen(false);
      inputRef.current?.focus();
      showTransientFeedback('لا يوجد نص في الحافظة أو استخدم Ctrl+V');
      return;
    }

    const el = inputRef.current;
    if (
      el &&
      typeof el.selectionStart === 'number' &&
      typeof el.selectionEnd === 'number' &&
      el.selectionEnd > el.selectionStart
    ) {
      const next =
        value.slice(0, el.selectionStart) + pastedText + value.slice(el.selectionEnd);
      onValueChange(next);
    } else if (
      el &&
      typeof el.selectionStart === 'number' &&
      value.length > 0 &&
      document.activeElement === el
    ) {
      const pos = el.selectionStart;
      const next = value.slice(0, pos) + pastedText + value.slice(pos);
      onValueChange(next);
    } else {
      onValueChange(pastedText);
    }

    setMenuOpen(false);
    showTransientFeedback('تم اللصق');
  };

  const handleClear = () => {
    onValueChange('');
    setMenuOpen(false);
    inputRef.current?.focus();
  };

  const handleSelectAll = () => {
    setMenuOpen(false);
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onPointerDown={(e) => {
          onPointerDown?.(e);
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          clearTimer();
          startPosRef.current = { x: e.clientX, y: e.clientY };
          timerRef.current = window.setTimeout(() => {
            openMenu();
          }, 450);
        }}
        onPointerMove={(e) => {
          onPointerMove?.(e);
          if (!startPosRef.current) return;
          const dx = Math.abs(e.clientX - startPosRef.current.x);
          const dy = Math.abs(e.clientY - startPosRef.current.y);
          if (dx > 10 || dy > 10) {
            clearTimer();
          }
        }}
        onPointerUp={(e) => {
          clearTimer();
          onPointerUp?.(e);
        }}
        onPointerCancel={(e) => {
          clearTimer();
          onPointerCancel?.(e);
        }}
        onContextMenu={(e) => {
          onContextMenu?.(e);
          e.preventDefault();
          clearTimer();
          openMenu();
        }}
        className={className}
        {...rest}
      />

      {menuOpen && (
        <div
          role="menu"
          aria-label="خيارات النسخ واللصق"
          className="absolute bottom-full right-0 mb-1.5 z-40 flex items-center gap-1 p-1 rounded-lg bg-[#132654] text-white border border-blue-400/50 shadow-lg whitespace-nowrap"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleCopy}
            disabled={!value}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-md hover:bg-white/15 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>نسخ</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={handlePaste}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-md bg-amber-400 text-[#132654] hover:bg-amber-300 transition-colors cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>لصق</span>
          </button>

          {value && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={handleCut}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-md hover:bg-white/15 transition-colors cursor-pointer"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>قص</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleSelectAll}
                className="px-2 py-1.5 text-xs font-semibold rounded-md hover:bg-white/15 transition-colors cursor-pointer"
              >
                تحديد الكل
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleClear}
                title="مسح الحقل"
                className="p-1.5 rounded-md text-red-200 hover:bg-red-500/30 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}

      {feedback && (
        <div className="absolute top-full right-0 mt-1 z-30 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] font-semibold shadow-sm pointer-events-none">
          <Check className="w-3 h-3 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );
};
