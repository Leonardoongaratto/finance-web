import { useState } from 'react';
import { formatBRL, formatDate } from '../lib/format';

export interface Entry {
  id: number;
  date: string;
  cents: number;
}

interface EntryListProps {
  title: string;
  itemLabel: string;
  entries: Entry[];
  onDelete: (entry: Entry) => void;
}

const COLLAPSED_COUNT = 5;

export function EntryList({ title, itemLabel, entries, onDelete }: EntryListProps) {
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const visible = expanded ? sorted : sorted.slice(0, COLLAPSED_COUNT);
  return (
    <div>
      <h3>{title}</h3>
      <ul className="list" aria-label={title}>
        {visible.map((entry) => (
          <li key={entry.id} className="list-row entry-row">
            <span className="grow">{formatDate(entry.date)}</span>
            <span className="entry-actions">
              <strong>{formatBRL(entry.cents)}</strong>
              <button
                type="button"
                className="btn btn-small btn-danger"
                aria-label={`Excluir ${itemLabel} de ${formatDate(entry.date)}`}
                onClick={() => onDelete(entry)}
              >
                Excluir
              </button>
            </span>
          </li>
        ))}
      </ul>
      {sorted.length > COLLAPSED_COUNT && (
        <button type="button" className="btn btn-small" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Mostrar menos' : `Ver todos (${sorted.length})`}
        </button>
      )}
    </div>
  );
}
