const assert = require('assert');
const { tokenizeLine, getFieldInfo, getVersion, getSegmentCounts, filterSegmentLines, getFieldRange, buildAck } = require('../extension');

// Minimal document mock for tokenizeLine
function mockDoc(lines) {
    return { lineAt(n) { return { text: lines[n] }; } };
}

describe('tokenizeLine', function () {
    it('returns formatted output for a PID segment', function () {
        const line = 'PID|1||12345^^^MRN||Doe^John^M||19800101|M';
        const doc = mockDoc([line]);
        const result = tokenizeLine(doc, 0);

        assert.ok(result, 'should return non-null output');
        assert.ok(result.includes('PID-0:'), 'should include segment header');
        assert.ok(result.includes('Set ID - PID:'), 'should include field description');
        assert.ok(result.includes('PID-1:'), 'should include field PID-1');
        assert.ok(result.includes('PID-3:'), 'should include field PID-3');
        assert.ok(result.includes('12345'), 'should include field value');
    });

    it('handles MSH special field-separator numbering', function () {
        const line = 'MSH|^~\\&|SendApp|SendFac|RecvApp|RecvFac|20230101120000||ADT^A01|123456|P|2.7.1';
        const doc = mockDoc([line]);
        const result = tokenizeLine(doc, 0);

        assert.ok(result, 'should return non-null output');
        assert.ok(result.includes('MSH-0:'), 'should include segment header');
        assert.ok(result.includes('Field Separator:'), 'should include MSH-1 desc');
        assert.ok(result.includes('Encoding Characters:'), 'should include MSH-2 desc');
        // MSH-1 value is the pipe separator inserted by splice
        assert.ok(result.includes('MSH-1:'));
        assert.ok(result.includes('MSH-2:'));
    });

    it('returns null for unknown segment', function () {
        const line = 'ZZZ|foo|bar';
        const doc = mockDoc([line]);
        const result = tokenizeLine(doc, 0);

        assert.strictEqual(result, null);
    });

    it('handles empty fields', function () {
        const line = 'PID|1||||||';
        const doc = mockDoc([line]);
        const result = tokenizeLine(doc, 0);

        assert.ok(result, 'should return non-null output');
        assert.ok(result.includes('PID-1:'), 'should include PID-1');
        assert.ok(result.includes('PID-3:'), 'should include PID-3');
    });

    it('splits multi-component fields into subfield lines', function () {
        const line = 'PID|1||12345^^^MRN||Doe^John^M||19800101|M';
        const doc = mockDoc([line]);
        const result = tokenizeLine(doc, 0);

        // PID-5 (Patient Name, XPN type) has components Doe^John^M
        assert.ok(result.includes('PID-5.1:'), 'should include first subfield');
        assert.ok(result.includes('PID-5.2:'), 'should include second subfield');
        assert.ok(result.includes('PID-5.3:'), 'should include third subfield');
        assert.ok(result.includes('Family Name:'), 'should include XPN subfield desc');
        assert.ok(result.includes('Given Name:'), 'should include XPN subfield desc');
    });
});

describe('getFieldInfo', function () {
    it('returns null when cursor is on segment name', function () {
        const line = 'PID|1||12345';
        // Position 0-2 is "PID", position 3 is the pipe
        const result = getFieldInfo(line, 1);
        assert.strictEqual(result, null);
    });

    it('returns correct field info for a regular field', function () {
        // PID|1||12345^^^MRN
        const line = 'PID|1||12345^^^MRN';
        // Position 4 is '1' (PID-1, Set ID)
        const result = getFieldInfo(line, 4);

        assert.ok(result, 'should return non-null');
        assert.strictEqual(result.segment, 'PID');
        assert.strictEqual(result.fieldNumber, 1);
        assert.strictEqual(result.fieldDef.desc, 'Set ID - PID');
    });

    it('returns correct field for PID-3', function () {
        const line = 'PID|1||12345^^^MRN';
        // "PID|1||" = 7 chars, position 7 is start of '12345'
        const result = getFieldInfo(line, 7);

        assert.ok(result, 'should return non-null');
        assert.strictEqual(result.segment, 'PID');
        assert.strictEqual(result.fieldNumber, 3);
        assert.strictEqual(result.fieldDef.desc, 'Patient Identifier List');
    });

    it('uses MSH offset numbering (tokenIndex + 1)', function () {
        const line = 'MSH|^~\\&|SendApp|SendFac';
        // "MSH|" = 4 chars, "^~\\&" starts at position 4
        // tokens[1] = "^~\\&" which is MSH-2 (Encoding Characters)
        const result = getFieldInfo(line, 4);

        assert.ok(result, 'should return non-null');
        assert.strictEqual(result.segment, 'MSH');
        assert.strictEqual(result.fieldNumber, 2);
        assert.strictEqual(result.fieldDef.desc, 'Encoding Characters');
    });

    it('returns correct MSH-3 for sending application', function () {
        const line = 'MSH|^~\\&|SendApp|SendFac';
        // "MSH|^~\\&|" = 9 chars, "SendApp" starts at position 9
        const result = getFieldInfo(line, 9);

        assert.ok(result, 'should return non-null');
        assert.strictEqual(result.segment, 'MSH');
        assert.strictEqual(result.fieldNumber, 3);
        assert.strictEqual(result.fieldDef.desc, 'Sending Application');
    });

    it('returns correct component index for multi-component field', function () {
        // PID|1||12345^^^MRN||Doe^John^M
        const line = 'PID|1||12345^^^MRN||Doe^John^M';
        // PID-5 (Patient Name) starts after "PID|1||12345^^^MRN||" = 20 chars
        // "Doe" is at 20-22, "^" at 23, "John" at 24-27
        const result = getFieldInfo(line, 24);

        assert.ok(result, 'should return non-null');
        assert.strictEqual(result.segment, 'PID');
        assert.strictEqual(result.fieldNumber, 5);
        assert.strictEqual(result.componentIndex, 1, 'should be second component (John)');
        assert.deepStrictEqual(result.components, ['Doe', 'John', 'M']);
    });

    it('returns null for unknown segment', function () {
        const line = 'ZZZ|foo|bar';
        const result = getFieldInfo(line, 4);

        assert.strictEqual(result, null);
    });

    it('returns null for empty line', function () {
        const result = getFieldInfo('', 0);
        assert.strictEqual(result, null);
    });
});

describe('filterSegmentLines', function () {
    it('filters correct segment type from multi-line input', function () {
        const text = 'MSH|^~\\&|App\nPID|1||123\nOBX|1|ST|code\nPID|2||456\nOBX|2|ST|code2';
        const result = filterSegmentLines(text, 'PID');

        assert.strictEqual(result, 'PID|1||123\nPID|2||456\n');
    });

    it('returns empty string when no matches', function () {
        const text = 'MSH|^~\\&|App\nPID|1||123';
        const result = filterSegmentLines(text, 'OBR');

        assert.strictEqual(result, '');
    });

    it('handles single-line documents', function () {
        const text = 'MSH|^~\\&|App';
        const result = filterSegmentLines(text, 'MSH');

        assert.strictEqual(result, 'MSH|^~\\&|App\n');
    });

    it('does not match partial segment names', function () {
        const text = 'MSH|^~\\&|App\nMSH2|bad';
        const result = filterSegmentLines(text, 'MSH');

        // Only the first line matches since split('|')[0] of "MSH2|bad" is "MSH2"
        assert.strictEqual(result, 'MSH|^~\\&|App\n');
    });
});

describe('getVersion', function () {
    it('extracts version from MSH-12', function () {
        const doc = mockDoc(['MSH|^~\\&|SendApp|SendFac|RecvApp|RecvFac|20230101||ADT^A01|123|P|2.5.1']);
        assert.strictEqual(getVersion(doc), '2.5.1');
    });

    it('returns default version when MSH-12 is missing', function () {
        const doc = mockDoc(['MSH|^~\\&|SendApp|SendFac']);
        assert.strictEqual(getVersion(doc), '2.7.1');
    });

    it('returns default version for non-MSH first line', function () {
        const doc = mockDoc(['PID|1||12345']);
        assert.strictEqual(getVersion(doc), '2.7.1');
    });

    it('returns default version for unsupported version string', function () {
        const doc = mockDoc(['MSH|^~\\&|SendApp|SendFac|RecvApp|RecvFac|20230101||ADT^A01|123|P|2.4']);
        assert.strictEqual(getVersion(doc), '2.7.1');
    });

    it('handles composite version field (e.g. 2.5.1^USA)', function () {
        const doc = mockDoc(['MSH|^~\\&|SendApp|SendFac|RecvApp|RecvFac|20230101||ADT^A01|123|P|2.5.1^USA']);
        assert.strictEqual(getVersion(doc), '2.5.1');
    });
});

describe('v2.5.1 support', function () {
    it('tokenizeLine uses v2.5.1 definitions when MSH-12 is 2.5.1', function () {
        const msh = 'MSH|^~\\&|SendApp|SendFac|RecvApp|RecvFac|20230101||ADT^A01|123|P|2.5.1';
        const pid = 'PID|1||12345^^^MRN||Doe^John';
        const doc = mockDoc([msh, pid]);
        const result = tokenizeLine(doc, 1);

        assert.ok(result, 'should return non-null output');
        assert.ok(result.includes('PID-0:'), 'should include segment header');
        assert.ok(result.includes('PID-1:'), 'should include PID-1');
    });

    it('getFieldInfo works with explicit v2.5.1 version', function () {
        const line = 'PID|1||12345^^^MRN';
        const result = getFieldInfo(line, 4, '2.5.1');

        assert.ok(result, 'should return non-null');
        assert.strictEqual(result.segment, 'PID');
        assert.strictEqual(result.fieldNumber, 1);
        assert.strictEqual(result.fieldDef.desc, 'Set ID - PID');
    });
});

describe('getSegmentCounts', function () {
    it('counts segments in a multi-line message', function () {
        const text = 'MSH|^~\\&|App\nPID|1||123\nOBR|1\nOBX|1|ST|code\nOBX|2|ST|code2';
        const counts = getSegmentCounts(text);

        assert.strictEqual(counts['MSH'], 1);
        assert.strictEqual(counts['PID'], 1);
        assert.strictEqual(counts['OBR'], 1);
        assert.strictEqual(counts['OBX'], 2);
        assert.strictEqual(Object.keys(counts).length, 4);
    });

    it('ignores blank lines and non-segment content', function () {
        const text = 'MSH|^~\\&|App\n\nPID|1||123\n';
        const counts = getSegmentCounts(text);

        assert.strictEqual(counts['MSH'], 1);
        assert.strictEqual(counts['PID'], 1);
        assert.strictEqual(Object.keys(counts).length, 2);
    });

    it('returns empty object for empty text', function () {
        const counts = getSegmentCounts('');
        assert.deepStrictEqual(counts, {});
    });
});

describe('getFieldRange', function () {
    it('returns correct range for a PID field', function () {
        // PID|1||12345
        // Field 3 (12345) starts at index 7, length 5
        const result = getFieldRange('PID|1||12345', 'PID', 3, null);
        assert.deepStrictEqual(result, { start: 7, end: 12 });
    });

    it('handles MSH offset (fieldNumber - 1 = tokenIndex)', function () {
        // MSH|^~\&|SendApp|SendFac
        // MSH-3 (SendApp) is tokenIndex 2, starts at index 9, length 7
        const result = getFieldRange('MSH|^~\\&|SendApp|SendFac', 'MSH', 3, null);
        assert.deepStrictEqual(result, { start: 9, end: 16 });
    });

    it('returns correct range for a specific component', function () {
        // PID|1||12345^^^MRN||Doe^John^M
        // PID-5 starts at index 20, components: Doe(20-22) ^ John(24-27) ^ M(29)
        const result = getFieldRange('PID|1||12345^^^MRN||Doe^John^M', 'PID', 5, 1);
        assert.deepStrictEqual(result, { start: 24, end: 28 });
    });

    it('returns null when componentIndex exceeds available components', function () {
        const result = getFieldRange('PID|1||12345', 'PID', 3, 2);
        assert.strictEqual(result, null);
    });

    it('returns null when segment does not match', function () {
        const result = getFieldRange('OBX|1|ST|code', 'PID', 1, null);
        assert.strictEqual(result, null);
    });

    it('returns null when fieldNumber exceeds tokens', function () {
        const result = getFieldRange('PID|1', 'PID', 5, null);
        assert.strictEqual(result, null);
    });

    it('returns whole field when componentIndex is null and field has components', function () {
        // PID|1||12345^^^MRN||Doe^John^M
        // PID-5 whole field: Doe^John^M starts at 20, length 10
        const result = getFieldRange('PID|1||12345^^^MRN||Doe^John^M', 'PID', 5, null);
        assert.deepStrictEqual(result, { start: 20, end: 30 });
    });
});

describe('buildAck', function () {
    it('swaps sending and receiving application/facility', function () {
        const msg = 'MSH|^~\\&|SendApp|SendFac|RecvApp|RecvFac|20240101120000||ADT^A01|CTRL1|P|2.5.1\rPID|||123';
        const ack = buildAck(msg);
        const fields = ack.split('\r')[0].split('|');

        assert.strictEqual(fields[2], 'RecvApp');
        assert.strictEqual(fields[3], 'RecvFac');
        assert.strictEqual(fields[4], 'SendApp');
        assert.strictEqual(fields[5], 'SendFac');
    });

    it('preserves control ID in MSH-10 and MSA-2', function () {
        const msg = 'MSH|^~\\&|S|SF|R|RF|20240101||ADT^A01|MSG999|P|2.7.1\rPID|||123';
        const ack = buildAck(msg);
        const segments = ack.split('\r');
        const mshFields = segments[0].split('|');
        const msaFields = segments[1].split('|');

        assert.strictEqual(mshFields[9], 'MSG999');
        assert.strictEqual(msaFields[2], 'MSG999');
    });

    it('sets message type to ACK and MSA-1 to AA', function () {
        const msg = 'MSH|^~\\&|S|SF|R|RF|20240101||ADT^A01|1|P|2.5.1';
        const ack = buildAck(msg);
        const segments = ack.split('\r');
        const mshFields = segments[0].split('|');
        const msaFields = segments[1].split('|');

        assert.strictEqual(mshFields[8], 'ACK');
        assert.strictEqual(msaFields[0], 'MSA');
        assert.strictEqual(msaFields[1], 'AA');
    });

    it('preserves HL7 version from original message', function () {
        const msg = 'MSH|^~\\&|S|SF|R|RF|20240101||ADT^A01|1|P|2.7.1';
        const ack = buildAck(msg);
        const fields = ack.split('\r')[0].split('|');

        assert.strictEqual(fields[11], '2.7.1');
    });

    it('handles missing optional MSH fields gracefully', function () {
        const msg = 'MSH|^~\\&|||||||ADT^A01|CTRL1|P|2.5.1';
        const ack = buildAck(msg);
        const segments = ack.split('\r');

        assert.strictEqual(segments.length, 2);
        assert.ok(segments[0].startsWith('MSH|'));
        assert.ok(segments[1].startsWith('MSA|AA|'));
    });
});
