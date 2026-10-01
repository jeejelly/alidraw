# Desktop workspaces: named, git-backed, with a binary backup server
[sw-_file-verdict]: # '@validated(by="maintainer", at=2026-10-05)'

[sw-_file-status]: # '@status(value=open, at=2026-10-05)'

The desktop app edits loose files. A workspace is a named project folder that the app keeps under version control and, optionally, shares and backs up: scenes in git (commit and push automatically), binary assets on a file server (backup, and a source to fetch missing ones from).

Decided:
- git: the machine's own `git`, run by the main process. When it is missing the app says so where the workspace is shown and offers to install it (where the system allows, after asking) or shows the command to run.
- binaries: both. A scene keeps images embedded (standalone file) or refers to them as separate files by content hash (linked, text only); an image carries an action to switch between the two.
- diverged history: stop and ask; when merging by hand is not realistic, offer to push the local line to a branch of its own.
- secrets: a manifest of server entries whose passwords are ciphered with a key held as a ciphered seed; the seed is unlocked by a passphrase asked once per session (or the OS keychain where there is one). Nothing is stored in clear.

## Requirement: A workspace is a named folder
A workspace SHALL have a name, a folder and a list of scenes (`*.excalidraw`, any depth); the app SHALL create one (new folder, `git init` by default, optional remote URL) or open an existing folder, and SHALL remember the recent ones. Settings shared between machines (name, asset policy, commit message template) SHALL live in the folder and be committed; machine-specific ones (path, server, secrets) SHALL NOT.

## Requirement: Saving needs no dialog
In the desktop app, saving a scene file SHALL never show a file dialog or an intermediate "save" popup. With an active workspace the file goes straight into it. Without one, the first save asks only for a folder; that folder becomes the workspace (put under git by default) and the scene is saved in it. Later saves and autosave write silently.

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

## Status
Phases 1-3 are built: workspaces and scenes without dialogs, auto commit with history and restore, remote with push and pull (manual, after each commit, or on an interval; pull on open; fast-forward only), the diverged state with "try to merge" (undone completely when a file clashes) or "continue on a new branch", a switch that pauses all network use, and a reload offer when a pull changes the open scene. Phases 4 (linked or embedded images) and 5 (server backup, ciphered passwords manifest) remain.
