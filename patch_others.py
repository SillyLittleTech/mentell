import re

files = [
    'src/features/compilation/weeklyReportExport.ts',
    'src/features/compilation/weeklyStats.ts',
    'src/features/shop/weekTimeline.ts',
    'src/features/safety/riskAssessment.ts',
    'src/features/packages/packageService.ts',
    'src/features/packages/packageGenerator.ts',
    'src/features/score/scoreService.ts'
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    if "from '../../shared/dates'" in content:
        content = content.replace("from '../../shared/dates'", ", stripDateKey } from '../../shared/dates'")
        # Deduplicate just in case
        content = content.replace("{ dateKeyForLocalDay, stripDateKey }", "{ dateKeyForLocalDay, stripDateKey }")
    elif "from '../shared/dates'" in content:
        content = content.replace("from '../shared/dates'", ", stripDateKey } from '../shared/dates'")
    else:
        import_path = "'../../shared/dates'"
        if file.count('/') == 2:
            import_path = "'../shared/dates'"
        content = f"import {{ stripDateKey }} from {import_path}\n" + content

    content = content.replace("parseISO(dateKey)", "parseISO(stripDateKey(dateKey))")
    content = content.replace("parseISO(anchorDateKey)", "parseISO(stripDateKey(anchorDateKey))")
    content = content.replace("parseISO(entry.dateKey)", "parseISO(stripDateKey(entry.dateKey))")
    content = content.replace("parseISO(first.dateKey)", "parseISO(stripDateKey(first.dateKey))")
    content = content.replace("parseISO(prevDateKey)", "parseISO(stripDateKey(prevDateKey))")
    content = content.replace("parseISO(nextDateKey)", "parseISO(stripDateKey(nextDateKey))")
    content = content.replace("parseISO(anchor)", "parseISO(stripDateKey(anchor))")

    # Update IDB between queries to fetch both standard and `~` prefixed.
    # We will search for between(start, end, true, true) and handle it if possible.
    # Let's just do it manually for these specific files as they are few.

    with open(file, 'w') as f:
        f.write(content)
