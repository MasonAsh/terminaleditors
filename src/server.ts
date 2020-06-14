/**
 * WARNING: This demo is a barebones implementation designed for development and evaluation
 * purposes only. It is definitely NOT production ready and does not aim to be so. Exposing the
 * demo to the public as is would introduce security risks for the host.
 **/

import * as os from 'os';
import * as pty from 'node-pty';
import * as vscode from 'vscode';
import { pid } from 'process';
import * as express from 'express';
import * as expressWs from 'express-ws';

// Whether to use binary transport.
const USE_BINARY = os.platform() !== "win32";

let app: expressWs.Application | null;
let terminals: any = {},
  logs: any = {};

export function webviewServer(webviewPanel: vscode.Webview, context: vscode.ExtensionContext) {

  if (app == null) {
    app = expressWs(express()).app;

    var port = 3000,
      host = os.platform() === 'win32' ? '127.0.0.1' : '0.0.0.0';

    app.ws('/:pid', (ws, req) => {
      var term = terminals[parseInt(req.params.pid)];
      console.log('Connected to terminal ' + term.pid);
      ws.send(logs[term.pid]);

      // string message buffering
      function buffer(socket: any, timeout: number) {
        let s = '';
        let sender: NodeJS.Timeout | null = null;
        return (data: string) => {
          s += data;
          if (!sender) {
            sender = setTimeout(() => {
              socket.send(s);
              s = '';
              sender = null;
            }, timeout);
          }
        };
      }
      // binary message buffering
      function bufferUtf8(socket: any, timeout: number) {
        let buffer: Uint8Array[] = [];
        let sender: NodeJS.Timeout | null = null;
        let length = 0;
        return (data: Uint8Array) => {
          buffer.push(data);
          length += data.length;
          if (!sender) {
            sender = setTimeout(() => {
              socket.send(Buffer.concat(buffer, length));
              buffer = [];
              sender = null;
              length = 0;
            }, timeout);
          }
        };
      }
      const send = USE_BINARY ? bufferUtf8(ws, 5) : buffer(ws, 5);

      term.on('data', function (data: any) {
        try {
          send(data);
        } catch (ex) {
          // The WebSocket is not open, ignore
        }
      });
      ws.on('message', function (msg: any) {
        term.write(msg);
      });
      ws.on('close', function () {
        term.kill();
        console.log('Closed terminal ' + term.pid);
        // Clean things up
        delete terminals[term.pid];
        delete logs[term.pid];
      });
    });

    console.log('App listening to http://127.0.0.1:' + port);
    app.listen(port, host || '', () => { });
  }

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
