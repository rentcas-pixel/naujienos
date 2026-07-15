import { Header } from "./Header";
import { CategoryNav } from "./CategoryNav";

interface SiteHeaderProps {
  activeCategory?: string;
}

export function SiteHeader({ activeCategory }: SiteHeaderProps) {
  return (
    <div className="sticky top-0 z-50 bg-white shadow-sm">
      <Header />
      <CategoryNav activeCategory={activeCategory} />
    </div>
  );
}
