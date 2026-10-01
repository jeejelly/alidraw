const path = require("node:path");

const git = require("./git");

const message = (paths) => {
  const names = [...paths].map((p) => path.posix.basename(p));
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
    let p = this.pending.get(id);
    if (!p) {
      p = { root, paths: new Set(), timer: null };
      this.pending.set(id, p);
    }
    p.paths.add(rel);
    if (p.timer) {
      this.clearTimer(p.timer);
    }
    p.timer = this.setTimer(() => this.flush(id), delay);
  }

  /** commit what is pending for a workspace now (also the "commit now" button) */
  async flush(id, root, customMessage) {
    const p = this.pending.get(id);
    if (p?.timer) {
      this.clearTimer(p.timer);
    }
    this.pending.delete(id);
    const dir = p?.root ?? root;
    if (!dir) {
      return null;
    }
    const paths = p ? [...p.paths] : undefined;
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
    for (const p of this.pending.values()) {
      if (p.timer) {
        this.clearTimer(p.timer);
      }
    }
    this.pending.clear();
  }
}

module.exports = { AutoCommit, message };
