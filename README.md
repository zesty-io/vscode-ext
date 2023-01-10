## Getting Started

- Create empty directory for your instance.

```bash
mkdir mydomain.com
```

- Create `zesty.config.json` on your root folder and add your target instance zuid.

```json
{
  "instance_zuid": "YOUR INSTANCE ZUID"
}
```

- Right click the `zesty.config.json` then click `Sync to Instance`
- Input your developer token then press enter.
  - a.) Since there's is no interactive login to refresh the stale token, you need to manually omit once the token expires.
  - b.) Update token through `settings.json` or use command `ctlr + shift + p` and search for `Open Setting (UI)`.
  - c.) On _Workspace_ tab, click `Extension` then s\* ect `Zesty`. All zesty settings will appear, input your token on the `Developer Token` field.
  - d.) Right Click `zesty.config.json` then select `Sync to Instance`.
- Instance files including view, scripts and stylesheet will sync and copied to your local machine..

## Functionality Notes

- Any existing view, stylesheet, or script on a cloud instance will synchronize and become editable through VSCode.
- New files may be created from on the local machine, and they will sync to the cloud content instance
- Javascript and CSS files can be created remotely from the local project, and will be synced to the cloud instance
- Stylesheets and javascript compile in the cloud on save (SASS, SCSS, LESS supported)
- Custom endpoints for xml,json, html, etc. can be created by making a new file in your views folder with an extension
- Adjustment on file under `webengine` folder will automatically sync to the instance.

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
