const path = require("node:path");

const git = require("./git");

const message = (paths) => {
  const names = [...paths].map((filePath) => path.posix.basename(filePath));
  return names.length <= 3
    ? `Update ${names.join(", ")}`
    : `Update ${names.length} files`;
};

/**
 * Commits a workspace's changed files once edits have paused. Only the paths
 * that were written are committed, so files changed by other tools stay as
 * they are. Nothing is committed when the content did not change.
 */
class AutoCommit {
  constructor({
    delayFor,
    onResult,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  }) {
    this.delayFor = delayFor;
    this.onResult = onResult;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.pending = new Map(); // id -> { root, paths:Set, timer }
  }

  /** a scene file was written */
  touch(id, root, rel) {
    const delay = this.delayFor(id);
    if (delay === null) {
      return; // auto commit is off
    }
    let entry = this.pending.get(id);
    if (!entry) {
      entry = { root, paths: new Set(), timer: null };
      this.pending.set(id, entry);
    }
    entry.paths.add(rel);
    if (entry.timer) {
      this.clearTimer(entry.timer);
    }
    entry.timer = this.setTimer(() => this.flush(id), delay);
  }

  /** commit what is pending for a workspace now (also the "commit now" button) */
  async flush(id, root, customMessage) {
    const entry = this.pending.get(id);
    if (entry?.timer) {
      this.clearTimer(entry.timer);
    }
    this.pending.delete(id);
    const dir = entry?.root ?? root;
    if (!dir) {
      return null;
    }
    const paths = entry ? [...entry.paths] : undefined;
    try {
      const hash = await git.commit(
        dir,
        customMessage ?? (paths ? message(paths) : "Update workspace"),
        paths,
      );
      this.onResult(id, { ok: true, hash });
      return hash;
    } catch (error) {
      this.onResult(id, { ok: false, error: error.message });
      return null;
    }
  }

  hasPending(id) {
    return this.pending.has(id);
  }

  /** commit everything pending, e.g. before the app quits */
  async flushAll() {
    for (const id of [...this.pending.keys()]) {
      await this.flush(id);
    }
  }

  dispose() {
    for (const entry of this.pending.values()) {
      if (entry.timer) {
        this.clearTimer(entry.timer);
      }
    }
    this.pending.clear();
  }
}

module.exports = { AutoCommit, message };
