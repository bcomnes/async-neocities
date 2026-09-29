# Contributing

## Releasing

Changelog and release preparation are automated with `releasearoni`. Releases are published by the GitHub Actions workflow:

- Ensure the change is merged into the default branch.
- Use the **Version and Release** workflow with the appropriate version type.
- The workflow runs the test suite, updates the version and changelog, creates the GitHub release, and publishes the package to npm.

For local versioning or changelog work, use `npm run version` rather than invoking `npm version` directly. The project requires Node.js 24 or newer and npm 11 or newer.

## Guidelines

- Patches, ideas and changes welcome.
- Fixes almost always welcome.
- Features sometimes welcome.
  - Please open an issue to discuss the issue prior to spending lots of time on the problem.
  - It may be rejected.
  - If you don't want to wait around for the discussion to commence, and you really want to jump into the implementation work, be prepared for fork if the idea is respectfully declined.
- Try to stay within the style of the existing code.
- All tests must pass (`npm test`).
- Additional features or code paths must be tested.
- Run `npm run update-supported-filetypes` when updating the Neocities file-type list.
- Aim for 100% coverage.
- Questions are welcome, however unless there is a official support contract established between the maintainers and the requester, support is not guaranteed.
- Contributors reserve the right to walk away from this project at any moment with or without notice.
