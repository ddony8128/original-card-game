import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface CardFiltersProps {
  selectedMana: number | null;
  onManaSelect: (mana: number | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const manaFilters = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5+' },
];

export const CardFilters = ({
  selectedMana,
  onManaSelect,
  searchQuery,
  onSearchChange,
}: CardFiltersProps) => {
  return (
    <div className="bg-card border-border space-y-4 rounded-lg border p-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="카드 이름이나 내용 검색..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="bg-secondary border-border pl-10"
        />
      </div>

      {/* Mana Cost Filters */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">마나 비용</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedMana === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => onManaSelect(null)}
            className={cn(
              'transition-all',
              selectedMana === null && 'shadow-[0_0_20px_hsl(260_80%_55%/0.4)]',
            )}
          >
            전체
          </Button>
          {manaFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={selectedMana === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onManaSelect(filter.value)}
              className={cn(
                'transition-all',
                selectedMana === filter.value && 'shadow-[0_0_20px_hsl(260_80%_55%/0.4)]',
              )}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
