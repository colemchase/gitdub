# gitdub

Play a sound after a successful Git push in VS Code.

## What it does

Adds a `Gitdub: Push With Sound` command. It uses the built-in VS Code Git API to push, then plays:

- `src/yippee.m4a` by default, or
- a custom sound file from `gitdub.soundPath`.

It also listens for successful `git push` commands typed in the integrated terminal and plays the same sound.

## Run it

1. `npm install`
2. `npm run compile`
3. Open this folder in VS Code
4. Press `F5`
5. Run `Gitdub: Push With Sound`

## Notes

Automatic terminal detection depends on VS Code shell integration being active in the integrated terminal.
