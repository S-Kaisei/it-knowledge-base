import { Check, Copy, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type CopyStatus = 'idle' | 'copied' | 'failed';

const LABEL: Record<CopyStatus, string> = {
  idle: 'コピー',
  copied: 'コピーしました',
  failed: 'コピーできませんでした',
};

const RESET_MS = 2000;

/** Copies `getText()` to the clipboard. The clipboard API is touched only inside the click handler. */
export function CopyButton({ getText, label = 'コードをコピー' }: { getText: () => string; label?: string }) {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    let next: CopyStatus = 'failed';
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(getText());
        next = 'copied';
      }
    } catch {
      // Permission denied or insecure context: report the failure instead of throwing.
    }
    setStatus(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), RESET_MS);
  };

  const Icon = status === 'copied' ? Check : status === 'failed' ? X : Copy;
  return (
    <>
      <button type="button" className="code-copy" onClick={onClick} aria-label={status === 'idle' ? label : LABEL[status]} data-status={status}>
        <Icon aria-hidden="true" size={14} strokeWidth={2} />
        <span>{LABEL[status]}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === 'idle' ? '' : LABEL[status]}
      </span>
    </>
  );
}
