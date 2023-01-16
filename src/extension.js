// @ts-nocheck
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const sdk = require("@zesty-io/sdk");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

var zestyPackageConfig = "zesty.config.json";
var zestySDK = null;
var basePath = "";
var folders = [
  "/webengine",
  "/webengine/views",
  "/webengine/styles",
  "/webengine/scripts",
];
var zestyConfig = {};
var token = "";

function makeDir(dir) {
  if (fs.existsSync(dir)) return;
  fs.mkdirSync(dir);
}

function makeFolders(folders) {
  folders.forEach((folder) => makeDir(basePath + folder));
}

function findConfig(){
  const pathConfig  = `${basePath}/${zestyPackageConfig}`;
  return fs.existsSync(pathConfig) && fs.existsSync()
}

function makeFileSync(type, filename, content) {
  var file = basePath;
  if (type === "view") file += `${folders[1]}/${filename}`;
  if (type === "style") file += `${folders[2]}/${filename}`;
  if (type === "script") file += `${folders[3]}/${filename}`;
  if (type === "config") file += `${filename}`;
  if (!fs.existsSync(file)) {
    makeDir(path.dirname(file));
    fs.writeFileSync(file, content);
  }
}

async function syncInstanceView() {
  const res = await zestySDK.instance.getViews();
  var views = res.data;
  var viewObj = {};
  views.forEach((view) => {
    makeFileSync("view", view.fileName, view.code || "");
    viewObj[view.fileName] = {
      zuid: view.ZUID,
      updatedAt: view.createdAt,
      createdAt: view.updatedAt,
    };
  });
  zestyConfig.instance.views = viewObj;
}

async function syncInstanceStyles() {
  const res = await zestySDK.instance.getStylesheets();
  var styleObj = {};
  res.data.forEach((stylesheet) => {
    makeFileSync("style", stylesheet.fileName, stylesheet.code);
    styleObj[stylesheet.fileName] = {
      zuid: stylesheet.ZUID,
      type: stylesheet.type,
      updatedAt: stylesheet.createdAt,
      createdAt: stylesheet.updatedAt,
    };
  });
  zestyConfig.instance.styles = styleObj;
}

async function syncInstanceScipts() {
  var scriptResponse = await fetch(
    `https://${zestyConfig.instance_zuid}.api.zesty.io/v1/web/scripts`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const res = await scriptResponse.json();
  var scriptObj = {};
  res.data.forEach((script) => {
    makeFileSync("script", script.fileName, script.code);
    scriptObj[script.fileName] = {
      zuid: script.ZUID,
      type: script.type,
      updatedAt: script.createdAt,
      createdAt: script.updatedAt,
    };
  });
  zestyConfig.instance.scripts = scriptObj;
}

function readConfig(path, fileType) {
  const res = fs.readFileSync(path, {
    encoding: "utf8",
  });
  return fileType === "JSON" ? JSON.parse(res) : res;
}

async function writeConfig() {
  var path = `${basePath}/${zestyPackageConfig}`;
  if (fs.existsSync(path)) {
    if (zestyConfig.hasOwnProperty("instance_zuid") && token !== "") {
      await fs.writeFileSync(path, JSON.stringify(zestyConfig, null, 4));
    }
  }
}

async function createGitIgnore() {
  var path = `${basePath}/.gitignore`;
  if (!fs.existsSync(path)) {
    await fs.writeFileSync(path, "zesty.json");
  }
}

function isFileSaveSyncEnabled() {
  const fileSaveConfig = vscode.workspace
    .getConfiguration("zesty.editor")
    .get("syncFileOnSave");
  return fileSaveConfig;
}

function isFileDeleteSyncEnabled() {
  const fileDeleteConfig = vscode.workspace
    .getConfiguration("zesty.editor")
    .get("syncFileOnDelete");

  return fileDeleteConfig;
}

function getDeveloperToken() {
  const token = vscode.workspace.getConfiguration("zesty.editor").get("token");

  return token;
}

async function saveFile(document) {
  if(!findConfig()) return;
  const filePath = document.uri;
  var fileBreakDown = filePath.path
    .split("/")
    .splice(Math.max(filePath.path.split("/").length - 2, 0));

  if (!zestyConfig.instance.hasOwnProperty(fileBreakDown[0])) return;

  const fileZuid = zestyConfig.instance[fileBreakDown[0]][fileBreakDown[1]];
  const code = document.getText();

  if (fileZuid) {
    if (fileBreakDown[0] === "views") {
      await zestySDK.instance.updateView(fileZuid.zuid, {
        code: code,
      });
    }

    if (fileBreakDown[0] === "styles") {
      await zestySDK.instance.updateStylesheet(fileZuid.zuid, {
        filename: fileBreakDown[1],
        type: fileZuid.type,
        code: code,
      });
    }
    if (fileBreakDown[0] === "scripts") {
      await fetch(
        `https://${zestyConfig.instance_zuid}.api.zesty.io/v1/web/scripts/${fileZuid.zuid}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: fileBreakDown[1],
            code: code,
            type: fileZuid.type,
          }),
        }
      );
    }

    vscode.window.showInformationMessage(
      `ZUID : ${fileZuid.zuid} has been updated and sync.`
    );
  }
}

function getFile(file) {
  var splitPath = file.fsPath.split("\\");
  var newSplitPath = splitPath.slice(
    splitPath.indexOf("webengine"),
    splitPath.length
  );
  if (newSplitPath[0] === "webengine") newSplitPath.shift();
  if (["styles", "scripts", "views"].includes(newSplitPath[0]))
    newSplitPath.shift();
  return newSplitPath.join("/");
}

function getExtension(filename) {
  return (/[.]/.exec(filename)) ? /[^.]+$/.exec(filename) : undefined;
}

function loadConfig() {
  var path = `${basePath}/${zestyPackageConfig}`;
  if (fs.existsSync(path)) {
    const zestyData = readConfig(`${basePath}/${zestyPackageConfig}`, "JSON");
    zestyConfig = zestyData;
    if (!zestyData.hasOwnProperty("instance")) zestyConfig.instance = {};
  }
}

async function validateToken() {
  const auth = sdk.Auth();
  token = getDeveloperToken();

  if (token === "") {
    vscode.window.showErrorMessage(
      "Cannot find `instance_zuid` on the config file."
    );
  }
}

async function activate(context) {
  basePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  loadConfig();
  token = getDeveloperToken();
  if (token !== "") zestySDK = new sdk(zestyConfig.instance_zuid, token);

  context.subscriptions.push(
    vscode.commands.registerCommand("zesty-vscode-extension.run", async () => {
      loadConfig();
      if (!zestyConfig.hasOwnProperty("instance_zuid")) {
        vscode.window.showErrorMessage(
          "Cannot find `instance_zuid` on the config file."
        );
        return;
      }
      token = getDeveloperToken();

      if (token === "") {
        const devToken = await vscode.window.showInputBox({
          value: "",
          placeHolder: "Please Enter your DEVELOPER TOKEN",
        });
        if (devToken === "" || devToken === undefined) {
          vscode.window.showErrorMessage(
            "Developer Token is required to proceed."
          );
          return;
        }
        const configuration = vscode.workspace.getConfiguration("zesty.editor");
        await configuration.update("token", devToken);
        token = devToken;
      }

      zestySDK = new sdk(zestyConfig.instance_zuid, token);

      await makeFolders(folders);
      await syncInstanceView();
      await syncInstanceStyles();
      await syncInstanceScipts();
      await writeConfig();
      await createGitIgnore();
    })
  );

  vscode.workspace.onDidSaveTextDocument(async (document) => {
    if (!isFileSaveSyncEnabled()) return;
    await saveFile(document);
  });

  vscode.workspace.onDidDeleteFiles(async (event) => {
    if(!findConfig()) return;
    if (!isFileDeleteSyncEnabled()) return;
    if (event.files) {
      const file = event.files[0];
      var filename = getFile(file);
      var fileType = getExtension(filename);

      switch(fileType){
        case "css" :
        case "less" :
        case "scss" :
          if (zestyConfig.instance.styles.hasOwnProperty(filename)) {
            const style = zestyConfig.instance.styles[filename];
            await zestySDK.instance.deleteStylesheet(style.zuid);
            delete zestyConfig.instance.styles[filename];
            await writeConfig();
            vscode.window.showInformationMessage(
              `Files has been delete and synced to the instance.`
            );
          }
          break;
        case "js" :
          if (zestyConfig.instance.scripts.hasOwnProperty(filename)) {
            const script = zestyConfig.instance.scripts[filename];
            await fetch(
              `https://${zestyConfig.instance_zuid}.api.zesty.io/v1/web/scripts/${script.zuid}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            delete zestyConfig.instance.scripts[filename];
            await writeConfig();
            vscode.window.showInformationMessage(
              `Files has been delete and synced to the instance.`
            );
          }
          break;
        default :
          var filenameEdit = fileType === undefined ? filename : `/${filename}`;
          if (zestyConfig.instance.views.hasOwnProperty(filenameEdit)) {
            const view = zestyConfig.instance.views[filenameEdit];
            await fetch(
              `https://${zestyConfig.instance_zuid}.api.zesty.io/v1/web/views/${view.zuid}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            delete zestyConfig.instance.views[filenameEdit];
            await writeConfig();
            vscode.window.showInformationMessage(
              `Files has been delete and synced to the instance.`
            );
          }
          break;
      }

      if (fileType === "js") {
        if (zestyConfig.instance.scripts.hasOwnProperty(filename)) {
          const script = zestyConfig.instance.scripts[filename];
          await fetch(
            `https://${zestyConfig.instance_zuid}.api.zesty.io/v1/web/scripts/${script.zuid}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          delete zestyConfig.instance.scripts[filename];
          await writeConfig();
          vscode.window.showInformationMessage(
            `Files has been delete and synced to the instance.`
          );
        }
      }
    }
  });

  vscode.workspace.onDidCreateFiles(async (event) => {
    if(!findConfig()) return
    if (event.files) {
      const file = event.files[0];
      var filename = getFile(file);
      var fileType = getExtension(filename);
      var payload = {
        filename: filename,
        type: "ajax-json",
        code: " ",
      };

      switch(fileType){
        case "css" : 
        case "less" : 
        case "scss" :
          payload.type = `text/${fileType}`;
          var resStyle = await zestySDK.instance.createStylesheet(payload);
          if (!resStyle.error) {
            zestyConfig.instance.styles[filename] = {
              zuid: resStyle.data.ZUID,
              type: resStyle.data.type,
              updatedAt: resStyle.data.updatedAt,
              createdAt: resStyle.data.createdAt,
            };
            vscode.window.showInformationMessage(
              `Saving stylesheet to ${resStyle.data.ZUID}.`
            );
          }
          break;
        case "js" :
          payload.type = "text/javascript";
          var result = await fetch(
            `https://${zestyConfig.instance_zuid}.api.zesty.io/v1/web/scripts`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${zestyConfig.token}`,
              },
              body: JSON.stringify(payload),
            }
          );
          var resScript = await result.json();
          if (!resScript.error) {
            zestyConfig.instance.scripts[filename] = {
              zuid: resScript.data.ZUID,
              type: resScript.data.type,
              updatedAt: resScript.data.updatedAt,
              createdAt: resScript.data.createdAt,
            };
            vscode.window.showInformationMessage(
              `Saving script to ${resScript.data.ZUID}.`
            );
          }
          break;
        case undefined :
          // payload.filename = filename.replace(".html", "");
          payload.type = "snippet";
          var resSnippet = await zestySDK.instance.createView(payload);
          if (!resSnippet.error) {
            zestyConfig.instance.views[payload.filename] = {
              zuid: resSnippet.data.ZUID,
              updatedAt: resSnippet.data.updatedAt,
              createdAt: resSnippet.data.createdAt,
            };
            vscode.window.showInformationMessage(
              `Saving file to ${resSnippet.data.ZUID}.`
            );
          }
          break;
        default :
          payload.filename = `/${payload.filename}`
          var resCustom = await zestySDK.instance.createView(payload)
          if(!resCustom.error){
            zestyConfig.instance.views[payload.filename] = {
              zuid: resCustom.data.ZUID,
              updatedAt: resCustom.data.updatedAt,
              createdAt: resCustom.data.createdAt,
            }
            vscode.window.showInformationMessage(
              `Saving file to ${resCustom.data.ZUID}.`
            );
          }
          break
          
      }
      await writeConfig();
    }
  });
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
