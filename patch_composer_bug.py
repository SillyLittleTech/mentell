# Fix the nitpick: If a user unchecks "More", we should probably drop the additional drafts or prevent them from being submitted.
# Actually, the easiest is to slice the array if they submit when isBulkMode is false.

with open('src/features/compose/LetterComposer.tsx', 'r') as f:
    content = f.read()

# Find `for (const draft of draftInputs) {` and replace with `for (const draft of (isBulkMode ? draftInputs : [draftInputs[0]])) {`
content = content.replace("for (const draft of draftInputs) {", "for (const draft of (isBulkMode ? draftInputs : [draftInputs[0]])) {")

with open('src/features/compose/LetterComposer.tsx', 'w') as f:
    f.write(content)
