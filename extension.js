// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
var vscode = require('vscode');
var hl7v271 = require('./modules/hl7-dictionary').definitions['2.7.1'];

function padRight(s, c, n) {
    if (! s || ! c || s.length >= n) {
        return s;
    }
    var max = (n - s.length)/c.length;
    for (var i = 0; i < max; i++) {
        s += c;
    }
    return s;
}
    
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {

    // This line of code will only be executed once when your extension is activated
    console.log('HL7 Extension is now active'); 
    var genCount = 0;
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    var filterSegmentCommand = vscode.commands.registerCommand('extension.filterSegment', function () {
        // The code you place here will be executed every time your command is executed

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

    context.subscriptions.push(filterSegmentCommand);
        
    var tokenizeLineCommand = vscode.commands.registerCommand('extension.tokenizeLine', function () {
        // The code you place here will be executed every time your command is executed

        var editor = vscode.window.activeTextEditor;
        if (!editor) {
            return; // No open text editor
        }

        var currentDoc = editor.document;
        var selection = editor.selection;
        var currentLineNum = selection.start.line;
        var tokens = currentDoc.lineAt(currentLineNum).text.split('|');
        var segment = tokens[0];
        var segmentDef = hl7v271.segments[segment];
        
        if(segment === 'MSH') {
            tokens.splice(1, 0, '|');
        }
        
        var output = [{segment: segment + '-0', desc: segment, values: [segment] }];
        var maxLength = 0;
        for(var i=1; i<=segmentDef.fields.length; i++) {
            var desc = segmentDef.fields[i-1].desc;
            maxLength = Math.max(maxLength, desc.length);
            
            var values = [];
            if(i < tokens.length) {
                if(segment === 'MSH' && i === 2) {
                    values.push(tokens[i]);
                } else {    
                    var subTokens = tokens[i].split('^');
                    for(var j = 0; j < subTokens.length; j++) {
                        values.push(subTokens[j]);
                    } 
                }
            }
           
            output.push({
                segment: segment + '-' + i,
                desc: desc,
                values: values
            })
        }
            
        var channelOutput = '';
        for(var i=0; i<output.length; i++) {
            var prefix = padRight(output[i].segment + ':', ' ', 8) + 
                         padRight(output[i].desc + ':', ' ', maxLength) +
                         ' ';
                         
            var value = '';
            if(output[i].values.length === 1) {
                value += output[i].values[0];
            } else {
                for(var j =0; j<output[i].values.length; j++) {
                    value += padRight('\n  ' + output[i].segment + '-' + j + ':', ' ', prefix.length + 1);
                    value += output[i].values[j];                                  
                }
            }
            
            channelOutput += prefix + value + '\n';
        }
       
        var channel = vscode.window.createOutputChannel('HL7 Tokens');
        channel.clear();
        channel.appendLine(channelOutput);
        channel.show(vscode.ViewColumn.Two);
        
    });

    context.subscriptions.push(tokenizeLineCommand);
}
exports.activate = activate;