// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
var vscode = require('vscode');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "vscode-hl7-ext" is now active!'); 
    var genCount = 0;
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    var disposable = vscode.commands.registerCommand('extension.filterSegment', function () {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        // vscode.window.showInformationMessage('Hello World!');
        
        var editor = vscode.window.activeTextEditor;
        if (!editor) {
            return; // No open text editor
        }

        var currentDoc = editor.document;
        var selection = editor.selection;
        var currentLineNum = selection.start.line;
        var segment = currentDoc.lineAt(currentLineNum).text.split('|')[0];
        genCount++;
        var f = vscode.Uri.parse('untitled:' + segment + '-segments_' + genCount + '.hl7');
        vscode.workspace.openTextDocument(f).then(function(doc) {;
            return vscode.window.showTextDocument(doc).then(function(e) {
               var x = 0;
               e.edit(function(te) { 
                   var output = '';
                    for(var i=0; i<currentDoc.lineCount; i++) {
                        var currLine = currentDoc.lineAt(i).text;
                        var currSeg = currLine.split('|')[0];
                        if(segment === currSeg) {
                            output += currLine + '\n';
                        }
                    }
                    
                    te.insert(new vscode.Position(x++, 0), output);
               })
            });
        });
    });

    context.subscriptions.push(disposable);
}
exports.activate = activate;