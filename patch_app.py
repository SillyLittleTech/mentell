with open('src/App.tsx', 'r') as f:
    content = f.read()

# We need to type the parameter `drafts` correctly if it's an array,
# wait, `onSubmit` in LetterComposer gives an array of `Draft`.
# Then we map each `draft` to `upsertEntryFromDraft`.
# TypeScript complains that we don't pass all properties, which means `draft` is maybe considered as a string?
# Let's see the error again.
