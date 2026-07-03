# weeklyReportExport.ts
with open('src/features/compilation/weeklyReportExport.ts', 'r') as f:
    content = f.read()
# "return getDb().entries.where('dateKey').between(startKey, endKey, true, true).toArray()"
# Replace it with fetching both and combining.
old1 = "return getDb().entries.where('dateKey').between(startKey, endKey, true, true).toArray()"
new1 = """const entriesNorm = await getDb().entries.where('dateKey').between(startKey, endKey, true, true).toArray()
  const entriesBulk = await getDb().entries.where('dateKey').between('~' + startKey, '~' + endKey, true, true).toArray()
  return [...entriesNorm, ...entriesBulk]"""
content = content.replace(old1, new1)

old2 = """    return getDb().entries
      .where('dateKey')
      .between(toDateKey(weekStart), endKey, true, true)
      .toArray()"""
new2 = """    const entriesNorm = await getDb().entries.where('dateKey').between(toDateKey(weekStart), endKey, true, true).toArray()
    const entriesBulk = await getDb().entries.where('dateKey').between('~' + toDateKey(weekStart), '~' + endKey, true, true).toArray()
    return [...entriesNorm, ...entriesBulk]"""
content = content.replace(old2, new2)
with open('src/features/compilation/weeklyReportExport.ts', 'w') as f:
    f.write(content)

# weeklyStats.ts
with open('src/features/compilation/weeklyStats.ts', 'r') as f:
    content = f.read()
old3 = """  const entries = (
    await getDb().entries.where('dateKey').between(startKey, endKey, true, true).toArray()
  ).sort((a, b) => b.createdAt - a.createdAt)"""
new3 = """  const entriesNorm = await getDb().entries.where('dateKey').between(startKey, endKey, true, true).toArray()
  const entriesBulk = await getDb().entries.where('dateKey').between('~' + startKey, '~' + endKey, true, true).toArray()
  const entries = [...entriesNorm, ...entriesBulk].sort((a, b) => b.createdAt - a.createdAt)"""
content = content.replace(old3, new3)
with open('src/features/compilation/weeklyStats.ts', 'w') as f:
    f.write(content)

# weekTimeline.ts
with open('src/features/shop/weekTimeline.ts', 'r') as f:
    content = f.read()
old4 = """  const entries = await getDb()
    .entries.where('dateKey')
    .between(toDateKey(weekStart), weekEndKey, true, true)
    .toArray()"""
new4 = """  const entriesNorm = await getDb().entries.where('dateKey').between(toDateKey(weekStart), weekEndKey, true, true).toArray()
  const entriesBulk = await getDb().entries.where('dateKey').between('~' + toDateKey(weekStart), '~' + weekEndKey, true, true).toArray()
  const entries = [...entriesNorm, ...entriesBulk]"""
content = content.replace(old4, new4)
with open('src/features/shop/weekTimeline.ts', 'w') as f:
    f.write(content)

# riskAssessment.ts
with open('src/features/safety/riskAssessment.ts', 'r') as f:
    content = f.read()
old5 = "return getDb().entries.where('dateKey').between(startKey, dateKey, true, true).toArray()"
new5 = """const entriesNorm = await getDb().entries.where('dateKey').between(startKey, dateKey, true, true).toArray()
  const entriesBulk = await getDb().entries.where('dateKey').between('~' + startKey, '~' + dateKey, true, true).toArray()
  return [...entriesNorm, ...entriesBulk]"""
content = content.replace(old5, new5)
old6 = "const rows = await getDb().entries.where('dateKey').between(startKey, dateKey, true, true).toArray()"
new6 = """const rowsNorm = await getDb().entries.where('dateKey').between(startKey, dateKey, true, true).toArray()
  const rowsBulk = await getDb().entries.where('dateKey').between('~' + startKey, '~' + dateKey, true, true).toArray()
  const rows = [...rowsNorm, ...rowsBulk]"""
content = content.replace(old6, new6)
with open('src/features/safety/riskAssessment.ts', 'w') as f:
    f.write(content)

# packageGenerator.ts
with open('src/features/packages/packageGenerator.ts', 'r') as f:
    content = f.read()
old7 = "const count = await getDb().entries.where('dateKey').between(startKey, endKey, true, true).count()"
new7 = """const countNorm = await getDb().entries.where('dateKey').between(startKey, endKey, true, true).count()
    const countBulk = await getDb().entries.where('dateKey').between('~' + startKey, '~' + endKey, true, true).count()
    const count = countNorm + countBulk"""
content = content.replace(old7, new7)
with open('src/features/packages/packageGenerator.ts', 'w') as f:
    f.write(content)
