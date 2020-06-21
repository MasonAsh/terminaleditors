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
import { Server } from 'http';
import { AddressInfo } from 'net';

// Whether to use binary transport.
const USE_BINARY = os.platform() !== "win32";

export class TerminalServer {
  terminals: any = {};
  logs: any = {};
  app!: expressWs.Application;
  server!: Server;

  constructor() {
    this.startServer();
  }

  startServer() {
    this.app = expressWs(express()).app;

    const host = os.platform() === 'win32' ? '127.0.0.1' : '0.0.0.0';

    this.app.ws('/:pid', (ws, req) => {
      var term = this.terminals[parseInt(req.params.pid)];
      console.log('Connected to terminal ' + term.pid);
      ws.send(this.logs[term.pid]);

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
      ws.on('close', () => {
        term.kill();
        console.log('Closed terminal ' + term.pid);
        // Clean things up
        delete this.terminals[term.pid];
        delete this.logs[term.pid];
      });
    });

    this.server = this.app.listen(0, host || '', () => {
      let address = this.server.address() as AddressInfo;
      console.log('Started terminal websocket server on ' + 'ws://' + address.address + ':' + address.port);
    });
  }

  newTerm(webview: vscode.Webview, message: any) {
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
    this.terminals[term.pid] = term;
    this.logs[term.pid] = '';
    let pid = term.pid;
    term.onData((data: any) => {
      this.logs[pid] += data;
    });
    term.onExit(() => {
      webview.postMessage({
        command: 'exit'
      });
    });
    let address = this.server.address() as AddressInfo;
    webview.postMessage({
      'command': 'newterm',
      'pid': term.pid.toString(),
      'websocket': 'ws://' + address.address + ':' + address.port,
    });
  }

  handleTermMessage(webview: vscode.Webview, message: any) {
    let pid = message.pid;
    var term = this.terminals[parseInt(pid)];
    if (term) {
      term.write(message.data);
    } else {
      console.log(`Invalid pid was passed ${pid}`)
    }
  }

  resize(message: any) {
    let pid = message.pid;
    let rows = message.rows;
    let cols = message.cols;
    let term = this.terminals[pid];
    term.resize(cols, rows);
  }

  connectWebView(webview: vscode.Webview, context: vscode.ExtensionContext) {
    webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'newterm':
            this.newTerm(webview, message);
            return;
          case 'termmessage':
            this.handleTermMessage(webview, message);
            return;
          case 'resize':
            this.resize(message);
            return;
        }
      },
      undefined,
      context.subscriptions
    );
  }
}

// module.exports = startServer;
