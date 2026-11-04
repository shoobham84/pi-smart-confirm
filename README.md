# pi-smart-confirm
smart confirmation gate for the pi coding agent.

### What do?
- harmless commands like `cat`, `ls`, `grep`, `pwd`, a safe `|`, `2>/dev/null`, etc. run automatically without prompting

- flags file modifications like `write`, `edit`, shell redirections like `> file.txt`, cmd substitutions using backticks or `$(...)`, and dangerous flags like `find -exec`, `find -delete`  have a confirmation TUI show up

### Installation:
```bash
pi install npm:pi-smart-confirm
```
