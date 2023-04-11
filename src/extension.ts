import * as vscode from 'vscode';
import { TextEditorDecorationType } from 'vscode';
// import {networkInterfaces} from 'os';
// const Net = require('net');


let soleHighlight: TextEditorDecorationType;
let highlight: TextEditorDecorationType;
let dim: TextEditorDecorationType;
let highlightOn: boolean = false;
let origSelection: vscode.Selection;
let matchRanges: vscode.DecorationOptions[] = [];
let matchCount = 0;
let curIndex = -1;
let statusBarItem: vscode.StatusBarItem;


function setupHighlightDecorations() {
    if (highlightOn) { return; }

    const config = vscode.workspace.getConfiguration('luminol');
    const hCol = config.get('highlightColor', '#00FF00');
    const sCol = config.get('soleHighlightColor', '#FF8000');
    const dCol = config.get('dimColor', '#606060');

    soleHighlight = vscode.window.createTextEditorDecorationType({
        color: sCol,
    });

    highlight = vscode.window.createTextEditorDecorationType({
        color: hCol,
    });

    dim = vscode.window.createTextEditorDecorationType({
        color: dCol,
    });

    highlightOn = true;
}


function clearHighlights() {
    if (!highlightOn) { return; }

    soleHighlight.dispose();
    highlight.dispose();
    dim.dispose();

    matchCount = 0;
    matchRanges = [];
    curIndex = -1;

    highlightOn = false;

    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const config = vscode.workspace.getConfiguration('luminol');
    const selectMatching = config.get('selectMatching', false);

    if (selectMatching) {
        editor.selection = origSelection;
    }

    statusBarItem.hide();
}


function highlightSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const document = editor.document;
    const selection = editor.selection;
    const selectedText = document.getText(selection);

    if (selectedText.length) {
        highlightAllOccurrences(selectedText);
        return;
    }

    const range = document.getWordRangeAtPosition(editor.selection.active);

    if (!range) {
        clearHighlights();
        return;
    }

    highlightAllOccurrences(document.getText(range));
    highlightOn = true;
    return;
}


function highlightAllOccurrences(word: string): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    clearHighlights();
    setupHighlightDecorations();

    const text = editor.document.getText();
    const pattern = new RegExp(`\\b${word}\\b`, 'g');
    let match;

    origSelection = editor.selection;

    const config = vscode.workspace.getConfiguration('luminol');
    const selectMatching = config.get('selectMatching', false);

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

        if (selectMatching) {
            editor.selections = editor.selections.concat(new vscode.Selection(startPos, endPos));
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
}


async function createNewFile(txt: string) {
    const newFile = await vscode.workspace.openTextDocument({ content: txt });
    await vscode.window.showTextDocument(newFile);
}


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

        editor.selection = new vscode.Selection(matchRanges[curIndex].range.start, matchRanges[curIndex].range.end);
        editor.revealRange(matchRanges[curIndex].range, vscode.TextEditorRevealType.InCenter);
    });

    context.subscriptions.push(cmd);
};


async function addCmdMoveNextMatch(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.moveNextMatch', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        if (matchCount === 0) {
            highlightSelection();
        }
        else {
            curIndex = (curIndex + 1) % matchCount;
        }

        editor.selection = new vscode.Selection(matchRanges[curIndex].range.start, matchRanges[curIndex].range.end);
        editor.revealRange(matchRanges[curIndex].range, vscode.TextEditorRevealType.InCenter);
    });

    context.subscriptions.push(cmd);
};


async function addCmdHighlightSelection(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.highlightSelection', () => {
        highlightSelection();
    });

    context.subscriptions.push(cmd);
};


async function addCmdToggleHighlight(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.toggleHighlight', () => {
        if (highlightOn === true) {
            clearHighlights();
        }
        else {
            highlightSelection();
        }
    });

    context.subscriptions.push(cmd);
};


async function addCmdExtractFunction(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.extractFunction', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        if (selectedText.length === 0) { return; }

        const startLine = selection.start.line;
        const endLine = selection.end.line;
        const lineCount = endLine - startLine + 1;

        const funcSig = 'void newFunc';

        editor.edit(editBuilder => {
            editBuilder.delete(selection);
            editBuilder.insert(editor.document.lineAt(editor.document.lineCount - 1).range.end,
                '\n\n' + funcSig + '() {\n' + selectedText + '}\n');
        }).then(() => {
            const newStart = new vscode.Position(editor.document.lineCount - lineCount - 2, 0);
            const newEnd = new vscode.Position(editor.document.lineCount - lineCount - 2, funcSig.length);
            const newSelection = new vscode.Selection(newStart, newEnd);
            editor.selection = newSelection;
            editor.revealRange(new vscode.Range(newStart, newStart), vscode.TextEditorRevealType.InCenter);
        });
    });

    context.subscriptions.push(cmd);
}


function addCmdClearCurrentLine(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.clearLine', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        const document = editor.document;
        const selection = editor.selection;
        const activeLine = selection.active.line;
        const lineText = document.lineAt(activeLine).text;

        const leadingWhitespaceMatch = lineText.match(/^\s*/);
        const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : '';

        // Delete the current line
        editor
            .edit((editBuilder) => {
                editBuilder.delete(document.lineAt(activeLine).range);
            })
            .then(() => {
                // Insert a new blank line at the same position
                editor.edit((editBuilder) => {
                    const position = new vscode.Position(activeLine, 0);
                    editBuilder.insert(position, leadingWhitespace);
                });
            });
    });

    context.subscriptions.push(cmd);
}


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    addCmdToggleHighlight(context);
    addCmdHighlightSelection(context);
    addCmdClearHighlights(context);
    addCmdMovePrevMatch(context);
    addCmdMoveNextMatch(context);

    addCmdExtractFunction(context);
    addCmdClearCurrentLine(context);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
}


// this method is called when your extension is deactivated
export function deactivate() { }
