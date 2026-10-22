# Releasing

Releases are published by GitHub Actions with npm Trusted Publishing. No npm
token is stored in the repository.

## One-time setup

On npmjs.com: package → Settings → Trusted Publisher → GitHub Actions.

- Organization or user: `yorelog`
- Repository: `dsh-omarchy-agent`
- Workflow filename: `publish.yml`
- Environment: leave empty

Or from a logged-in shell:

```sh
npm trust github dsh-omarchy-agent \
  --file publish.yml \
  --repository yorelog/dsh-omarchy-agent \
  --allow-publish \
  --registry https://registry.npmjs.org
```

## Release

```sh
npm version 0.3.2 --no-git-tag-version
git add package.json package-lock.json manifest.json
git commit -m "chore(release): 0.3.2"
git tag v0.3.2
git push origin main v0.3.2
```

The tag starts the **Publish** workflow. It checks that the tag matches
`package.json`, runs the typecheck, build, and smoke tests, and publishes with
provenance.

Do not publish a release from your laptop; the workflow owns it.
