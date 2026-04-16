## v0.4.8

### Bug Fixes

- **Categories page no longer shows "No categories yet" when categorized transactions exist**: Orphan categories (used on transactions but never seeded in the categories table) are now surfaced in the list.
- **Transaction edit no longer crashes with empty-category names**: Empty-string category names are filtered at the query level and treated as Uncategorized consistently.
