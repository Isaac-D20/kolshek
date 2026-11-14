## v0.4.8-fork.1

### Fork Updates & Versioning
- **Project Fork Identity**: Established fork documentation, manifests, and versioning scheme to clearly differentiate this community fork from upstream KolShek (`DaveDushi/kolshek`).
- **Upstream Attribution**: Added upstream acknowledgments and security disclosure guidance.
- **Plugin & Skills Update**: Synchronized AI agent plugin manifests and embedded skills to version `0.4.8-fork.1`.

---

## v0.4.8

### Bug Fixes

- **Categories page no longer shows "No categories yet" when categorized transactions exist**: Orphan categories (used on transactions but never seeded in the categories table) are now surfaced in the list.
- **Transaction edit no longer crashes with empty-category names**: Empty-string category names are filtered at the query level and treated as Uncategorized consistently.
