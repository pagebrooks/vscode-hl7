const vscode = require('vscode');
const net = require('net');

const SB = '\x0b';
const EB = '\x1c';
const CR = '\x0d';

function sendMessage(host, port, hl7Text) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let response = '';

        socket.setTimeout(10000);

        socket.connect(port, host, () => {
            socket.write(SB + hl7Text + EB + CR);
        });

        socket.on('data', (data) => {
            response += data.toString();
            if (response.length > 1024 * 1024) {
                socket.destroy();
                reject(new Error('Response exceeded 1 MB limit'));
                return;
            }
            if (response.includes(EB)) {
                socket.destroy();
                // Unwrap MLLP framing from response
                const start = response.indexOf(SB);
                const end = response.indexOf(EB);
                resolve(response.substring(start === -1 ? 0 : start + 1, end));
            }
        });

        socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('Connection timed out after 10 seconds'));
        });

        socket.on('error', (err) => {
            reject(err);
        });
    });
}

const definitions = {
    '2.5.1': {
        segments: require('./data/2.5.1/segments.json'),
        fields: require('./data/2.5.1/fields.json'),
    },
    '2.7.1': {
        segments: require('./data/2.7.1/segments.json'),
        fields: require('./data/2.7.1/fields.json'),
    },
};

const DEFAULT_VERSION = '2.7.1';

function getDefs(version) {
    return definitions[version] || definitions[DEFAULT_VERSION];
}

function getVersion(document) {
    const firstLine = document.lineAt(0).text;
    const tokens = firstLine.split('|');
    if (tokens[0] !== 'MSH') return DEFAULT_VERSION;
    // MSH-12 (Version ID) is at token index 11; take first component
    const version = (tokens[11] || '').split('^')[0];
    return definitions[version] ? version : DEFAULT_VERSION;
}

function tokenizeLine(document, lineNum) {
    const version = getVersion(document);
    const defs = getDefs(version);
    const tokens = document.lineAt(lineNum).text.split('|');
    const segment = tokens[0];
    const segmentDef = defs.segments[segment];

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
            const subfields = defs.fields[output[i].datatype]?.subfields;
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

function getFieldInfo(line, charPosition, version) {
    if (!line) return null;

    const defs = getDefs(version);
    const tokens = line.split('|');
    const segment = tokens[0];
    const segmentDef = defs.segments[segment];
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

function getSegmentCounts(text) {
    const counts = {};
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const seg = lines[i].split('|')[0];
        if (seg && /^[A-Z][A-Z0-9]{2}$/.test(seg)) {
            counts[seg] = (counts[seg] || 0) + 1;
        }
    }
    return counts;
}

function getFieldRange(lineText, segment, fieldNumber, componentIndex) {
    const tokens = lineText.split('|');
    if (tokens[0] !== segment) return null;

    const tokenIndex = (segment === 'MSH') ? fieldNumber - 1 : fieldNumber;
    if (tokenIndex < 1 || tokenIndex >= tokens.length) return null;

    // Walk pipes to find the character offset of the target token
    let charOffset = 0;
    for (let i = 0; i < tokenIndex; i++) {
        charOffset += tokens[i].length + 1; // +1 for pipe
    }

    const fieldContent = tokens[tokenIndex];
    const components = fieldContent.split('^');

    if (componentIndex != null) {
        if (componentIndex >= components.length) return null;
        if (components.length > 1) {
            let compOffset = charOffset;
            for (let j = 0; j < componentIndex; j++) {
                compOffset += components[j].length + 1; // +1 for ^
            }
            return { start: compOffset, end: compOffset + components[componentIndex].length };
        }
    }

    return { start: charOffset, end: charOffset + fieldContent.length };
}

function activate(context) {
    console.log('HL7 Extension is now active');

    // Record install date and show a one-time rating prompt after 30 days
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    if (!context.globalState.get('installDate')) {
        context.globalState.update('installDate', Date.now());
    }
    const installDate = context.globalState.get('installDate');
    if (installDate && Date.now() - installDate >= THIRTY_DAYS_MS && !context.globalState.get('ratingPromptShown')) {
        context.globalState.update('ratingPromptShown', true);
        const rateCommand = vscode.commands.registerCommand('extension.rateExtension', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=pbrooks.hl7&ssr=false#review-details'));
        });
        const rateStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
        rateStatusBar.text = '$(star) Please rate my HL7 extension';
        rateStatusBar.command = 'extension.rateExtension';
        rateStatusBar.show();
        context.subscriptions.push(rateCommand, rateStatusBar);
    }

    // Field highlighting — decorates matching fields across all lines
    const fieldHighlight = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('editor.wordHighlightBackground'),
        borderColor: new vscode.ThemeColor('editor.wordHighlightBorder'),
    });
    context.subscriptions.push(fieldHighlight);

    function updateFieldHighlight(editor) {
        if (!editor || editor.document.languageId !== 'hl7') {
            editor?.setDecorations(fieldHighlight, []);
            return;
        }
        const doc = editor.document;
        const pos = editor.selection.active;
        const line = doc.lineAt(pos.line).text;
        const pipeIdx = line.indexOf('|');
        const ranges = [];

        if (pipeIdx === -1 || pos.character < pipeIdx) {
            // Cursor is on segment name — highlight same segment on all lines
            const segment = line.substring(0, pipeIdx === -1 ? line.length : pipeIdx);
            if (!segment) { editor.setDecorations(fieldHighlight, []); return; }
            for (let i = 0; i < doc.lineCount; i++) {
                const l = doc.lineAt(i).text;
                if (l.split('|')[0] === segment) {
                    ranges.push(new vscode.Range(i, 0, i, segment.length));
                }
            }
        } else {
            const version = getVersion(doc);
            const info = getFieldInfo(line, pos.character, version);
            if (!info) { editor.setDecorations(fieldHighlight, []); return; }
            const compIdx = info.components.length > 1 ? info.componentIndex : null;
            for (let i = 0; i < doc.lineCount; i++) {
                const r = getFieldRange(doc.lineAt(i).text, info.segment, info.fieldNumber, compIdx);
                if (r) {
                    ranges.push(new vscode.Range(i, r.start, i, r.end));
                }
            }
        }
        editor.setDecorations(fieldHighlight, ranges);
    }

    updateFieldHighlight(vscode.window.activeTextEditor);
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection((e) => {
        updateFieldHighlight(e.textEditor);
    }));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        updateFieldHighlight(editor);
    }));

    let genCount = 0;
    let tokenDoc = null;

    // Segment count + version status bar
    const segCountStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    context.subscriptions.push(segCountStatusBar);

    function updateSegCountStatusBar(document) {
        if (!document || document.languageId !== 'hl7') {
            segCountStatusBar.hide();
            return;
        }
        const counts = getSegmentCounts(document.getText());
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        const types = Object.keys(counts).length;
        const version = getVersion(document);
        segCountStatusBar.text = `HL7 v${version} | ${total} segments (${types} types)`;
        segCountStatusBar.tooltip = Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join('\n');
        segCountStatusBar.show();
    }

    updateSegCountStatusBar(vscode.window.activeTextEditor?.document);
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        updateSegCountStatusBar(editor?.document);
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
        if (vscode.window.activeTextEditor?.document === e.document) {
            updateSegCountStatusBar(e.document);
        }
    }));

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

    const mllpOutputChannel = vscode.window.createOutputChannel('HL7 MLLP');
    context.subscriptions.push(mllpOutputChannel);

    const sendMessageCommand = vscode.commands.registerCommand('extension.sendMessage', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor.');
            return;
        }

        const selection = editor.selection;
        let text = selection.isEmpty ? editor.document.getText() : editor.document.getText(selection);
        text = text.replace(/\r\n/g, '\r').replace(/\n/g, '\r');

        const config = vscode.workspace.getConfiguration('hl7.mllp');
        const defaultHost = config.get('host') || '';
        const defaultPort = config.get('port') || 0;

        const host = await vscode.window.showInputBox({
            prompt: 'MLLP Host',
            value: defaultHost,
            placeHolder: 'e.g. 127.0.0.1',
        });
        if (!host) return;

        const portStr = await vscode.window.showInputBox({
            prompt: 'MLLP Port',
            value: defaultPort ? String(defaultPort) : '',
            placeHolder: 'e.g. 2575',
        });
        if (!portStr) return;

        const port = parseInt(portStr, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
            vscode.window.showErrorMessage('Invalid port number.');
            return;
        }

        try {
            const ack = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Sending HL7 message to ${host}:${port}...` },
                () => sendMessage(host, port, text)
            );
            mllpOutputChannel.clear();
            mllpOutputChannel.appendLine(`--- ACK from ${host}:${port} ---`);
            mllpOutputChannel.appendLine(ack.replace(/\r/g, '\n'));
            mllpOutputChannel.show(true);
        } catch (err) {
            vscode.window.showErrorMessage(`MLLP send failed: ${err.message}`);
        }
    });

    context.subscriptions.push(sendMessageCommand);

    const hoverProvider = vscode.languages.registerHoverProvider('hl7', {
        provideHover(document, position) {
            const version = getVersion(document);
            const defs = getDefs(version);
            const line = document.lineAt(position.line).text;
            const info = getFieldInfo(line, position.character, version);
            if (!info) return null;

            const { segment, fieldNumber, fieldDef, componentIndex, components } = info;

            const md = new vscode.MarkdownString();
            md.appendMarkdown(`**${segment}-${fieldNumber}**: ${fieldDef.desc}\n\n`);
            md.appendMarkdown(`**Type**: \`${fieldDef.datatype}\`\n\n`);

            if (components.length > 1) {
                const subfieldDefs = defs.fields[fieldDef.datatype]?.subfields;
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
exports.getVersion = getVersion;
exports.getSegmentCounts = getSegmentCounts;
exports.filterSegmentLines = filterSegmentLines;
exports.getFieldRange = getFieldRange;
exports.sendMessage = sendMessage;
