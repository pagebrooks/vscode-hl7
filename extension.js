const vscode = require('vscode');
const hl7v271 = require('./modules/hl7-dictionary').definitions['2.7.1'];

function padRight(s, c, n) {
    if (!s || !c || s.length >= n) {
        return s;
    }
    const max = (n - s.length) / c.length;
    for (let i = 0; i < max; i++) {
        s += c;
    }
    return s;
}

function activate(context) {
    console.log('HL7 Extension is now active');
    let genCount = 0;

    const filterSegmentCommand = vscode.commands.registerCommand('extension.filterSegment', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const currentDoc = editor.document;
        const currentLineNum = editor.selection.start.line;
        const segment = currentDoc.lineAt(currentLineNum).text.split('|')[0];
        genCount++;
        const f = vscode.Uri.parse('untitled:' + segment + '-segments_' + genCount + '.hl7');
        vscode.workspace.openTextDocument(f).then((doc) => {
            return vscode.window.showTextDocument(doc).then((e) => {
                let x = 0;
                e.edit((te) => {
                    let output = '';
                    for (let i = 0; i < currentDoc.lineCount; i++) {
                        const currLine = currentDoc.lineAt(i).text;
                        const currSeg = currLine.split('|')[0];
                        if (segment === currSeg) {
                            output += currLine + '\n';
                        }
                    }
                    te.insert(new vscode.Position(x++, 0), output);
                });
            });
        });
    });

    context.subscriptions.push(filterSegmentCommand);

    const tokenizeLineCommand = vscode.commands.registerCommand('extension.tokenizeLine', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const currentDoc = editor.document;
        const currentLineNum = editor.selection.start.line;
        const tokens = currentDoc.lineAt(currentLineNum).text.split('|');
        const segment = tokens[0];
        const segmentDef = hl7v271.segments[segment];

        if (segment === 'MSH') {
            tokens.splice(1, 0, '|');
        }

        const output = [{ segment: segment + '-0', desc: segment, values: [segment] }];
        let maxLength = 0;
        for (let i = 1; i <= segmentDef.fields.length; i++) {
            const desc = segmentDef.fields[i - 1].desc;
            maxLength = Math.max(maxLength, desc.length);

            const values = [];
            if (i < tokens.length) {
                if (segment === 'MSH' && i === 2) {
                    values.push(tokens[i]);
                } else {
                    const subTokens = tokens[i].split('^');
                    for (let j = 0; j < subTokens.length; j++) {
                        values.push(subTokens[j]);
                    }
                }
            }

            output.push({
                segment: segment + '-' + i,
                desc: desc,
                values: values
            });
        }

        let channelOutput = '';
        for (let i = 0; i < output.length; i++) {
            const prefix = padRight(output[i].segment + ':', ' ', 8) +
                           padRight(output[i].desc + ':', ' ', maxLength) +
                           ' ';

            let value = '';
            if (output[i].values.length === 1) {
                value += output[i].values[0];
            } else {
                for (let j = 0; j < output[i].values.length; j++) {
                    value += padRight('\n  ' + output[i].segment + '-' + j + ':', ' ', prefix.length + 1);
                    value += output[i].values[j];
                }
            }

            channelOutput += prefix + value + '\n';
        }

        const channel = vscode.window.createOutputChannel('HL7 Tokens');
        channel.clear();
        channel.appendLine(channelOutput);
        channel.show(vscode.ViewColumn.Two);
    });

    context.subscriptions.push(tokenizeLineCommand);
}

exports.activate = activate;
