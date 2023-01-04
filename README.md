## Getting Started

- Create `zesty.config.json` on your root folder and add your target instance zuid.

```json
{
  "instance_zuid": "YOUR INSTANCE ZUID"
}
```

- Right click the `zesty.config.json` then select `Sync to Instance`
- Input your developer token then press enter.
- it will automatically sync all the files from instance including views, styles and js.

## Requirements

- Zesty account is require. create your account at https://www.zesty.io/join/

## Extension Settings

This extension contributes the following settings:

- `zesty.editor.token` : Store developer token from the account.
- `zesty.editor.syncFileOnSave` : Default to `true`. Automatically sync save to cloud instance.
- `zesty.editor.syncFileOnDelete` : Default to `true`. Automatically sync file deletion to clound instance.

## Known Issues

Submit issues on github https://github.com/zesty-io/vscode-ext/issues

## Release Notes

### 0.0.1

Phase 1 Release

- Zesty Plugin will be available on VSCode Extension Store.
- Configuration will be needed to synchronize your codebase to zesty instance.
- Configuration will match the Next.js configuration file.
- Files will be stored to webengine folder, with option to change the folder name to change the folder root, to match the atom plugin behavior .
- Files will sync down with command in VSCode.
- New files will be created and sync to zesty project.
- Files by default will automatically save on save, with an option to sync with a VS Code command, with an option to turn off synchronization on save. (maybe)
- Deleting file synchronization can be turn off. Notification should prompt before deletion.
- Options will be stored on a .vscode configuration file.
- Vscode will be a opensource codebase on github. https://github.com/zesty-io/vscode-ext
- Submit feature requests https://github.com/zesty-io/vscode-ext/issues/new/choose
- Submit bugs https://github.com/zesty-io/vscode-ext/issues/new/choose
- Command for zesty init will create a shell zesty.json config file.
- Sneak peak video https://www.youtube.com/watch?v=2pCqhK9iy2E
