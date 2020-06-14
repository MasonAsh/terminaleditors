const terminalContainer = document.getElementById('terminal-container');

var term = new Terminal();
term.open(terminalContainer);

terminalContainer.style.width = '100%';
terminalContainer.style.height = '100vh'

let socketURL, pid, serverUri;

const vscode = acquireVsCodeApi();

setTimeout(() => {
    // Set terminal size again to set the specific dimensions on the demo
    term.focus();

    console.log('before fetch');

    vscode.postMessage({
        command: 'newterm',
        rows: 40,
        cols: 120,
    });

    console.log('after newterm');
}, 0);

window.addEventListener('message', event => {
    const message = event.data; // The JSON data our extension sent

    switch (message.command) {
        case 'newterm':
            pid = message.pid;
            fitTerminal();
            break;
        case 'receivedata':
            data = message.data;
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
    fitTerminal();
});

function fitTerminal() {
    if (!term) {
        return undefined;
    }

    if (!pid) {
        return undefined;
    }

    if (!term.element || !term.element.parentElement) {
        return undefined;
    }

    const core = (term)._core;

    const parentElementStyle = window.getComputedStyle(term.element.parentElement);
    const parentElementHeight = parseInt(parentElementStyle.getPropertyValue('height'));
    const parentElementWidth = Math.max(0, parseInt(parentElementStyle.getPropertyValue('width')));
    const elementStyle = window.getComputedStyle(term.element);
    const elementPadding = {
        top: parseInt(elementStyle.getPropertyValue('padding-top')),
        bottom: parseInt(elementStyle.getPropertyValue('padding-bottom')),
        right: parseInt(elementStyle.getPropertyValue('padding-right')),
        left: parseInt(elementStyle.getPropertyValue('padding-left'))
    };
    const elementPaddingVer = elementPadding.top + elementPadding.bottom;
    const elementPaddingHor = elementPadding.right + elementPadding.left;
    const availableHeight = parentElementHeight - elementPaddingVer;
    const availableWidth = parentElementWidth - elementPaddingHor - core.viewport.scrollBarWidth;
    const MINIMUM_COLS = 2;
    const MINIMUM_ROWS = 1;
    const cols = Math.max(MINIMUM_COLS, Math.floor(availableWidth / core._renderService.dimensions.actualCellWidth));
    const rows = Math.max(MINIMUM_ROWS, Math.floor(availableHeight / core._renderService.dimensions.actualCellHeight));

    core._renderService.clear();
    term.resize(cols, rows);

    vscode.postMessage({
        'command': 'resize',
        'pid': pid,
        'rows': rows,
        'cols': cols,
    });
}
