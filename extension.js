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

var zestyPackageConfig = "zesty.json";
var zestySDK = null;
var basePath = "";
var folders = [
  "/webengine",
  "/webengine/views",
  "/webengine/styles",
  "/webengine/scripts",
];
var zestyConfig = {};

function makeDir(dir) {
  if (fs.existsSync(dir)) return;
  fs.mkdirSync(dir);
}

function makeFolders(folders) {
  folders.forEach((folder) => makeDir(basePath + folder));
}

function makeFileSync(type, filename, content) {
  var file = basePath;
  if (type === "view") file += `${folders[1]}/${filename}`;
  if (type === "style") file += `${folders[2]}/${filename}`;
  if (type === "script") file += `${folders[3]}/${filename}`;
  if (!fs.existsSync(file)) {
    makeDir(path.dirname(file));
    fs.writeFileSync(file, content);
  }
}

async function syncInstanceView() {
  var res = await zestySDK.instance.getViews();
  var views = res.data;
  var viewObj = {};
  views.forEach((view) => {
    makeFileSync("view", view.fileName + ".html", view.code || "");
    viewObj[view.fileName] = {
      zuid: view.ZUID,
      updatedAt: view.createdAt,
      createdAt: view.updatedAt,
    };
  });
  zestyConfig.instance.views = viewObj;
}

async function syncInstanceStyles() {
  var res = await zestySDK.instance.getStylesheets();
  var styleObj = {};
  res.data.forEach((stylesheet) => {
    makeFileSync("style", stylesheet.fileName, stylesheet.code);
    styleObj[stylesheet.fileName] = {
      zuid: stylesheet.ZUID,
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
        Authorization: `Bearer ${zestyConfig.token}`,
      },
    }
  );
  var res = await scriptResponse.json();
  var scriptObj = {};
  res.data.forEach((script) => {
    makeFileSync("script", script.fileName, script.code);
    scriptObj[script.fileName] = {
      zuid: script.ZUID,
      updatedAt: script.createdAt,
      createdAt: script.updatedAt,
    };
  });
  zestyConfig.instance.scripts = scriptObj;
}

function readConfig(path, fileType) {
  var res = fs.readFileSync(path, {
    encoding: "utf8",
  });
  return fileType === "JSON" ? JSON.parse(res) : res;
}

async function writeConfig() {
  var path = `${basePath}/${zestyPackageConfig}`;
  if (fs.existsSync(path)) {
    if (
      zestyConfig.hasOwnProperty("instance_zuid") &&
      zestyConfig.hasOwnProperty("token")
    ) {
      await fs.writeFileSync(path, JSON.stringify(zestyConfig, null, 4));
    }
  }
}

async function init() {
  await makeFolders(folders);
  await syncInstanceView();
  await syncInstanceStyles();
  await syncInstanceScipts();
  await writeConfig();
}

async function activate(context) {
  basePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const zestyData = readConfig(`${basePath}/${zestyPackageConfig}`, "JSON");
  zestyConfig = zestyData;
  if (!zestyData.hasOwnProperty("instance")) zestyConfig.instance = {};

  zestySDK = new sdk(zestyConfig.instance_zuid, zestyConfig.token);

  context.subscriptions.push(
    vscode.commands.registerCommand("zesty-vscode-extension.run", init)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("zesty-vscode-extension.saveFile", () => {
      const { activeTextEditor } = vscode.window;
      if (!activeTextEditor) {
        vscode.window.showInformationMessage("There is no open file.");
        return;
      }
      const filePath = activeTextEditor.document.uri;
      var fileBreakDown = filePath.path
        .split("/")
        .splice(Math.max(filePath.path.split("/").length - 2, 0));

      if (activeTextEditor.document.languageId === "html")
        fileBreakDown[1] = fileBreakDown[1].replace(".html", "");

      const fileZuid = zestyConfig.instance[fileBreakDown[0]][fileBreakDown[1]];
      const code = activeTextEditor.document.getText();

      if (fileZuid) {
        if (fileBreakDown[0] === "views") {
          zestySDK.instance.updateView(fileZuid.zuid, {
            code: code,
          });
          vscode.window.showInformationMessage(
            `ZUID : ${fileZuid.zuid} has been updated and sync.`
          );
          activeTextEditor.document.save;
        }
      }
    })
  );
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
