# ST Battle primary project

This folder is the canonical location for all ST Battle work:
C:\Users\David Granholm\.codex\Games\ST-Battle

- Edit and run the application from this folder. Keep new game files, assets, tests, exports and documentation here.
- Open ST-Battle.code-workspace to use this folder as the VS Code workspace.
- archive/ contains historical working copies and previous change scripts. These are reference material, not the current application. Do not copy them over the active files unless the user explicitly requests a historical restoration.
- Run checks with node --test test/*.test.cjs, and start the local game with node server.cjs or Start ST Battle.cmd.
- ST-Battle-Voice-Clips.txt contains the 43 dialogue lines. generate-voices.cjs creates the Cedar captain and Marin helm recordings when OPENAI_API_KEY is configured locally.
