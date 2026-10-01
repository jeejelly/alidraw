# Desktop workspaces: named, git-backed, with a binary backup server
[sw-_file-verdict]: # '@validated(by="maintainer", at=2026-10-05)'

[sw-_file-status]: # '@status(value=open, at=2026-10-05)'

The desktop app edits loose files. A workspace is a named project folder that the app keeps under version control and, optionally, shares and backs up: scenes in git (commit and push automatically), binary assets on a file server (backup, and a source to fetch missing ones from).

Undecided, and the first things to settle:
- git: the machine's own `git` through the main process (credential helpers and ssh agent come for free, must be installed) or a pure-JS implementation bundled with the app (no dependency, no ssh agent, slower)
- binaries: keep images embedded in the scene (nothing changes, repositories grow) or store them beside the scene by content hash (the scene file stays small and diffable, a file format step)
- diverged history: never merge scene JSON; stop and ask, or push the local line to a branch of its own
- secrets: OS keychain only, or also prompt each session when none is available

## Requirement: A workspace is a named folder
A workspace SHALL have a name, a folder and a list of scenes (`*.excalidraw`, any depth); the app SHALL create one (new folder, `git init` by default, optional remote URL) or open an existing folder, and SHALL remember the recent ones. Settings shared between machines (name, asset policy, commit message template) SHALL live in the folder and be committed; machine-specific ones (path, server, secrets) SHALL NOT.

## Requirement: Scenes open and save inside it
Opening, saving and autosave of a scene in a workspace SHALL go through the same file code as any file, writing through the main process; paths SHALL be confined to the workspace folder.

## Requirement: Auto commit
After edits pause (default 60 s) and the file is saved, the workspace SHALL commit only the changed tracked paths with a templated message; unchanged content SHALL produce no commit; "commit now", history of a scene and restoring an earlier version of it SHALL be available. Scene JSON SHALL be written in a stable order so diffs are readable.

## Requirement: Share by push and pull
A workspace MAY have a remote. Push policy SHALL be manual, after each commit, or on an interval; pull SHALL be fast-forward only. When history has diverged the app SHALL stop pushing, show the state and offer choices; it SHALL never force-push, reset or rewrite history. Authentication SHALL be left to git's own credential and ssh mechanisms, and no token SHALL be stored by the app.

## Requirement: Binary backup server
A workspace MAY define a file server (SFTP or FTPS; plain FTP only after an explicit warning) and a folder on it. Binary assets SHALL be uploaded there by content hash when saved (backup), and missing assets SHALL be fetched from it on open (work server). With a server defined, binaries MAY be kept out of git. Passwords SHALL be stored only in the OS keychain.

## Requirement: Network is explicit
The app SHALL stay offline unless a workspace has a remote or a server; every such connection SHALL be made by the main process to the host the user entered, shown in the workspace panel, with a switch to pause all of it. The page itself SHALL still be unable to reach any host.

## Requirement: Safe by construction
Commands SHALL be run without a shell with argument lists; remote URLs SHALL be validated (no local-command transports); a missing `git` SHALL be reported with what to install, not worked around.

## Phases
1. Bridge, registry, create/open, scene tree, file handle shim over the bridge.
2. Git: init, status, auto commit, history, restore.
3. Remote: push, pull, policies, diverged state.
4. External assets by content hash.
5. Server: backup and fetch-on-open, keychain, pause switch.
