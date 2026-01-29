# Changelog

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
