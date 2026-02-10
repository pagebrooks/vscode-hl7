# Changelog

## 0.0.22
- Add field highlighting
- Add rate extension feedback mechanism.

## 0.0.21
- Improve documentation
- Update Logo

## 0.0.20
- Add sponsor information

## 0.0.19

- Tokenize Line now opens in a reusable document tab instead of the output window, with content displayed from the top
- Subsequent tokenize actions reuse the same tab rather than opening a new one each time
- Added Auto-Tokenize mode — toggle with `HL7: Toggle Auto-Tokenize` to automatically tokenize each line as the cursor moves through a file
- Status bar indicator shows when Auto-Tokenize is active

## 0.0.18

- Fix package deployment issues

## 0.0.17

- Fix package deployment issues

## 0.0.16

- Added error messages for unrecognized segments in Tokenize Line and Filter Segment commands
- Added `activationEvents` so the extension only loads when an HL7 file is opened
- Added marketplace keywords for better discoverability
- Removed inapplicable C-style comment definitions from language configuration
- Reduced package size by excluding build artifacts and git metadata from bundle
- Updated README

## 0.0.15

- Added hover provider for HL7 fields — hover over any part of an HL7 line to see field name, datatype, and component breakdown from the HL7 v2.7.1 dictionary

## 0.0.14

- Added subfield descriptions to Tokenize Line output using HL7 dictionary datatype definitions
- Changed subfield notation from dashed zero-based (PID-3-0) to standard HL7 dotted one-based (PID-3.1)
- Modernized extension code (const/let, arrow functions, native padEnd)
- Converted syntax grammar from XML plist to JSON format
- Cleaned up extension packaging

## 0.0.13

- Updated VS Code engine compatibility to ^1.75.0

## 0.0.12

- Initial marketplace release
- Syntax highlighting for HL7 files
- Tokenize Line command
- Filter Segment command
