/**
 * WARNING: This demo is a barebones implementation designed for development and evaluation
 * purposes only. It is definitely NOT production ready and does not aim to be so. Exposing the
 * demo to the public as is would introduce security risks for the host.
 **/

import * as os from 'os';
import * as pty from 'node-pty';
import * as vscode from 'vscode';
import { pid } from 'process';

// Whether to use binary transport.
const USE_BINARY = os.platform() !== "win32";

export function webviewServer(webviewPanel: vscode.Webview, context: vscode.ExtensionContext) {
  var terminals: any = {},
    logs: any = {};

  function newTerm(message: any) {
    const env: any = Object.assign({}, process.env);
    let config = vscode.workspace.getConfiguration('terminalEditors');
    let defaultShell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
    let shellPath = config.get<string>('shellExecutable') || defaultShell;
    env['COLORTERM'] = 'truecolor';
    var cols = parseInt(message.cols),
      rows = parseInt(message.rows),
      term = pty.spawn(shellPath, [], {
        name: 'xterm-256color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: env.PWD,
        env: env,
        encoding: USE_BINARY ? undefined : 'utf8'
      });

    console.log('Created terminal with PID: ' + term.pid);
    terminals[term.pid] = term;
    logs[term.pid] = '';
    term.on('data', function (data: any) {
      logs[data.pid] += data;
      webviewPanel.postMessage({
        'command': 'receivedata',
        'pid': pid,
        'data': data,
      });
    });
    webviewPanel.postMessage({
      'command': 'newterm',
      'pid': term.pid.toString()
    });
  };

  function handleTermMessage(message: any) {
    let pid = message.pid;
    var term = terminals[parseInt(pid)];
    if (term) {
      term.write(message.data);
    } else {
      console.log(`Invalid pid was passed ${pid}`)
    }
  }

  function resize(message: any) {
    let pid = message.pid;
    let rows = message.rows;
    let cols = message.cols;
    let term = terminals[pid];
    term.resize(cols, rows);
  }

  webviewPanel.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'newterm':
          newTerm(message);
          return;
        case 'termmessage':
          handleTermMessage(message);
          return;
        case 'resize':
          resize(message);
          return;
      }
    },
    undefined,
    context.subscriptions
  );
}

// module.exports = startServer;
