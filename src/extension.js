// @ts-nocheck
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const sdk = require("@zesty-io/sdk");
const auth = new sdk.Auth();
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
  fs.mkdirSync(dir, { recursive: true });
}

function makeFolders(folders) {
  folders.forEach((folder) => makeDir(basePath + folder));
}

async function validate() {
  token = vscode.workspace.getConfiguration("zesty.editor").get("token");
  const res = await auth.verifyToken(token);
  if (!res.verified) vscode.window.showErrorMessage(res.message);
  return res;
}

async function init() {
  const pathConfig = `${basePath}/${zestyPackageConfig}`;
  if (!fs.existsSync(pathConfig)) return false;
  zestyConfig = readConfig(pathConfig, "JSON");
  if (!zestyConfig.hasOwnProperty("instance_zuid")) {
    vscode.window.showErrorMessage("Missing instance zuid on config file.");
    return false;
  }
  const isVerified = await validate();
  if (!isVerified.verified) {
    const devToken = await vscode.window.showInputBox({
      value: "",
      placeHolder: "Please Enter your DEVELOPER TOKEN",
    });
    if (devToken === "" || devToken === undefined) {
      vscode.window.showErrorMessage("Developer Token is required to proceed.");
      return false;
    }
    const configuration = vscode.workspace.getConfiguration("zesty.editor");
    await configuration.update("token", devToken);
    const revalidate = await validate();
    if (!revalidate.verified) return false;
  }
  zestySDK = new sdk(zestyConfig.instance_zuid, token);
  return true;
}

function makeFileSync(type, filename, content) {
  try {
    var file = basePath;
    if (type === "view")
      file += `${folders[1]}/${
        filename.charAt(0) !== "/" ? filename : filename.substring(1)
      }`;
    if (type === "style") file += `${folders[2]}/${filename}`;
    if (type === "script") file += `${folders[3]}/${filename}`;
    if (type === "config") file += filename;

    makeDir(path.dirname(file));
    fs.writeFileSync(file, content);
  } catch (e) {}
}

async function syncInstanceView() {
  const res = await zestySDK.instance.getViews();
  var views = res.data;
  var viewObj = {};
  views.forEach((view) => {
    makeFileSync("view", view.fileName, view.code || "");
    viewObj[view.fileName] = {
      zuid: view.ZUID,
      type: view.type,
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

async function request(url, method, payload) {
  var opts = {
    method: method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  if (method !== "GET") opts.body = JSON.stringify(payload);

  const res = await fetch(url, opts);
  return res.json();
}

function getFileDetails(file) {
  var fileArray = file.split("/");
  fileArray.splice(0, fileArray.indexOf("webengine"));
  var baseDir = fileArray.shift();
  var type = fileArray.shift();
  if (baseDir !== "webengine") return {};
  var filename = fileArray.join("/");
  var extension = getExtension(filename);
  if (extension !== undefined && type === "views") filename = "/" + filename;
  var instance = zestyConfig.instance[type][filename];

  return {
    filename,
    baseDir,
    type,
    extension,
    instance,
  };
}

async function saveFile(document) {
  if (!(await init())) return;

  const file = getFileDetails(document.uri.path);
  if (!file.instance) return;
  const code = document.getText();
  const payload = {
    filename: file.filename,
    code: code || " ",
    type: file.instance.type,
  };

  if (file.type) {
    switch (file.type) {
      case "views":
        const updateView = await zestySDK.instance.updateView(
          file.instance.zuid,
          {
            code: payload.code,
          }
        );

        if (updateView.error) {
          vscode.window.showErrorMessage(
            `Script cannot sync to ${file.instance.zuid}. Error : ${updateView.error}`
          );
          return;
        }
        vscode.window.showInformationMessage(
          `ZUID : ${file.instance.zuid} has been updated and sync.`
        );
        break;
      case "styles":
        const updateStyle = await zestySDK.instance.updateStylesheet(
          file.instance.zuid,
          payload
        );
        if (updateStyle.error) {
          vscode.window.showErrorMessage(
            `Stylesheet cannot sync to ${file.instance.zuid}. Error : ${updateStyle.error}.`
          );
          return;
        }
        vscode.window.showInformationMessage(
          `ZUID : ${file.instance.zuid} has been updated and sync.`
        );
        break;
      case "scripts":
        const updateScript = await request(
          `https://${zestyConfig.instance_zuid}.api.zesty.io/v1/web/scripts/${file.instance.zuid}`,
          "PUT",
          payload
        );
        if (updateScript.error) {
          vscode.window.showErrorMessage(
            `Stylesheet cannot sync to ${file.instance.zuid}. Error : ${updateScript.error}.`
          );
          return;
        }
        vscode.window.showInformationMessage(
          `ZUID : ${file.instance.zuid} has been updated and sync.`
        );
        break;
      default:
        vscode.window.showErrorMessage(`Cannot find file`);
    }
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
  var ext = /[^.]+$/.exec(filename);
  return /[.]/.exec(filename) ? ext[0] : undefined;
}

function loadConfig() {
  var path = `${basePath}/${zestyPackageConfig}`;
  if (fs.existsSync(path)) {
    const zestyData = readConfig(`${basePath}/${zestyPackageConfig}`, "JSON");
    zestyConfig = zestyData;
    if (!zestyData.hasOwnProperty("instance")) zestyConfig.instance = {};
  }
}

function isDirectory(path) {
  return fs.lstatSync(path).isDirectory();
}

async function activate(context) {
  basePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  await init();
  // loadConfig();
  // token = getDeveloperToken();
  // if (token !== "") zestySDK = new sdk(zestyConfig.instance_zuid, token);

  context.subscriptions.push(
    vscode.commands.registerCommand("zesty-vscode-extension.run", async () => {
      try {
        if (!(await init())) return;
        if (!zestyConfig.hasOwnProperty("instance")) zestyConfig.instance = {};
        await makeFolders(folders);
        await syncInstanceView();
        await syncInstanceStyles();
        await syncInstanceScipts();
        await writeConfig();
        await createGitIgnore();
      } catch (e) {
        console.log(e);
      }
    })
  );

  vscode.workspace.onDidSaveTextDocument(async (document) => {
    if (!isFileSaveSyncEnabled()) return;
    await saveFile(document);
  });

  vscode.workspace.onDidDeleteFiles(async (event) => {
    if (!(await init())) return;
    if (!isFileDeleteSyncEnabled()) return;
    if (event.files.length > 1) {
      vscode.window.showErrorMessage(
        `Multiple file deletion is not yet supported.`
      );
      return;
    }
    if (event.files) {
      const file = event.files[0];
      var filename = getFile(file);
      var fileType = getExtension(filename);

      switch (fileType) {
        case "css":
        case "less":
        case "scss":
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
        case "js":
          if (zestyConfig.instance.scripts.hasOwnProperty(filename)) {
            const script = zestyConfig.instance.scripts[filename];
            await request(
              `https://${zestyConfig.instance_zuid}.api.zesty.io/v1/web/scripts/${script.zuid}`,
              "DELETE",
              {}
            );
            delete zestyConfig.instance.scripts[filename];
            await writeConfig();
            vscode.window.showInformationMessage(
              `Files has been delete and synced to the instance.`
            );
          }
          break;
        default:
          var filenameEdit = fileType === undefined ? filename : `/${filename}`;
          if (zestyConfig.instance.views.hasOwnProperty(filenameEdit)) {
            const view = zestyConfig.instance.views[filenameEdit];
            await request(
              `https://${zestyConfig.instance_zuid}.api.zesty.io/v1/web/views/${view.zuid}`,
              "DELETE",
              {}
            );
            delete zestyConfig.instance.views[filenameEdit];
            await writeConfig();
            vscode.window.showInformationMessage(
              `Files has been delete and synced to the instance.`
            );
          }
          break;
      }
    }
  });

  vscode.workspace.onDidCreateFiles(async (event) => {
    if (!(await init())) return;
    if (event.files) {
      const file = event.files[0];
      if (isDirectory(file.fsPath)) return;
      var filename = getFile(file);
      var fileType = getExtension(filename);
      var payload = {
        filename: filename,
        type: "ajax-json",
        code: " ",
      };

      switch (fileType) {
        case "css":
        case "less":
        case "scss":
          payload.type = `text/${fileType}`;
          var resStyle = await zestySDK.instance.createStylesheet(payload);
          if (!resStyle.error) {
            zestyConfig.instance.styles[filename] = {
              zuid: resStyle.data.ZUID,
              type: resStyle.data.type,
              updatedAt: resStyle.data.updatedAt,
              createdAt: resStyle.data.createdAt,
            };
            await writeConfig();
            vscode.window.showInformationMessage(
              `Saving stylesheet to ${resStyle.data.ZUID}.`
            );
          }
          break;
        case "js":
          payload.type = "text/javascript";
          var resScript = await request(
            `https://${zestyConfig.instance_zuid}.api.zesty.io/v1/web/scripts`,
            "POST",
            payload
          );
          if (!resScript.error) {
            zestyConfig.instance.scripts[filename] = {
              zuid: resScript.data.ZUID,
              type: resScript.data.type,
              updatedAt: resScript.data.updatedAt,
              createdAt: resScript.data.createdAt,
            };
            await writeConfig();
            vscode.window.showInformationMessage(
              `Saving script to ${resScript.data.ZUID}.`
            );
          }
          break;
        case undefined:
          // payload.filename = filename.replace(".html", "");
          payload.type = "snippet";
          var resSnippet = await zestySDK.instance.createView(payload);
          if (!resSnippet.error) {
            zestyConfig.instance.views[payload.filename] = {
              zuid: resSnippet.data.ZUID,
              type: resSnippet.data.type,
              updatedAt: resSnippet.data.updatedAt,
              createdAt: resSnippet.data.createdAt,
            };
            await writeConfig();
            vscode.window.showInformationMessage(
              `Saving file to ${resSnippet.data.ZUID}.`
            );
          }
          break;
        default:
          payload.filename = `/${payload.filename}`;
          var resCustom = await zestySDK.instance.createView(payload);
          if (!resCustom.error) {
            zestyConfig.instance.views[payload.filename] = {
              zuid: resCustom.data.ZUID,
              type: resCustom.data.type,
              updatedAt: resCustom.data.updatedAt,
              createdAt: resCustom.data.createdAt,
            };
            await writeConfig();
            vscode.window.showInformationMessage(
              `Saving file to ${resCustom.data.ZUID}.`
            );
          }
          break;
      }
    }
  });
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
