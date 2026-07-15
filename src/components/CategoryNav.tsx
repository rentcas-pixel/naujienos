import Link from "next/link";
import { NAV_TABS, navTabToHref, paramToNavTab } from "@/lib/rss-feeds";

interface CategoryNavProps {
  activeCategory?: string;
}

export function CategoryNav({ activeCategory }: CategoryNavProps) {
  const active = paramToNavTab(activeCategory);

  return (
    <nav className="bg-bbc-black">
      <div className="max-w-[1280px] mx-auto px-4">
        <ul className="flex gap-0 overflow-x-auto scrollbar-hide">
          {NAV_TABS.map((tab) => {
            const isActive = active === tab;
            return (
              <li key={tab}>
                <Link
                  href={navTabToHref(tab)}
                  className={`block px-3 py-2.5 text-[15px] font-bold whitespace-nowrap text-white ${
                    isActive
                      ? "underline underline-offset-4"
                      : "opacity-90 hover:opacity-100"
                  }`}
                >
                  {tab}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
