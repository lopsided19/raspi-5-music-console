function stateFingerprint(state) {
  const { savedAt: _savedAt, currentInstrumentId: _currentInstrumentId, ...content } = state;
  return JSON.stringify(content);
}

export class ProjectHistory {
  constructor({ limit = 256, entries = [], index = -1 } = {}) {
    this.limit = limit;
    this.entries = entries;
    this.index = Math.min(index, entries.length - 1);
  }

  record(state, label, timestamp = new Date().toISOString()) {
    const current = this.current();
    if (current && stateFingerprint(current.state) === stateFingerprint(state)) return false;

    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push({ label, timestamp, state });
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
    this.index = this.entries.length - 1;
    return true;
  }

  current() {
    return this.entries[this.index] ?? null;
  }

  canUndo() {
    return this.index > 0;
  }

  canRedo() {
    return this.index >= 0 && this.index < this.entries.length - 1;
  }

  undo() {
    if (!this.canUndo()) return null;
    this.index -= 1;
    return this.current();
  }

  redo() {
    if (!this.canRedo()) return null;
    this.index += 1;
    return this.current();
  }

  export() {
    return { version: 1, limit: this.limit, entries: this.entries, index: this.index };
  }

  static restore(data, fallbackLimit = 256) {
    if (!data || data.version !== 1 || !Array.isArray(data.entries)) {
      return new ProjectHistory({ limit: fallbackLimit });
    }
    return new ProjectHistory({
      limit: Number.isInteger(data.limit) ? data.limit : fallbackLimit,
      entries: data.entries,
      index: Number.isInteger(data.index) ? data.index : data.entries.length - 1,
    });
  }
}
