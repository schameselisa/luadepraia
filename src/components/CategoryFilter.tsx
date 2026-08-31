import type { CategoryRow } from '@/types';

type Props = {
  categories: CategoryRow[];
  selected: string | 'all';
  onChange: (id: string | 'all') => void;
};

export function CategoryFilter({ categories, selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <FilterChip active={selected === 'all'} onClick={() => onChange('all')}>
        Todos
      </FilterChip>
      {categories.map((c) => (
        <FilterChip key={c.id} active={selected === c.id} onClick={() => onChange(c.id)}>
          {c.name}
        </FilterChip>
      ))}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-full border px-4 py-2 text-xs font-medium transition duration-200',
        active
          ? 'border-navy-300 bg-navy-700 text-white'
          : 'border-sand-200 bg-white text-navy-700/70 hover:border-sky-200 hover:text-navy-900',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
