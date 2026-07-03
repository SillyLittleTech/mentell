with open('src/features/compilation/WeeklyProjector.tsx', 'r') as f:
    content = f.read()

# Make sure we use stripDateKey so the UI doesn't look weird if we want.
# Actually the user explicitly said "lets put a ~ by a placeholder exact date that we use, to show that the date was submitted via a bulk entry"
# This means `~` IS the indicator! I should NOT strip it in the UI, I should render it!
# It already renders as `{e.dateKey}` which will be `~2024-05-24`. That perfectly matches the request!
