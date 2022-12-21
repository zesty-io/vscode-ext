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
      type: script.type,
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

async function saveFile(document) {
  const filePath = document.uri;
  var fileBreakDown = filePath.path
    .split("/")
    .splice(Math.max(filePath.path.split("/").length - 2, 0));

  if (document.languageId === "html")
    fileBreakDown[1] = fileBreakDown[1].replace(".html", "");

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
            Authorization: `Bearer ${zestyConfig.token}`,
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
  return filename.split(".").pop();
}

async function activate(context) {
  basePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const zestyData = readConfig(`${basePath}/${zestyPackageConfig}`, "JSON");
  zestyConfig = zestyData;
  if (!zestyData.hasOwnProperty("instance")) zestyConfig.instance = {};

  zestySDK = new sdk(zestyConfig.instance_zuid, zestyConfig.token);

  context.subscriptions.push(
    vscode.commands.registerCommand("zesty-vscode-extension.run", async () => {
      await makeFolders(folders);
      await syncInstanceView();
      await syncInstanceStyles();
      await syncInstanceScipts();
      await writeConfig();
    })
  );

  vscode.workspace.onDidSaveTextDocument(async (document) => {
    await saveFile(document);
  });

  vscode.workspace.onDidDeleteFiles(async (event) => {
    if (event.files) {
      const file = event.files[0];
      var filename = getFile(file);
      var fileType = getExtension(filename);
      if (fileType === "css" || fileType === "less" || fileType === "scss") {
        if (zestyConfig.instance.styles.hasOwnProperty(filename)) {
          const style = zestyConfig.instance.styles[filename];
          await zestySDK.instance.deleteStylesheet(style.zuid);
          delete zestyConfig.instance.styles[filename];
          await writeConfig();
          vscode.window.showInformationMessage(
            `Files has been delete and synced to the instance.`
          );
        }
      }

      if (fileType === "js") {
        if (zestyConfig.instance.scripts.hasOwnProperty(filename)) {
          const script = zestyConfig.instance.scripts[filename];
          await fetch(
            `https://${zestyConfig.instance_zuid}.api.zesty.io/v1/web/scripts/${script.zuid}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${zestyConfig.token}`,
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

      if (fileType === "html") {
        if (zestyConfig.instance.views.hasOwnProperty(filename)) {
          const view = zestyConfig.instance.views[filename];
          await fetch(
            `https://${zestyConfig.instance_zuid}.api.zesty.io/v1/web/views/${view.zuid}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${zestyConfig.token}`,
              },
            }
          );
          delete zestyConfig.instance.views[filename];
          await writeConfig();
          vscode.window.showInformationMessage(
            `Files has been delete and synced to the instance.`
          );
        }
      }
    }
  });

  vscode.workspace.onDidCreateFiles(async (event) => {
    if (event.files) {
      const file = event.files[0];
      // var splitPath = file.fsPath.split("\\");
      // var newSplitPath = splitPath.slice(
      //   splitPath.indexOf("webengine"),
      //   splitPath.length
      // );
      // if (newSplitPath[0] === "webengine") newSplitPath.shift();
      // if (["styles", "scripts", "views"].includes(newSplitPath[0]))
      //   newSplitPath.shift();
      var filename = getFile(file);
      var fileType = getExtension(filename);
      var payload = {
        filename: filename,
        type: "snippet",
        code: " ",
      };
      if (fileType === "css" || fileType === "less" || fileType === "scss") {
        payload.type = `text/${fileType}`;
        const res = await zestySDK.instance.createStylesheet(payload);
        if (res.data.ZUID) {
          zestyConfig.instance.styles[filename] = {
            zuid: res.data.ZUID,
            type: res.data.type,
            updatedAt: res.data.updatedAt,
            createdAt: res.data.createdAt,
          };
        }
      }
      if (fileType === "js") {
        payload.type = "text/javascript";
        const result = await fetch(
          `https://${zestyConfig.instance_zuid}.api.zesty.io/v1/web/scripts`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${zestyConfig.token}`,
            },
            body: JSON.stringify(payload),
          }
        );
        const res = await result.json();
        if (res.data.ZUID) {
          zestyConfig.instance.scripts[filename] = {
            zuid: res.data.ZUID,
            type: res.data.type,
            updatedAt: res.data.updatedAt,
            createdAt: res.data.createdAt,
          };
        }
      }
      if (fileType === "html") {
        payload.filename = filename.replace(".html", "");
        const res = await zestySDK.instance.createView(payload);
        if (res.data.ZUID) {
          zestyConfig.instance.views[payload.filename] = {
            zuid: res.data.ZUID,
            updatedAt: res.data.updatedAt,
            createdAt: res.data.createdAt,
          };
        }
      }
      await writeConfig();
      vscode.window.showInformationMessage(
        `Files has been synced to instance.`
      );
    }
  });
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
