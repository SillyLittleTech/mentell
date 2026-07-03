with open('src/features/shop/weekTimeline.ts', 'r') as f:
    content = f.read()

content = content.replace("import { dateKeyForLocalDay } , stripDateKey } from '../../shared/dates'", "import { dateKeyForLocalDay, stripDateKey } from '../../shared/dates'")
with open('src/features/shop/weekTimeline.ts', 'w') as f:
    f.write(content)
