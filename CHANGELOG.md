# Change Log
## [0.6.1]
- Changed the notation of the y-axis label
## [0.6.0]
- Added a command to close all the plot window
- Added an option whether create a plot window every time or reload a window
## [0.5.2]
- animation fix
## [0.5.1]
- package fix
- Fixed several problems that occurred on Windows.
## [0.5.0]
- Fixed duplicate display of "Plot result" windows. When a window already exists, the existing window is updated instead of creating a new panel.
## [0.4.1]
- The syntax checker was not working correctly, so the feature has been disabled.
- Improved a feature to cancel the simulator, allowing the simulation process to be killed by pid.
## [0.4.0]
- language changed: js -> ts
- Fixed an issue that caused text(especially π) to display incorrectly
## [0.3.5]
- rule of outputlogfile was changed (HMS_MMDD_YYYY -> YYYYMMDDHMS)
## [0.3.4]
- highlighter fix
## [0.3.3]
- bug fix 
## [0.3.2]
- bug fix 
## [0.3.1]
- added fileicon
- changed theme icon
- optimized this extension package size
## [0.2.16]
- fix a problem
- add a new command
## [0.2.15]
- Revert stable version (0.2.14 has a fatal error)
## [0.2.14]
- Optimized extension files structure
## [0.2.13]
### Fixces
- Syntax height issue when "K devname|devnode..."  is fixed
### Other
- vscode.ViewColumn is changed from One to Two
## [0.2.12]
### Other
- Preformance improved
## [0.2.11]
### New
- A new configration properity added "saveImage.fontsize"
## [0.2.10]
### Fixes
- bug fix
## [0.2.9]
### New
- A new configration properity added "graph.timescale"
## [0.2.8]
### Fixes
- Some issues with comand keybind were fixed
## [0.2.7]
### New
- formatter
- editable flot, you can change titles, axis-labels, and so on in plots
### Other
- this syntax hilights rule was changed
## [0.2.6]

### New

- progress window

## [0.2.5]

### New

- html file saving

### Fixes

- Issues with simulation 

### Other

- Output filename rules are changed

## [0.2.4]

### New

- Configuration about plot image added, you can specify image format, width and height you save

### Fixes

- Issue with plot image saving fixed 

## [0.2.3]

### Fixes

- Quick fix

## [0.2.2]

### New

### Fixes

- A bug with simulation (child_proccess) fixed

### Removals

### Other

## [0.2.1]

### Fixes

- Plot layout improved
- CSV file problems fixed

## [0.2.0]

### New

2024-01-21

- Simulation Exector
  - Added a button labeled "Execute Simulation" to the top-right menu bar. Clicking on this button will display the simulation results of the josim file in a new tab. To plot using the plotly library online, an internet connection is required. Please be aware that error message handling may be insufficient, and the functionality might not work even if no error messages are displayed.

## [0.1.2]

2023 - 06 -13

### New

- Improved syntax highlighter

### Fixed

- Some syntax highlighter problem

## [0.1.1]

2023 - 06 - 13

### Fixed

- Some sntax highlighter problem

## [0.1.0]

2023 - 06 -11

### New

- Basic Syntax hilights
- Basic definition provider
- Basic hover provider
