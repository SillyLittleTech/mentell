with open('src/features/shop/weekTimeline.ts', 'r') as f:
    content = f.read()

# Since bulk entries are prefixed with `~`, `completedKeys.has(dateKey)` might fail!
# `completedKeys` contains the ACTUAL keys from the database, like `~2024-05-24`.
# We iterate over `dateKey = toDateKey(d)` which is `2024-05-24`.
# So we need to check if `completedKeys.has(dateKey) || completedKeys.has('~' + dateKey)`.

old_logic = "if (completedKeys.has(dateKey)) {"
new_logic = "if (completedKeys.has(dateKey) || completedKeys.has('~' + dateKey)) {"

content = content.replace(old_logic, new_logic)

# Wait, `firstEntryDate` might be `~2024-05-20` because it's fetched with `orderBy('dateKey')`. But IDB orders `~` after `9`. So `firstRow` will actually be the earliest NON-backdated entry.
# That's fine because streak/first join logic usually depends on standard entries anyway. If they backlog earlier than they started, we can just strip it if needed, or leave it.

# Let's fix the query to ALSO get `~` prefix entries! I did this in patch_between.py but wait!
# I overwrote it when I ran patch_timeline.py!

old_query = """  const entries = await getDb().entries
    .where('dateKey')
    .between(toDateKey(weekStart), weekEndKey, true, true)
    .toArray()"""
new_query = """  const entriesNorm = await getDb().entries.where('dateKey').between(toDateKey(weekStart), weekEndKey, true, true).toArray()
  const entriesBulk = await getDb().entries.where('dateKey').between('~' + toDateKey(weekStart), '~' + weekEndKey, true, true).toArray()
  const entries = [...entriesNorm, ...entriesBulk]"""

content = content.replace(old_query, new_query)

with open('src/features/shop/weekTimeline.ts', 'w') as f:
    f.write(content)
