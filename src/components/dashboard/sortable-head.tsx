"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

export type SortState<K extends string> = {
  key: K;
  dir: SortDir;
};

export type SortOption<K extends string> = {
  key: K;
  label: string;
};

export function MobileSortBar<K extends string>({
  options,
  state,
  onChange,
  label = "Sort by",
}: {
  options: SortOption<K>[];
  state: SortState<K>;
  onChange: (next: SortState<K>) => void;
  label?: string;
}) {
  const Icon = state.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <div className="md:hidden flex items-center gap-2 mb-3 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <select
        value={state.key}
        onChange={(e) =>
          onChange({ key: e.target.value as K, dir: state.dir })
        }
        className="border rounded px-2 py-1 bg-white"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={state.dir === "asc" ? "Ascending" : "Descending"}
        onClick={() =>
          onChange({
            key: state.key,
            dir: state.dir === "asc" ? "desc" : "asc",
          })
        }
        className="border rounded p-1.5 bg-white hover:bg-gray-50"
      >
        <Icon className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SortableHead<K extends string>({
  sortKey,
  state,
  onChange,
  children,
  className,
}: {
  sortKey: K;
  state: SortState<K>;
  onChange: (next: SortState<K>) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const active = state.key === sortKey;
  const Icon = active ? (state.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() =>
          onChange({
            key: sortKey,
            dir: active && state.dir === "asc" ? "desc" : "asc",
          })
        }
        className={cn(
          "inline-flex items-center gap-1 -mx-2 px-2 py-1 rounded hover:bg-gray-100 transition-colors",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {children}
        <Icon className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-50")} />
      </button>
    </TableHead>
  );
}
