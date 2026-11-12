#!/bin/sh
# PreToolUse hook: exit 2 blocks the tool call and shows stderr to the agent.
# Catches what permission deny rules miss, such as `cd x && rm -rf y`.
# shortcut: pattern match, not a shell parser. Misses split flags (`rm -r -f`),
# `find -delete` and `git push +ref`; upgrade if an agent ever gets past it.
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')

deny() {
  echo "Blocked by .claude/hooks/block-dangerous.sh: $1" >&2
  exit 2
}

if printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]_.-])rm[[:space:]]+(-[^[:space:]]+[[:space:]]+)*-[[:alpha:]]*([rR][[:alpha:]]*f|f[[:alpha:]]*[rR])'; then
  deny "rm -rf"
fi
if printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+push([[:space:]].*)?[[:space:]](--force|-[[:alpha:]]*f)'; then
  deny "git push --force"
fi

case "$file" in
  *.env.example) ;;
  *.env | *.env.* | */.ssh/* | */secrets/* | *.pem | *id_rsa* | *id_ed25519*)
    deny "edit to secret file $file"
    ;;
esac
exit 0
