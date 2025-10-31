import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type CardFiltersProps = {
  selectedMana: number | null;
  onManaSelect: (mana: number | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
};

export function CardFilters({
  selectedMana,
  onManaSelect,
  searchQuery,
  onSearchChange,
}: CardFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="카드 이름 검색"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-sm"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={selectedMana === null ? "default" : "outline"}
          onClick={() => onManaSelect(null)}
        >
          전체
        </Button>
        {[1, 2, 3, 4].map((m) => (
          <Button
            key={m}
            variant={selectedMana === m ? "default" : "outline"}
            onClick={() => onManaSelect(m)}
          >
            {m}
          </Button>
        ))}
        <Button
          variant={selectedMana === 5 ? "default" : "outline"}
          onClick={() => onManaSelect(5)}
        >
          5+
        </Button>
      </div>
    </div>
  );
}

export default CardFilters;


