# HL7 language support for Visual Studio Code

  [![Version](https://img.shields.io/visual-studio-marketplace/v/pbrooks.hl7)](https://marketplace.visualstudio.com/items?itemName=pbrooks.hl7)
  [![Installs](https://img.shields.io/visual-studio-marketplace/i/pbrooks.hl7)](https://marketplace.visualstudio.com/items?itemName=pbrooks.hl7)
  [![Rating](https://img.shields.io/visual-studio-marketplace/r/pbrooks.hl7)](https://marketplace.visualstudio.com/items?itemName=pbrooks.hl7)

Syntax highlighting, field tokenization, and hover info for HL7 v2.x messages in Visual Studio Code.

Field definitions and hover info use the HL7 v2.7.1 data dictionary. Messages from other v2.x versions will still get syntax highlighting, but field names and datatypes may not match exactly.

## Features
### Syntax coloring
* Segments and field separators are highlighted for easy interpretation.

![Syntax coloring](images/syntax.png)

### Field Hover Info
* Hover over any field in an HL7 message to see its name, datatype, and component breakdown.
* For fields with multiple components (separated by `^`), all components are listed with the one under the cursor highlighted.

![Field Hover](images/field_hover.png)

### Tokenize Line Command
* Move the cursor to a line that you wish to tokenize.
* F1 -> HL7: Tokenize Line
* Line will be split into fields with the ordinal and definition.
* Output opens in a dedicated tab (starting from the top) that is reused on subsequent tokenize actions.

![Tokenize Line](images/tokenize_line.png)

### Auto-Tokenize Mode
* F1 -> HL7: Toggle Auto-Tokenize
* When enabled, the current line is automatically tokenized as you move the cursor through the file — no need to re-run the command for each line.
* A status bar indicator shows when Auto-Tokenize is active. Click it to toggle off.

![Aut-Tokenize Mode](images/auto_tokenize_demo.gif)

### Filter Segment Command
* Move the cursor to a line that you wish to filter.
* F1 -> HL7: Filter Segment
* A new file will be created containing only segments that match the current line.

![Filter Segment](images/filter_segment.png)


## Commands

| Command                       | Description                                                  |
| ----------------------------- | ------------------------------------------------------------ |
| `HL7: Tokenize Line`         | Split the current line into fields with ordinals and definitions |
| `HL7: Toggle Auto-Tokenize`  | Automatically tokenize each line as the cursor moves         |
| `HL7: Filter Segment`        | Create a new file containing only matching segment types     |

## Installation
### Visual Studio Code
Search for "HL7" in the Extensions sidebar, or press `F1` and enter `ext install pbrooks.hl7`.

### Manual Installation
Clone the [GitHub repository](https://github.com/pagebrooks/vscode-hl7) under your local extensions folder:
* Windows: `%USERPROFILE%\.vscode\extensions`
* Mac / Linux: `$HOME/.vscode/extensions`

Then initialize the repository submodules:
```
git submodule init
git submodule update
```

## Issues / Feature requests
You can submit your issues and feature requests on the GitHub [issues page](https://github.com/pagebrooks/vscode-hl7/issues).

## Support This Project
If this extension is useful to you, consider [sponsoring its development](https://github.com/sponsors/pagebrooks).

## What is HL7?
[HL7](https://www.hl7.org/) (Health Level Seven) is a set of standards for exchanging clinical and administrative data between healthcare systems. The v2.x messaging format uses pipe-delimited segments (e.g. `MSH`, `PID`, `OBR`) and is one of the most widely deployed healthcare integration standards in the world.

## More information
* [vscode-hl7 on the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=pbrooks.hl7)
* [Changelog](CHANGELOG.md)