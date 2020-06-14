import * as xterm from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebglAddon } from 'xterm-addon-webgl';
import { Unicode11Addon } from 'xterm-addon-unicode11';
import { AttachAddon } from 'xterm-addon-attach';

const terminalContainer = document.getElementById('terminal-container')!;

let term = new xterm.Terminal({
    windowsMode: false,
} as xterm.ITerminalOptions);

function connectToTerminalWebSocket() {
    let socket = new WebSocket(`ws://127.0.0.1:3000/${pid}`);
    socket.onopen = () => {
        term.loadAddon(new AttachAddon(socket));
        fitAddon.fit();

        term.setOption('fontFamily', 'courier-new, courier, monospace');
        term.setOption('fontSize', '15');
        term.setOption('rendererType', 'canvas');
    };
}

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);

const unicode11Addon = new Unicode11Addon();
term.loadAddon(unicode11Addon);
term.unicode.activeVersion = '11';

term.open(terminalContainer);

const webglAddon = new WebglAddon();
term.loadAddon(webglAddon);

terminalContainer.style.width = '100%';
terminalContainer.style.height = '100vh'

let pid: string | null = null;

declare function acquireVsCodeApi(): any;

const vscode = acquireVsCodeApi();

setTimeout(() => {
    term.focus();

    vscode.postMessage({
        command: 'newterm',
        rows: 40,
        cols: 120,
    });
}, 0);

window.addEventListener('message', event => {
    const message = event.data; // The JSON data our extension sent

    switch (message.command) {
        case 'newterm':
            pid = message.pid;
            connectToTerminalWebSocket();
            break;
        case 'redraw':
            term.refresh(0, term.rows - 1);
            break;
    }
});

// term.onData(data => {
//     vscode.postMessage({
//         'command': 'termmessage',
//         'pid': pid,
//         'data': data,
//     });
// });

term.attachCustomKeyEventHandler((event) => {
    if (event.getModifierState('Control') && event.key == 'p') {
        return false;
    }

    return true;
});

window.addEventListener('resize', () => {
    fitAddon.fit();

});

term.onResize((size: { cols: number, rows: number }) => {
    vscode.postMessage({
        'command': 'resize',
        'pid': pid,
        'rows': size.rows,
        'cols': size.cols,
    });
});