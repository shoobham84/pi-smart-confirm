import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ALLOWED_BASE_COMMANDS: ReadonlySet<string> = new Set([
  "ls", "cat", "head", "tail", "less", "more", "find", "grep", "rg", 
  "wc", "stat", "file", "diff", "pwd", "whoami", "who", "hostname", 
  "date", "uptime", "uname", "nproc", "df", "free", "du", "tree", 
  "which", "type", "echo", "printf", "sort", "uniq", "cut", "tr", 
  "true", "false", "cd"
]);

const ALLOWED_TOOLS: ReadonlySet<string> = new Set([
  "read", "read_file", "view", "glob", "grep", "list_dir", "ls"
]);

export function isSafeBashCommand(rawCmd: string): boolean {
  const cmd = rawCmd.trim();
  if (!cmd) return true;

  //double quotes ("...") are safe unless they contain `...` or $(...) command substitution.
  let hasUnsafeExpansionInQuotes = false;
  const withoutQuotes = cmd.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, (match) => {
    if (match.startsWith('"')) {
      //block `backticks` or $(subshells) inside double quotes but allow $VAR and $?
      if (/`|\$\(/.test(match)) {
        hasUnsafeExpansionInQuotes = true;
      }
    }
    return "__STR__";
  });

  if (hasUnsafeExpansionInQuotes) return false;

  //safe: 2>&1, 2&>1, >&2, &>/dev/null, 2>/dev/null, >/dev/null, >/dev/stdout, etc
  const sanitized = withoutQuotes
    .replace(/(?:\d*>&\d+|\d*&>\d+|\d*&>\s*\/dev\/(?:null|stdout|stderr)|\d*>>?\s*\/dev\/(?:null|stdout|stderr))/g, " ")
    .trim();

  //block subshells () command substitution ` or $(, blocks {}, remaining file redirects < >, or single & (backgrounding)
  const dangerousSyntax = /[`(){}<>]|(?<!&)&(?!&)/;
  if (dangerousSyntax.test(sanitized)) return false;

  //block dangerous flags (fixed \b boundary) including find write flags
  const dangerousFlags = /(?:^|\s)(?:-exec|-execdir|-delete|-ok|-okdir|--output|-fprint|-fprintf|-fls)\b/;
  if (dangerousFlags.test(sanitized)) return false;

  //catch file writes with sort -o (while leaving grep -o and find -o safe)
  if (/\bsort\b.*\s-o\b/.test(sanitized)) return false;

  //split chained commands by | && || ; or newlines and validate every single command
  const subCommands = sanitized.split(/\s*(?:\|\||&&|\||;|\r?\n)\s*/);

  for (const sub of subCommands) {
    const trimmedSub = sub.trim();
    if (!trimmedSub) continue;

    const tokens = trimmedSub.split(/\s+/);
    
    //skip leading environment variable assignments (e.g. `LANG=C grep foo`)
    let cmdIndex = 0;
    while (cmdIndex < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[cmdIndex])) {
      cmdIndex++;
    }

    const firstToken = (tokens[cmdIndex] ?? "").toLowerCase();
    if (!firstToken) continue;

    //extract base command (e.g., "/usr/bin/grep" -> "grep")
    const baseCmd = firstToken.split("/").pop() ?? "";

    if (!ALLOWED_BASE_COMMANDS.has(baseCmd)) {
      return false; 
    }
  }

  return true;
}

export default function(pi: ExtensionAPI) {
  pi.on('tool_call', async (event, ctx) => {
    if (!ctx.hasUI) {
      return { block: true, reason: "Execution blocked: No UI available" };
    }

    if (ALLOWED_TOOLS.has(event.toolName)) {
      return undefined;
    }

    let summary = "";
    const input = event.input as Record<string, unknown> | undefined;

    switch (event.toolName) {
      case "bash": {
        const rawCmd = (input?.command as string) ?? "";
        
        if (isSafeBashCommand(rawCmd)) {
          return undefined;
        }

        summary = `run bash command:\n\n ${rawCmd.trim()}`;
        break;
      }

      case "write": {
        const path = (input?.path as string) ?? "";
        summary = `write file: \n\n ${path}`;
        break;
      }

      case "edit": {
        const path = (input?.path as string) ?? "";
        summary = `edit file at path: \n\n ${path}`;
        break;
      }

      default: {
        summary = `execute ${event.toolName} with parameters:\n\n${JSON.stringify(event.input, null, 2)}`;
        break;
      }
    }

    const choice = await ctx.ui.select(
      `Are you sure you want to ${summary}?`, 
      ['Deny', 'Allow']  
    );

    if (choice !== 'Allow') {
      return {
        block: true, 
        reason: `User kun doesn't want to execute ${event.toolName} UwU~`
      };
    }

    return undefined;
  });
}
