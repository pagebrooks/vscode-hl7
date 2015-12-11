# [HL7](http://www.hl7.org/) language support for [Visual Studio Code](https://code.visualstudio.com/)

## Features
### Syntax coloring
* Segments and field separators are highlighted for easy interpretation.

![Syntax coloring](images/syntax.png)

### Tokenize Line
* Move the cursor to a line that you wish to tokenize.
* F1 -> Tokenize Line
* Line will be split into fields with the ordinal and definition

![Tokenize Line](images/tokenize_line.png)

### Filter Segments
* Move the cursor to a line that you wish to filter.
* F1 -> Filter Segment
* A new file will be created containing only segments that match the current line.

![Filter Segment](images/filter_segment.png)


## Installation
### Visual Studio Code
Hit `F1` and enter the `ext install hl7` command.

### Installing the extension Locally
Clone the [GitHub repository](https://github.com/pagebrooks/vscode-hl7) under your local extensions folder:
* Windows: `%USERPROFILE%\.vscode\extensions`
* Mac / Linux: `$HOME/.vscode/extensions`

## Issues / Feature requests
You can submit your issues and feature requests on the GitHub [issues page](https://github.com/pagebrooks/vscode-hl7/issues).

## More information
* [vscode-hl7 on the Visual Studio Marketplace](https://marketplace.visualstudio.com/items/pbrooks.hl7)