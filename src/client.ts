import * as xterm from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

const terminalContainer = document.getElementById('terminal-container')!;

var term = new xterm.Terminal();

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);

term.open(terminalContainer);

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
            fitAddon.fit();
            break;
        case 'receivedata':
            let data = message.data;
            term.write(data);
            break;
    }
});

term.onData(data => {
    vscode.postMessage({
        'command': 'termmessage',
        'pid': pid,
        'data': data,
    });
});

term.attachCustomKeyEventHandler((event) => {
    if (event.getModifierState('Control') && event.key == 'p') {
        return false;
    }

    return true;
});

window.addEventListener('resize', () => {
    fitAddon.fit();
});
