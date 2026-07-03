with open('src/features/compose/LetterComposer.tsx', 'r') as f:
    content = f.read()

# Let's check `export type Draft = `
# The type is declared as `type Draft = ` without `export`.
content = content.replace("type Draft = {", "export type Draft = {")
with open('src/features/compose/LetterComposer.tsx', 'w') as f:
    f.write(content)
