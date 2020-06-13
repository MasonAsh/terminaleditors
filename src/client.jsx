const terminalContainer = document.getElementById('terminal-container');

var term = new Terminal();
term.open(terminalContainer);


let socketURL, pid, serverUri;

const vscode = acquireVsCodeApi();

setTimeout(() => {
    // Set terminal size again to set the specific dimensions on the demo
    updateTerminalSize();

    term.focus();

    //serverUri = document.getElementById('server-uri').innerText;
    const serverUri = "http://lvh.me:3000"
    const webSocketUri = "ws://";

    console.log('before fetch');

    vscode.postMessage({
        command: 'newterm',
    });
}, 0);

window.addEventListener('message', event => {
    const message = event.data; // The JSON data our extension sent

    switch (message.command) {
        case 'newterm':
            pid = message.pid;
            console.log(pid);
            data = message.data;
            term.write(data);
            break;
        case 'receivedata':
            data = message.data;
            term.write(data);
    }
});

term.onData(data => {
    vscode.postMessage({
        'command': 'termmessage',
        'pid': pid,
        'data': data,
    });
});
// window.addEventListener('keyup', (e) => {
//     if (term) {
//         vscode.postMessage({
//             'command': 'termmessage',
//             'pid': pid,
//             'data': e.char,
//         });
//     }
// })

function updateTerminalSize() {
    // TODO: Figure out how to make terminal fill the page
    //   const cols = parseInt((<HTMLInputElement>document.getElementById(`opt-cols`)).value, 10);
    //   const rows = parseInt((<HTMLInputElement>document.getElementById(`opt-rows`)).value, 10);
    //   const width = (cols * term._core._renderService.dimensions.actualCellWidth + term._core.viewport.scrollBarWidth).toString() + 'px';
    //   const height = (rows * term._core._renderService.dimensions.actualCellHeight).toString() + 'px';
    //   terminalContainer.style.width = width;
    //   terminalContainer.style.height = height;
    //   addons.fit.instance.fit();
    terminalContainer.style.width = '100%';
    terminalContainer.style.height = '100%';
}

function runRealTerminal() {
    addons.attach.instance = new AttachAddon(socket);
    term.loadAddon(addons.attach.instance);
    term._initialized = true;
    initAddons(term);
}