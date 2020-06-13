/**
 * WARNING: This demo is a barebones implementation designed for development and evaluation
 * purposes only. It is definitely NOT production ready and does not aim to be so. Exposing the
 * demo to the public as is would introduce security risks for the host.
 **/

var express = require('express');
var expressWs = require('express-ws');
var os = require('os');
var pty = require('node-pty');
import * as vscode from 'vscode';
import { pid } from 'process';

// Whether to use binary transport.
const USE_BINARY = os.platform() !== "win32";

export function startServer() {
  var app = express();
  expressWs(app);

  var terminals: any = {},
    logs: any = {};

  app.use('/xterm.css', express.static(__dirname + '/../css/xterm.css'));
  app.get('/logo.png', (req: any, res: any) => { // lgtm [js/missing-rate-limiting]
    res.sendFile(__dirname + '/logo.png');
  });

  app.get('/', (req: any, res: any) => { // lgtm [js/missing-rate-limiting]
    res.sendFile(__dirname + '/index.html');
  });

  app.get('/test', (req: any, res: any) => { // lgtm [js/missing-rate-limiting]
    res.sendFile(__dirname + '/test.html');
  });

  app.get('/style.css', (req: any, res: any) => { // lgtm [js/missing-rate-limiting]
    res.sendFile(__dirname + '/style.css');
  });

  app.use('/dist', express.static(__dirname + '/dist'));
  app.use('/src', express.static(__dirname + '/src'));

  app.post('/terminals', (req: any, res: any) => {
    const env = Object.assign({}, process.env);
    env['COLORTERM'] = 'truecolor';
    var cols = parseInt(req.query.cols),
      rows = parseInt(req.query.rows),
      term = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
        name: 'xterm-256color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: env.PWD,
        env: env,
        encoding: USE_BINARY ? null : 'utf8'
      });

    console.log('Created terminal with PID: ' + term.pid);
    terminals[term.pid] = term;
    logs[term.pid] = '';
    term.on('data', function (data: any) {
      logs[term.pid] += data;
    });
    res.send(term.pid.toString());
    res.end();
  });

  app.post('/terminals/:pid/size', (req: any, res: any) => {
    var pid = parseInt(req.params.pid),
      cols = parseInt(req.query.cols),
      rows = parseInt(req.query.rows),
      term = terminals[pid];

    term.resize(cols, rows);
    console.log('Resized terminal ' + pid + ' to ' + cols + ' cols and ' + rows + ' rows.');
    res.end();
  });

  app.ws('/terminals/:pid', function (ws: any, req: any) {
    var term = terminals[parseInt(req.params.pid)];
    console.log('Connected to terminal ' + term.pid);
    ws.send(logs[term.pid]);

    // string message buffering
    function buffer(socket: any, timeout: any) {
      let s = '';
      let sender: any = null;
      return (data: any) => {
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
    function bufferUtf8(socket: any, timeout: any) {
      let buffer: any = [];
      let sender: any = null;
      let length: any = 0;
      return (data: any) => {
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

  var port = process.env.PORT || 3000,
    host = os.platform() === 'win32' ? '127.0.0.1' : '0.0.0.0';

  console.log('App listening to http://127.0.0.1:' + port);
  app.listen(port, host);
}

export function webviewServer(webviewPanel: vscode.Webview, context: vscode.ExtensionContext) {
  var terminals: any = {},
    logs: any = {};

  function newTerm(message: any) {
    const env = Object.assign({}, process.env);
    env['COLORTERM'] = 'truecolor';
    var cols = parseInt(message.cols),
      rows = parseInt(message.rows),
      term = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
        name: 'xterm-256color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: env.PWD,
        env: env,
        encoding: USE_BINARY ? null : 'utf8'
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
    term.write(message.data);
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
      }
    },
    undefined,
    context.subscriptions
  );
}

// module.exports = startServer;
