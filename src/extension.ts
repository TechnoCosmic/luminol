import * as vscode from 'vscode';
import * as hl from './highlights';


export function activate(context: vscode.ExtensionContext) {
    hl.registerCommands(context);
}


export function deactivate() { }
