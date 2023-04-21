import * as vscode from 'vscode';


let soleHighlight: vscode.TextEditorDecorationType;
let highlight: vscode.TextEditorDecorationType;
let dim: vscode.TextEditorDecorationType;
let highlightOn: boolean = false;
let matchRanges: vscode.DecorationOptions[] = [];
let matchCount = 0;
let curIndex = -1;
let statusBarItem: vscode.StatusBarItem;
let suppressNextSelectionChange: boolean = false;
let selectionHandler: vscode.Disposable;


function registerSelectionHandler() {
    selectionHandler = vscode.window.onDidChangeTextEditorSelection(event => {
        if (!suppressNextSelectionChange) {
            clearHighlights();
        }

        suppressNextSelectionChange = false;
    });
}


async function selectHighlights() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    if (matchCount === 0) { return; }
    if (!highlightOn) { return; }

    let selections: vscode.Selection[] = [];
    await selectionHandler.dispose();

    for (let i: number = 0; i < matchCount; ++i) {
        const sel = new vscode.Selection(matchRanges[i].range.start, matchRanges[i].range.end);
        selections = selections.concat(sel);
    }

    editor.selections = selections;
    suppressNextSelectionChange = true;
    registerSelectionHandler();
}


function setupHighlightDecorations() {
    if (highlightOn) { return; }

    soleHighlight = vscode.window.createTextEditorDecorationType({
        opacity: "1",
        color: new vscode.ThemeColor('luminol.soleHighlightColor'),
    });

    highlight = vscode.window.createTextEditorDecorationType({
        opacity: "1",
        color: new vscode.ThemeColor('luminol.highlightColor'),
    });

    const config = vscode.workspace.getConfiguration('luminol');
    const opac: number = config.get<number>('dimOpacity', 0.5);
    const str: string = opac.toString();

    dim = vscode.window.createTextEditorDecorationType({
        opacity: str,
    });

    highlightOn = true;
}


async function clearHighlights() {
    if (!highlightOn) { return; }

    soleHighlight.dispose();
    highlight.dispose();
    dim.dispose();
    await selectionHandler.dispose();

    matchCount = 0;
    matchRanges = [];
    curIndex = -1;

    highlightOn = false;
    statusBarItem.hide();
}


function highlightSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const document = editor.document;
    const selection = editor.selection;
    const selectedText = document.getText(selection);

    if (selectedText.length) {
        highlightAllOccurrences(selectedText, false);
        return;
    }

    const range = document.getWordRangeAtPosition(editor.selection.active);

    if (!range) {
        clearHighlights();
        return;
    }

    highlightAllOccurrences(document.getText(range), true);
    highlightOn = true;
    return;
}


function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}


function highlightAllOccurrences(word: string, wholeWordOnly: boolean): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    clearHighlights();
    setupHighlightDecorations();

    const escWord: string = escapeRegExp(word);
    const text = editor.document.getText();
    let pattern;
    let match;

    if (wholeWordOnly) {
        pattern = new RegExp(`\\b${escWord}\\b`, 'g');
    }
    else {
        pattern = new RegExp(escWord, 'g');
    }

    matchRanges = [];
    matchCount = 0;

    const curRange = editor.document.getWordRangeAtPosition(editor.selection.active);

    while ((match = pattern.exec(text))) {
        const startPos = editor.document.positionAt(match.index);
        const endPos = editor.document.positionAt(match.index + match[0].length);
        const decoration = { range: new vscode.Range(startPos, endPos) };
        matchRanges.push(decoration);

        if (curRange !== undefined && curRange !== null && decoration.range.contains(curRange.start)) {
            curIndex = matchCount;
        }

        ++matchCount;
    }

    const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
    const entireRange = new vscode.Range(0, 0, lastLine.lineNumber, lastLine.range.end.character);

    editor.setDecorations(dim, [entireRange]);

    if (matchCount === 1) {
        editor.setDecorations(soleHighlight, matchRanges);
    }
    else {
        editor.setDecorations(highlight, matchRanges);
    }

    const lineStart: number = editor.document.lineAt(matchRanges[0].range.start).lineNumber;
    const lineEnd: number = editor.document.lineAt(matchRanges[matchCount - 1].range.end).lineNumber;
    const lineSpan = lineEnd - lineStart + 1;
    statusBarItem.text = matchCount + " matches, spanning " + lineSpan + " lines";
    statusBarItem.show();

    registerSelectionHandler();
}


async function addCmdSelectHighlights(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.selectHighlighted', () => {
        if (!highlightOn) {
            highlightSelection();
        }

        selectHighlights();
    });

    context.subscriptions.push(cmd);
};


async function addCmdClearHighlights(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.clearHighlights', () => {
        clearHighlights();
    });

    context.subscriptions.push(cmd);
};


async function addCmdMovePrevMatch(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.movePrevMatch', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        if (matchCount === 0) {
            highlightSelection();
        }
        else if (curIndex <= 0) {
            curIndex = matchCount - 1;
        } else {
            curIndex = (curIndex - 1) % matchCount;
        }

        if (matchCount > 1) {
            suppressNextSelectionChange = true;
            editor.selection = new vscode.Selection(matchRanges[curIndex].range.start, matchRanges[curIndex].range.end);
            editor.revealRange(matchRanges[curIndex].range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        }
    });

    context.subscriptions.push(cmd);
};


async function addCmdMoveNextMatch(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.moveNextMatch', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        if (!matchCount) {
            highlightSelection();
        }
        else {
            curIndex = (curIndex + 1) % matchCount;
        }

        if (matchCount > 1) {
            suppressNextSelectionChange = true;
            editor.selection = new vscode.Selection(matchRanges[curIndex].range.start, matchRanges[curIndex].range.end);
            editor.revealRange(matchRanges[curIndex].range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        }
    });

    context.subscriptions.push(cmd);
};


async function addCmdToggleHighlight(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.toggleHighlight', () => {
        if (highlightOn) {
            clearHighlights();
        }
        else {
            highlightSelection();
        }
    });

    context.subscriptions.push(cmd);
};


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    addCmdToggleHighlight(context);
    addCmdSelectHighlights(context);
    addCmdClearHighlights(context);
    addCmdMovePrevMatch(context);
    addCmdMoveNextMatch(context);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
}


// this method is called when your extension is deactivated
export function deactivate() { }
