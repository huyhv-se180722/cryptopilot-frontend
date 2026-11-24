import type { ChartDrawing, ChartDrawingChange } from '../../../types/domain';

/** A change the Trader made, kept so it can be undone and done again. */
export type HistoryEntry =
  | { kind: 'create'; drawing: ChartDrawing }
  | {
      kind: 'update';
      id: string;
      before: ChartDrawingChange;
      after: ChartDrawingChange;
    }
  | { kind: 'remove'; drawing: ChartDrawing };

const LIMIT = 50;

/** What a drawing looks like as a change: everything the Trader may edit. */
export function changeOf(drawing: ChartDrawing): ChartDrawingChange {
  return {
    points: drawing.points,
    style: drawing.style,
    text: drawing.text,
    locked: drawing.locked,
    hidden: drawing.hidden,
  };
}

/**
 * Undo and redo stacks of one chart (D-149 (3)). A removed drawing comes
 * back under a new id, so every entry naming the old one is rewritten.
 */
export class DrawingHistory {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** A new change: what could be redone is forgotten. */
  record(entry: HistoryEntry) {
    this.past.push(entry);
    if (this.past.length > LIMIT) this.past.shift();
    this.future = [];
  }

  takeUndo(): HistoryEntry | undefined {
    return this.past.pop();
  }

  takeRedo(): HistoryEntry | undefined {
    return this.future.pop();
  }

  /** Puts an undone entry where redo finds it. */
  undone(entry: HistoryEntry) {
    this.future.push(entry);
  }

  /** Puts a redone entry where undo finds it, keeping what remains to redo. */
  redone(entry: HistoryEntry) {
    this.past.push(entry);
  }

  /** Puts back an entry whose undo or redo could not be saved, to try again. */
  putBack(direction: 'undo' | 'redo', entry: HistoryEntry) {
    if (direction === 'undo') this.past.push(entry);
    else this.future.push(entry);
  }

  /** Rewrites every entry that names `from` to name `to`. */
  rename(from: ChartDrawing, to: ChartDrawing) {
    const swap = (entry: HistoryEntry): HistoryEntry => {
      if (entry.kind === 'update')
        return entry.id === from.id ? { ...entry, id: to.id } : entry;
      return entry.drawing.id === from.id ? { ...entry, drawing: to } : entry;
    };
    this.past = this.past.map(swap);
    this.future = this.future.map(swap);
  }

  clear() {
    this.past = [];
    this.future = [];
  }
}
