import Link from "next/link";
import { BbcLogo } from "./BbcLogo";

export function Header() {
  return (
    <header className="bg-white border-b border-bbc-border">
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-bbc-black hover:opacity-70 text-xl leading-none"
              aria-label="Meniu"
            >
              ☰
            </button>
            <BbcLogo />
            <span className="hidden sm:inline text-[15px] font-bold text-bbc-black">
              Naujienos
            </span>
          </div>

          <div className="flex items-center gap-4 text-[14px] text-bbc-black">
            <Link href="/" className="hover:underline">
              Paieška
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
