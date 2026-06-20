export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center shrink-0">
      <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40 text-muted-foreground/60 flex items-center justify-center text-[9px] font-bold cursor-help select-none leading-none">
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-normal text-left">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
      </span>
    </span>
  );
}
