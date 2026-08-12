"use client";

export default function NavSectionDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6699F3] opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6699F3]" />
    </span>
  );
}
