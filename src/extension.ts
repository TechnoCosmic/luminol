import * as vscode from 'vscode';
// import {networkInterfaces} from 'os';
// const Net = require('net');


export async function createNewFile(txt: string) {
    const newFile = await vscode.workspace.openTextDocument({ content: txt });
    await vscode.window.showTextDocument(newFile);
}


function addCmd_ExtractFunction(context: vscode.ExtensionContext) {
    let cmd = vscode.commands.registerCommand('luminol.extractFunction', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        if (selectedText.length == 0) return;

        const startLine = selection.start.line;
        const endLine = selection.end.line;
        const lineCount = endLine - startLine + 1;

        const funcSig = 'void func()';

        editor.edit(editBuilder => {
            editBuilder.delete(selection);
            editBuilder.insert(editor.document.lineAt(editor.document.lineCount - 1).range.end, '\n\n' + funcSig + ' {\n' + selectedText + '\n }\n');
        }).then(() => {
            const newPosition = new vscode.Position(editor.document.lineCount - lineCount - 3, 0);
            const newPosition2 = new vscode.Position(editor.document.lineCount - lineCount - 3, funcSig.length);
            const newSelection = new vscode.Selection(newPosition, newPosition2);
            editor.selection = newSelection;
            editor.revealRange(new vscode.Range(newPosition, newPosition), vscode.TextEditorRevealType.InCenter);
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
    console.log('Luminol active');
    addCmd_ClearCurrentLine(context);
    addCmd_ExtractFunction(context);
}


// this method is called when your extension is deactivated
export function deactivate() { }
