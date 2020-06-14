// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as server from './server';
//import * as index_html from './terminal_frontend/index.html';

let activePanel: vscode.WebviewPanel | null = null;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('terminalEditor.start', () => {
			// Create and show a new webview
			const panel = vscode.window.createWebviewPanel(
				'terminalEditor', // Identifies the type of the webview. Used internally
				'Terminal', // Title of the panel displayed to the user
				vscode.ViewColumn.One, // Editor column to show the new webview panel in.
				{
					enableScripts: true,
					portMapping: [
						{
							extensionHostPort: 3000,
							webviewPort: 80,
						}
					],
					retainContextWhenHidden: true,
				} // Webview options. More on these later.
			);
			server.webviewServer(panel.webview, context);
			activePanel = panel;
			panel.onDidChangeViewState((e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
				if (e.webviewPanel.active) {
					activePanel = e.webviewPanel;
				}
			});

			const cssPath = vscode.Uri.file(path.join(context.extensionPath, 'src', 'xterm.css'));
			//const jsPath = vscode.Uri.file(path.join(context.extensionPath, 'src', 'xterm.js'));
			const clientPath = vscode.Uri.file(path.join(context.extensionPath, 'out', 'client.js'));
			const localUri = vscode.Uri.parse('http://localhost:3000');
			//const jsUri = panel.webview.asWebviewUri(jsPath);
			const cssUri = panel.webview.asWebviewUri(cssPath);
			const clientUri = panel.webview.asWebviewUri(clientPath);
			const serverUri = panel.webview.asWebviewUri(localUri);

			panel.webview.html = getWebviewContent(panel.webview, cssUri, clientUri);
		})
	);

	vscode.commands.registerCommand('terminalEditor.renameTerminal', () => {
		vscode.window.showInputBox().then((title) => {
			if (activePanel && activePanel.active && title) {
				activePanel.title = title;
			}
		});
	});
}

function getWebviewContent(webview: any, xterm_css: vscode.Uri, client_js: vscode.Uri): string {
	function getNonce() {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}
	const nonce = getNonce();

	//<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
	return `<!doctype html>
	<html>

	<head>
	    <link rel="stylesheet" href="${xterm_css}" />
	</head>

	<body>
	    <div id="terminal-container"></div>
		<script src="${client_js}"></script>
	</body>

	</html>`;
}

// this method is called when your extension is deactivated
export function deactivate() { }
