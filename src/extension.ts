import * as vscode from 'vscode';
import * as hl from './highlights';


export function activate(context: vscode.ExtensionContext) {
    hl.registerCommands(context);
}


// this method is called when your extension is deactivated
export function deactivate() { }
