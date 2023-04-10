import * as vscode from 'vscode';
import { TextEditorDecorationType } from 'vscode';
// import {networkInterfaces} from 'os';
// const Net = require('net');


let highlight: TextEditorDecorationType;
let dim: TextEditorDecorationType;
let highlightOn: boolean = false;
let origSelection: vscode.Selection;


function setupDecorations() {
    if (highlightOn) return;

    const config = vscode.workspace.getConfiguration('luminol');
    const hCol = config.get('highlightColor', '#00FF00');
    const dCol = config.get('dimColor', '#606060');

    highlight = vscode.window.createTextEditorDecorationType({
        color: hCol,
    });

    dim = vscode.window.createTextEditorDecorationType({
        color: dCol,
    });

    highlightOn = true;
}


function clearHighlights() {
    if (!highlightOn) return;

    highlight.dispose();
    dim.dispose();

    highlightOn = false;

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const config = vscode.workspace.getConfiguration('luminol');
    const selectMatching = config.get('selectMatching', false);

    if (selectMatching) {
        editor.selection = origSelection;
    }
}


function highlightSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const selection = editor.selection;
    const selectedText = document.getText(selection);

    if (selectedText.length) {
        highlightAllOccurrences(selectedText);
        return;
    }

    const range = document.getWordRangeAtPosition(editor.selection.active);
    if (!range) return;

    highlightAllOccurrences(document.getText(range));
    highlightOn = true;
    return;
}


function highlightAllOccurrences(word: string): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    setupDecorations();

    const text = editor.document.getText();
    const pattern = new RegExp(word, 'g');
    const matchDecorations: vscode.DecorationOptions[] = [];
    let match;

    origSelection = editor.selection;

    const config = vscode.workspace.getConfiguration('luminol');
    const selectMatching = config.get('selectMatching', false);

    while ((match = pattern.exec(text))) {
        const startPos = editor.document.positionAt(match.index);
        const endPos = editor.document.positionAt(match.index + match[0].length);
        const decoration = { range: new vscode.Range(startPos, endPos) };
        matchDecorations.push(decoration);

        if (selectMatching) {
            const sel = new vscode.Selection(startPos, endPos);
            editor.selections = editor.selections.concat(sel);
        }
    }

    const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
    const entireRange = new vscode.Range(0, 0, lastLine.lineNumber, lastLine.range.end.character);

    editor.setDecorations(dim, [entireRange]);
    editor.setDecorations(highlight, matchDecorations);
}


async function createNewFile(txt: string) {
    const newFile = await vscode.workspace.openTextDocument({ content: txt });
    await vscode.window.showTextDocument(newFile);
}


async function addCmd_ClearHighlights(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.clearHighlights', () => {
        clearHighlights();
        return;
    });

    context.subscriptions.push(cmd);
};


async function addCmd_HighlightSelection(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.highlightSelection', () => {
        highlightSelection();
    });

    context.subscriptions.push(cmd);
};


async function addCmd_ToggleHighlight(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.toggleHighlight', () => {
        if (highlightOn == true) {
            clearHighlights();
        }
        else {
            highlightSelection();
        }
    });

    context.subscriptions.push(cmd);
};


async function addCmd_ExtractFunction(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.extractFunction', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        if (selectedText.length == 0) return;

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


function addCmd_ClearCurrentLine(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.clearLine', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

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
    addCmd_ClearCurrentLine(context);
    addCmd_ExtractFunction(context);
    addCmd_ClearHighlights(context);
    addCmd_HighlightSelection(context);
    addCmd_ToggleHighlight(context);
}


// this method is called when your extension is deactivated
export function deactivate() { }
