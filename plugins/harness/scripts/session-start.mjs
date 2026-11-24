// Provisional (Task 1 spike): proves the exec form reaches this script.
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'harness ok' },
}));
