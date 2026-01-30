# HL7 language support for Visual Studio Code

Field definitions and hover info use the HL7 v2.7.1 data dictionary. Messages from other v2.x versions will still get syntax highlighting, but field names and datatypes may not match exactly.

## Support This Project
If this extension is useful to you, consider [sponsoring its development](https://github.com/sponsors/pagebrooks).

## Features
### Syntax coloring
* Segments and field separators are highlighted for easy interpretation.

![Syntax coloring](images/syntax.png)

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

### Field Hover Info
* Hover over any field in an HL7 message to see its name, datatype, and component breakdown.
* For fields with multiple components (separated by `^`), all components are listed with the one under the cursor highlighted.

### Filter Segment Command
* Move the cursor to a line that you wish to filter.
* F1 -> HL7: Filter Segment
* A new file will be created containing only segments that match the current line.

![Filter Segment](images/filter_segment.png)


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

## More information
* [vscode-hl7 on the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=pbrooks.hl7)