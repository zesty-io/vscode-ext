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
  zestyConfig.instance.stylesheet = styleObj;
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
  zestyConfig.instance.scipts = scriptObj;
}

async function activate(context) {
  try {
    basePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const zestyData = readConfig(`${basePath}/${zestyPackageConfig}`, "JSON");
    zestyConfig = { ...zestyData, instance: {} };
    zestySDK = new sdk(zestyConfig.instance_zuid, zestyConfig.token);
    await makeFolders(folders);
    await syncInstanceView();
    await syncInstanceStyles();
    await syncInstanceScipts();
    await writeConfig();
  } catch (e) {
    console.log(e);
    vscode.window.showInformationMessage(e.message);
  }
  let disposable = vscode.commands.registerCommand(
    "zesty-vscode-extension.run",
    function () {
      vscode.window.showInformationMessage("Extension is now running!");
    }
  );

  context.subscriptions.push(disposable);
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

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
