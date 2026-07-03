# shared/dates.ts
with open('src/shared/dates.ts', 'r') as f:
    content = f.read()
if "stripDateKey" not in content:
    content += "\nexport function stripDateKey(dateKey: string) {\n  return dateKey.startsWith('~') ? dateKey.slice(1) : dateKey\n}\n"
with open('src/shared/dates.ts', 'w') as f:
    f.write(content)

# db/validation.ts
with open('src/db/validation.ts', 'r') as f:
    content = f.read()
content = content.replace("dateKey: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/)", "dateKey: z.string().regex(/^~?\\d{4}-\\d{2}-\\d{2}$/)")
with open('src/db/validation.ts', 'w') as f:
    f.write(content)
