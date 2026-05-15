import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

type GitApi = {
  repositories: Array<{
    rootUri: vscode.Uri;
    state: {
      HEAD?: {
        name?: string;
      };
    };
    push(remoteName?: string, branchName?: string, setUpstream?: boolean): Promise<void>;
  }>;
};

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.onDidEndTerminalShellExecution(async (event) => {
      if (!vscode.workspace.getConfiguration('gitdub').get<boolean>('listenForTerminalPush', true)) {
        return;
      }

      if (event.exitCode !== 0 || !isGitPushCommand(event.execution.commandLine.value)) {
        return;
      }

      try {
        await playSound(context);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Gitdub sound failed: ${message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitdub.pushWithSound', async () => {
      const gitApi = getGitApi();
      if (!gitApi) {
        void vscode.window.showErrorMessage('VS Code Git API is not available.');
        return;
      }

      if (gitApi.repositories.length === 0) {
        void vscode.window.showErrorMessage('No Git repository is open.');
        return;
      }

      const repo = await pickRepository(gitApi.repositories);
      if (!repo) {
        return;
      }

      try {
        await repo.push();
        await playSound(context);
        void vscode.window.showInformationMessage(`Pushed ${repo.state.HEAD?.name ?? repo.rootUri.fsPath}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Push failed: ${message}`);
      }
    })
  );
}

function getGitApi(): GitApi | undefined {
  const extension = vscode.extensions.getExtension('vscode.git');
  const gitExtension = extension?.exports as { getAPI(version: number): GitApi } | undefined;
  return gitExtension?.getAPI(1);
}

async function pickRepository(repositories: GitApi['repositories']): Promise<GitApi['repositories'][number] | undefined> {
  if (repositories.length === 1) {
    return repositories[0];
  }

  const selected = await vscode.window.showQuickPick(
    repositories.map((repository) => ({
      label: repository.state.HEAD?.name ?? repository.rootUri.fsPath,
      description: repository.rootUri.fsPath,
      repository
    })),
    { placeHolder: 'Choose a repository to push' }
  );

  return selected?.repository;
}

function isGitPushCommand(commandLine: string): boolean {
  const trimmed = commandLine.trim();
  if (!trimmed.startsWith('git ')) {
    return false;
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens[0] !== 'git') {
    return false;
  }

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === 'push') {
      return true;
    }
    if (!token.startsWith('-')) {
      return false;
    }
  }

  return false;
}

async function playSound(context: vscode.ExtensionContext): Promise<void> {
  const configuredPath = vscode.workspace.getConfiguration('gitdub').get<string>('soundPath')?.trim();
  const wavPath = path.join(context.extensionPath, 'src', 'yippee.wav');
  const m4aPath = path.join(context.extensionPath, 'src', 'yippee.m4a');
  const soundPath = configuredPath || (fs.existsSync(wavPath) ? wavPath : m4aPath);
  const extension = path.extname(soundPath).toLowerCase();

  if (extension === '.wav') {
    await playWav(soundPath);
    return;
  }

  await playMediaFile(soundPath);
}

async function playWav(soundPath: string): Promise<void> {
  const script = [
    '$player = New-Object Media.SoundPlayer $args[0]',
    '$player.Play()',
    'Start-Sleep -Milliseconds 250'
  ].join('; ');

  await runDetached(script, soundPath);
}

async function playMediaFile(soundPath: string): Promise<void> {
  const script = [
    '$player = New-Object -ComObject WMPlayer.OCX.7',
    '$null = $player.settings',
    '$player.URL = $args[0]',
    '$player.controls.play()',
    'Start-Sleep -Seconds 5'
  ].join('; ');

  await runDetached(script, soundPath);
}

async function runDetached(script: string, soundPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script, soundPath], {
      detached: true,
      stdio: 'ignore'
    });

    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

export function deactivate(): void {}
