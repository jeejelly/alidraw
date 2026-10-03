const os = require("node:os");

const git = require("./git");
const { slug } = require("./paths");

/** what failed, in words that say what to do */
const explain = (error) => {
  const message = error.message || String(error);
  if (
    /could not read Username|Authentication failed|Permission denied|publickey|terminal prompts disabled/i.test(
      message,
    )
  ) {
    return `Authentication failed. Set up a git credential helper or an ssh key for this remote, then try again. (${
      message.split("\n")[0]
    })`;
  }
  if (
    /Could not resolve host|unable to access|Connection (timed out|refused)|Network is unreachable/i.test(
      message,
    )
  ) {
    return `The remote cannot be reached: ${message.split("\n")[0]}`;
  }
  return message;
};

/**
 * Share a workspace through its git remote. Fast-forward only, never forced:
 * when both sides moved, nothing is pushed and the workspace is "diverged"
 * until the user picks what to do. Everything is skipped while the network is
 * paused.
 */
class Sync {
  /**
   * @param {{ workspaces, isPaused: () => boolean, flush: (id) => Promise<any>, emit: (e) => void }} deps
   */
  constructor({ workspaces, isPaused, flush, emit, now = () => new Date() }) {
    this.workspaces = workspaces;
    this.isPaused = isPaused;
    this.flush = flush;
    this.emit = emit;
    this.now = now;
    this.state = new Map(); // id -> { state, message, at, files }
    this.busy = new Set();
  }

  root(id) {
    return this.workspaces.root(id);
  }

  async remote(id) {
    return (await git.remotes(this.root(id)))[0] ?? null;
  }

  async setRemote(id, url) {
    const root = this.root(id);
    if (!(await git.isRepo(root))) {
      throw new Error("this workspace is not under git");
    }
    const checked = await git.setRemote(root, url);
    this.set(id, { state: "idle", message: null });
    return { name: "origin", url: checked };
  }

  set(id, patch) {
    const next = {
      ...(this.state.get(id) ?? {}),
      ...patch,
      at: this.now().toISOString(),
    };
    this.state.set(id, next);
    this.emit({ type: "sync", id, ...next });
    return next;
  }

  info(id) {
    return this.state.get(id) ?? { state: "idle", message: null };
  }

  /**
   * Fetch, fast-forward when only the remote moved, push when only we moved.
   * @returns {{outcome: 'in-sync'|'pulled'|'pushed'|'diverged'|'blocked'|'no-remote'|'paused', files?: string[]}}
   */
  async sync(id, { pull = true, push = true } = {}) {
    if (this.isPaused()) {
      this.set(id, { state: "paused", message: "Network is paused" });
      return { outcome: "paused" };
    }
    if (this.busy.has(id)) {
      return { outcome: "blocked", message: "a sync is already running" };
    }
    this.busy.add(id);
    try {
      const root = this.root(id);
      const remote = (await git.remotes(root))[0];
      if (!remote) {
        this.set(id, { state: "no-remote", message: null });
        return { outcome: "no-remote" };
      }
      // what was edited is committed first, so it travels
      await this.flush(id);
      this.set(id, { state: "syncing", message: null });
      try {
        await git.fetchRemote(root, remote.name);
      } catch (error) {
        const message = explain(error);
        this.set(id, { state: "error", message });
        return { outcome: "blocked", message };
      }
      let st = await git.status(root);
      if (!st.upstream) {
        // first push of a new repository
        if (!push) {
          this.set(id, { state: "idle", message: null });
          return { outcome: "in-sync" };
        }
        try {
          await git.pushCurrent(root, remote.name);
        } catch (error) {
          const message = explain(error);
          this.set(id, { state: "error", message });
          return { outcome: "blocked", message };
        }
        this.set(id, { state: "idle", message: null });
        return { outcome: "pushed" };
      }
      if (st.ahead > 0 && st.behind > 0) {
        this.set(id, {
          state: "diverged",
          message: `This workspace and its remote both have new commits (${st.ahead} local, ${st.behind} remote).`,
        });
        return { outcome: "diverged" };
      }
      if (st.behind > 0) {
        if (!pull) {
          this.set(id, {
            state: "behind",
            message: `${st.behind} commit(s) to pull`,
          });
          return { outcome: "in-sync" };
        }
        const before = await git.head(root);
        try {
          await git.mergeFastForward(root);
        } catch (error) {
          const message = explain(error);
          this.set(id, { state: "error", message: `Cannot pull: ${message}` });
          return { outcome: "blocked", message };
        }
        const files = await git.changedBetween(
          root,
          before,
          await git.head(root),
        );
        this.set(id, { state: "idle", message: null, files });
        this.emit({ type: "pulled", id, files });
        return { outcome: "pulled", files };
      }
      if (st.ahead > 0 && push) {
        try {
          await git.pushCurrent(root, remote.name);
        } catch (error) {
          const message = explain(error);
          this.set(id, { state: "error", message });
          return { outcome: "blocked", message };
        }
        this.set(id, { state: "idle", message: null });
        return { outcome: "pushed" };
      }
      st = await git.status(root);
      this.set(id, {
        state: st.ahead > 0 ? "ahead" : "idle",
        message: st.ahead > 0 ? `${st.ahead} commit(s) to push` : null,
      });
      return { outcome: "in-sync" };
    } finally {
      this.busy.delete(id);
    }
  }

  /**
   * What to do about a diverged workspace.
   *  - "merge": try to merge the remote in; if a file clashes the merge is
   *    undone and the clashing files are named.
   *  - "branch": move on to a new branch of this machine, pushed on its own.
   */
  async resolve(id, choice) {
    if (this.isPaused()) {
      throw new Error("Network is paused");
    }
    const root = this.root(id);
    await this.flush(id);
    if (choice === "merge") {
      const before = await git.head(root);
      const result = await git.mergeUpstream(root);
      if (!result.merged) {
        const files = result.conflicts.length
          ? result.conflicts.join(", ")
          : "some files";
        this.set(id, {
          state: "diverged",
          message: `Cannot merge automatically (${files} changed on both sides). Nothing was changed. You can continue on a new branch instead.`,
        });
        return { outcome: "conflict", conflicts: result.conflicts };
      }
      const files = await git.changedBetween(
        root,
        before,
        await git.head(root),
      );
      this.set(id, {
        state: "ahead",
        message: "Merged. Push to share it.",
        files,
      });
      this.emit({ type: "pulled", id, files });
      return { outcome: "merged", files };
    }
    if (choice === "branch") {
      const now = this.now();
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
        2,
        "0",
      )}${String(now.getDate()).padStart(2, "0")}-${String(
        now.getHours(),
      ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const branch = `ws/${slug(os.hostname()).toLowerCase()}-${stamp}`;
      await git.branchOff(root, branch, (await this.remote(id)).name);
      this.set(id, {
        state: "idle",
        message: `Now on ${branch}, pushed separately.`,
      });
      return { outcome: "branched", branch };
    }
    throw new Error("unknown choice");
  }
}

module.exports = { Sync, explain };
