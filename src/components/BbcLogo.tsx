import Link from "next/link";

export function BbcLogo() {
  const blocks = ["N", "A", "U"];

  return (
    <Link href="/" className="inline-flex items-stretch gap-[2px] h-7" aria-label="Naujienos">
      {blocks.map((letter) => (
        <span
          key={letter}
          className="flex items-center justify-center bg-black text-white font-bold text-[11px] leading-none px-[5px] min-w-[22px]"
        >
          {letter}
        </span>
      ))}
    </Link>
  );
}
