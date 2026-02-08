const vscode = require('vscode');
const segments = require('./data/segments.json');
const fields = require('./data/fields.json');

function tokenizeLine(document, lineNum) {
    const tokens = document.lineAt(lineNum).text.split('|');
    const segment = tokens[0];
    const segmentDef = segments[segment];

    if (!segmentDef) {
        return null;
    }

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
            datatype: segmentDef.fields[i - 1].datatype,
            values: values
        });
    }

    let channelOutput = '';
    for (let i = 0; i < output.length; i++) {
        const prefix = (output[i].segment + ':').padEnd(8) +
                       (output[i].desc + ':').padEnd(maxLength) +
                       ' ';

        let value = '';
        if (output[i].values.length === 1) {
            value += output[i].values[0];
        } else {
            const subfields = fields[output[i].datatype]?.subfields;
            let maxSubfieldDescLength = 0;
            if (subfields) {
                for (let j = 0; j < output[i].values.length; j++) {
                    const desc = subfields[j]?.desc;
                    if (desc) {
                        maxSubfieldDescLength = Math.max(maxSubfieldDescLength, desc.length);
                    }
                }
            }
            for (let j = 0; j < output[i].values.length; j++) {
                const subfieldDesc = subfields?.[j]?.desc || '';
                value += ('\n  ' + output[i].segment + '.' + (j + 1) + ':').padEnd(prefix.length + 1);
                if (maxSubfieldDescLength > 0) {
                    value += (subfieldDesc + ':').padEnd(maxSubfieldDescLength + 1) + ' ';
                }
                value += output[i].values[j];
            }
        }

        channelOutput += prefix + value + '\n';
    }

    return channelOutput;
}

function filterSegmentLines(text, segmentType) {
    const lines = text.split('\n');
    let output = '';
    for (let i = 0; i < lines.length; i++) {
        const currSeg = lines[i].split('|')[0];
        if (segmentType === currSeg) {
            output += lines[i] + '\n';
        }
    }
    return output;
}

function getFieldInfo(line, charPosition) {
    if (!line) return null;

    const tokens = line.split('|');
    const segment = tokens[0];
    const segmentDef = segments[segment];
    if (!segmentDef) return null;

    // Walk pipe-delimited tokens to find which field the cursor is in
    let charOffset = tokens[0].length; // end of segment name
    let fieldIndex = -1;
    let fieldStart = 0;

    for (let i = 1; i < tokens.length; i++) {
        // charOffset is now at the pipe before token i
        if (charPosition <= charOffset) break; // cursor on or before pipe
        fieldStart = charOffset + 1; // start of token content
        charOffset += 1 + tokens[i].length; // pipe + token content
        if (charPosition < charOffset || i === tokens.length - 1) {
            fieldIndex = i;
            break;
        }
    }

    if (fieldIndex < 1) return null; // cursor on segment name or a pipe

    // Map token index to HL7 field number and definition index
    const fieldNumber = (segment === 'MSH') ? fieldIndex + 1 : fieldIndex;
    const defIndex = fieldNumber - 1;

    if (defIndex < 0 || defIndex >= segmentDef.fields.length) return null;

    const fieldDef = segmentDef.fields[defIndex];
    const fieldContent = tokens[fieldIndex];

    // Determine which ^-delimited component the cursor is in
    const components = fieldContent.split('^');
    let componentIndex = 0;
    if (components.length > 1) {
        let compOffset = fieldStart;
        for (let j = 0; j < components.length; j++) {
            if (charPosition < compOffset + components[j].length) {
                componentIndex = j;
                break;
            }
            compOffset += components[j].length + 1; // +1 for ^
            componentIndex = j + 1;
        }
        if (componentIndex >= components.length) componentIndex = components.length - 1;
    }

    return { segment, fieldNumber, defIndex, fieldDef, componentIndex, components };
}

function activate(context) {
    console.log('HL7 Extension is now active');
    let genCount = 0;
    let tokenDoc = null;

    const filterSegmentCommand = vscode.commands.registerCommand('extension.filterSegment', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const currentDoc = editor.document;
        const currentLineNum = editor.selection.start.line;
        const segment = currentDoc.lineAt(currentLineNum).text.split('|')[0];

        if (!segment) {
            vscode.window.showErrorMessage('No segment found on current line.');
            return;
        }

        genCount++;
        const f = vscode.Uri.parse('untitled:' + segment + '-segments_' + genCount + '.hl7');
        vscode.workspace.openTextDocument(f).then((doc) => {
            return vscode.window.showTextDocument(doc).then((e) => {
                let x = 0;
                e.edit((te) => {
                    const output = filterSegmentLines(currentDoc.getText(), segment);
                    te.insert(new vscode.Position(x++, 0), output);
                });
            });
        });
    });

    context.subscriptions.push(filterSegmentCommand);

    function showTokenOutput(channelOutput) {
        const showTokenDoc = (doc) => {
            tokenDoc = doc;
            return vscode.window.showTextDocument(doc, vscode.ViewColumn.Two, true);
        };

        if (tokenDoc && !tokenDoc.isClosed) {
            vscode.window.showTextDocument(tokenDoc, vscode.ViewColumn.Two, true).then(e => {
                e.edit(edit => {
                    const fullRange = new vscode.Range(
                        tokenDoc.positionAt(0),
                        tokenDoc.positionAt(tokenDoc.getText().length)
                    );
                    edit.replace(fullRange, channelOutput);
                });
            });
        } else {
            vscode.workspace.openTextDocument({ content: channelOutput, language: 'plaintext' }).then(showTokenDoc);
        }
    }

    const tokenizeLineCommand = vscode.commands.registerCommand('extension.tokenizeLine', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const channelOutput = tokenizeLine(editor.document, editor.selection.start.line);
        if (!channelOutput) {
            const segment = editor.document.lineAt(editor.selection.start.line).text.split('|')[0];
            vscode.window.showErrorMessage(`Unknown segment: ${segment}`);
            return;
        }

        showTokenOutput(channelOutput);
    });

    context.subscriptions.push(tokenizeLineCommand);

    let autoTokenizeEnabled = false;
    let autoTokenizeListener = null;
    let lastTokenizedLine = -1;
    const autoTokenizeStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    autoTokenizeStatusBar.command = 'extension.toggleAutoTokenize';
    context.subscriptions.push(autoTokenizeStatusBar);

    function updateStatusBar() {
        if (autoTokenizeEnabled) {
            autoTokenizeStatusBar.text = 'HL7 Auto-Tokenize: ON';
            autoTokenizeStatusBar.show();
        } else {
            autoTokenizeStatusBar.text = 'HL7 Auto-Tokenize: OFF';
            autoTokenizeStatusBar.hide();
        }
    }

    const toggleAutoTokenizeCommand = vscode.commands.registerCommand('extension.toggleAutoTokenize', () => {
        autoTokenizeEnabled = !autoTokenizeEnabled;
        updateStatusBar();

        if (autoTokenizeEnabled) {
            lastTokenizedLine = -1;
            autoTokenizeListener = vscode.window.onDidChangeTextEditorSelection((e) => {
                if (e.textEditor.document.languageId !== 'hl7') {
                    return;
                }

                const lineNum = e.selections[0].start.line;
                if (lineNum === lastTokenizedLine) {
                    return;
                }

                lastTokenizedLine = lineNum;
                const channelOutput = tokenizeLine(e.textEditor.document, lineNum);
                if (channelOutput) {
                    showTokenOutput(channelOutput);
                }
            });
            context.subscriptions.push(autoTokenizeListener);

            // Tokenize current line immediately
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'hl7') {
                const lineNum = editor.selection.start.line;
                lastTokenizedLine = lineNum;
                const channelOutput = tokenizeLine(editor.document, lineNum);
                if (channelOutput) {
                    showTokenOutput(channelOutput);
                }
            }
        } else {
            if (autoTokenizeListener) {
                autoTokenizeListener.dispose();
                autoTokenizeListener = null;
            }
            lastTokenizedLine = -1;
        }
    });

    context.subscriptions.push(toggleAutoTokenizeCommand);

    const hoverProvider = vscode.languages.registerHoverProvider('hl7', {
        provideHover(document, position) {
            const line = document.lineAt(position.line).text;
            const info = getFieldInfo(line, position.character);
            if (!info) return null;

            const { segment, fieldNumber, fieldDef, componentIndex, components } = info;

            const md = new vscode.MarkdownString();
            md.appendMarkdown(`**${segment}-${fieldNumber}**: ${fieldDef.desc}\n\n`);
            md.appendMarkdown(`**Type**: \`${fieldDef.datatype}\`\n\n`);

            if (components.length > 1) {
                const subfieldDefs = fields[fieldDef.datatype]?.subfields;
                if (subfieldDefs) {
                    components.forEach((comp, idx) => {
                        const sf = subfieldDefs[idx];
                        const label = sf ? sf.desc : `Component ${idx + 1}`;
                        const prefix = (idx === componentIndex) ? '**' : '';
                        const suffix = (idx === componentIndex) ? '**' : '';
                        const value = comp || '*(empty)*';
                        md.appendMarkdown(`${prefix}${segment}-${fieldNumber}.${idx + 1} ${label}${suffix}: ${value}\n\n`);
                    });
                }
            }

            return new vscode.Hover(md);
        }
    });
    context.subscriptions.push(hoverProvider);
}

exports.activate = activate;
exports.tokenizeLine = tokenizeLine;
exports.getFieldInfo = getFieldInfo;
exports.filterSegmentLines = filterSegmentLines;
