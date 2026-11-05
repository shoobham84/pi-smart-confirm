import test from "node:test";
import assert from "node:assert/strict";
import { isSafeBashCommand } from "../extensions/index.ts";

test("Safe inspection commands", () => {
	assert.equal(isSafeBashCommand("ls -la"), true);
	assert.equal(isSafeBashCommand("cat package.json"), true);
	assert.equal(isSafeBashCommand("grep -o 'foo' file.txt"), true);
	assert.equal(isSafeBashCommand("find . -name '*.ts' -o -name '*.js'"), true);
	assert.equal(isSafeBashCommand("cat file.txt | grep pattern | wc -l"), true);
	assert.equal(isSafeBashCommand("cat file.txt >/dev/null"), true);
	assert.equal(isSafeBashCommand("ls 2>&1"), true);
	assert.equal(isSafeBashCommand("echo 'test'; grep 'foo' file.md 2>/dev/null; echo '(exit: $?)'"), true);
});

test("Dangerous commands/file writes to be caught", () => {
	assert.equal(isSafeBashCommand("find . -delete"), false);
	assert.equal(isSafeBashCommand("find . -exec rm -rf {} +"), false);
	assert.equal(isSafeBashCommand("find . -fprint output.txt"), false);

	assert.equal(isSafeBashCommand("echo 'hello' > file.txt"), false);
	assert.equal(isSafeBashCommand("cat file.txt >> log.txt"), false);

	assert.equal(isSafeBashCommand("sort -o output.txt file.txt"), false);

	assert.equal(isSafeBashCommand("echo $(rm -rf /)"), false);
	assert.equal(isSafeBashCommand("echo `whoami`"), false);

	assert.equal(isSafeBashCommand("rm -rf /tmp/test"), false);
	assert.equal(isSafeBashCommand("sudo apt-get update"), false);
	assert.equal(isSafeBashCommand("curl https://example.com"), false);
});
