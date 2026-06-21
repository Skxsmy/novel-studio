import { spawn } from "node:child_process";
import { platform } from "node:os";

export class CredentialStoreError extends Error {
  constructor(
    message: string,
    public readonly code: "credential-store-unavailable" | "credential-not-found" | "credential-write-failed",
    options: { cause?: unknown } = {},
  ) {
    super(message);
    this.name = "CredentialStoreError";
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export interface CredentialStore {
  readonly kind: "windows-credential-manager" | "unavailable";
  isAvailable(): Promise<boolean>;
  writeSecret(targetName: string, secret: string): Promise<void>;
  readSecret(targetName: string): Promise<string>;
  deleteSecret(targetName: string): Promise<void>;
}

export function isLikelySecret(value: string | null | undefined): boolean {
  if (!value) return false;
  return /(?:sk-[A-Za-z0-9_-]{8,}|api[_-]?key|bearer\s+[A-Za-z0-9._-]+)/iu.test(value);
}

export function assertSafeCredentialRef(value: string | null | undefined): void {
  if (isLikelySecret(value)) {
    throw new CredentialStoreError(
      "凭据引用不能包含明文密钥。请先把密钥存入系统凭据，再只保存引用名称。",
      "credential-write-failed",
    );
  }
}

export class UnavailableCredentialStore implements CredentialStore {
  readonly kind = "unavailable" as const;

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async writeSecret(): Promise<void> {
    throw this.error();
  }

  async readSecret(): Promise<string> {
    throw this.error();
  }

  async deleteSecret(): Promise<void> {
    throw this.error();
  }

  private error(): CredentialStoreError {
    return new CredentialStoreError(
      "当前运行环境无法访问 Windows 凭据系统；不会回退到明文文件。",
      "credential-store-unavailable",
    );
  }
}

interface CredentialCommand {
  action: "write" | "read" | "delete";
  targetName: string;
  secret?: string;
}

const WINDOWS_CREDENTIAL_SCRIPT = String.raw`
$ErrorActionPreference = "Stop"
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class NovelStudioCredMan {
  public const UInt32 CRED_TYPE_GENERIC = 1;
  public const UInt32 CRED_PERSIST_LOCAL_MACHINE = 2;

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags;
    public UInt32 Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredWrite(ref CREDENTIAL credential, UInt32 flags);

  [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredRead(string target, UInt32 type, UInt32 reservedFlag, out IntPtr credentialPtr);

  [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredDelete(string target, UInt32 type, UInt32 flags);

  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern void CredFree(IntPtr credentialPtr);
}
"@

function Write-Secret($targetName, $secret) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$secret)
  $blob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
  try {
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)
    $credential = New-Object NovelStudioCredMan+CREDENTIAL
    $credential.Type = [NovelStudioCredMan]::CRED_TYPE_GENERIC
    $credential.TargetName = [string]$targetName
    $credential.CredentialBlobSize = $bytes.Length
    $credential.CredentialBlob = $blob
    $credential.Persist = [NovelStudioCredMan]::CRED_PERSIST_LOCAL_MACHINE
    $credential.UserName = "Novel Studio"
    if (-not [NovelStudioCredMan]::CredWrite([ref]$credential, 0)) {
      throw "CredWrite failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
    }
  } finally {
    if ($blob -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::FreeHGlobal($blob)
    }
  }
}

function Read-Secret($targetName) {
  $ptr = [IntPtr]::Zero
  if (-not [NovelStudioCredMan]::CredRead([string]$targetName, [NovelStudioCredMan]::CRED_TYPE_GENERIC, 0, [ref]$ptr)) {
    throw "CredRead failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
  }
  try {
    $credential = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][NovelStudioCredMan+CREDENTIAL])
    if ($credential.CredentialBlobSize -eq 0) { return "" }
    $bytes = New-Object byte[] $credential.CredentialBlobSize
    [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $bytes, 0, $credential.CredentialBlobSize)
    return [System.Text.Encoding]::UTF8.GetString($bytes)
  } finally {
    if ($ptr -ne [IntPtr]::Zero) {
      [NovelStudioCredMan]::CredFree($ptr)
    }
  }
}

function Delete-Secret($targetName) {
  if (-not [NovelStudioCredMan]::CredDelete([string]$targetName, [NovelStudioCredMan]::CRED_TYPE_GENERIC, 0)) {
    $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($code -ne 1168) { throw "CredDelete failed: $code" }
  }
}

if ($payload.action -eq "write") {
  Write-Secret $payload.targetName $payload.secret
  "ok"
} elseif ($payload.action -eq "read") {
  Read-Secret $payload.targetName
} elseif ($payload.action -eq "delete") {
  Delete-Secret $payload.targetName
  "ok"
} else {
  throw "Unknown credential action"
}
`;

export class WindowsCredentialStore implements CredentialStore {
  readonly kind = "windows-credential-manager" as const;

  async isAvailable(): Promise<boolean> {
    return platform() === "win32";
  }

  async writeSecret(targetName: string, secret: string): Promise<void> {
    await this.run({ action: "write", targetName, secret });
  }

  async readSecret(targetName: string): Promise<string> {
    return this.run({ action: "read", targetName });
  }

  async deleteSecret(targetName: string): Promise<void> {
    await this.run({ action: "delete", targetName });
  }

  private async run(command: CredentialCommand): Promise<string> {
    if (platform() !== "win32") {
      throw new CredentialStoreError(
        "Windows 凭据系统只能在 Windows 上使用；不会回退到明文文件。",
        "credential-store-unavailable",
      );
    }
    return new Promise((resolve, reject) => {
      const child = spawn("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        WINDOWS_CREDENTIAL_SCRIPT,
      ], { windowsHide: true });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += String(chunk); });
      child.stderr.on("data", (chunk) => { stderr += String(chunk); });
      child.on("error", (error) => {
        reject(new CredentialStoreError(
          "无法启动 Windows 凭据系统访问进程；不会回退到明文文件。",
          "credential-store-unavailable",
          { cause: error },
        ));
      });
      child.on("close", (code) => {
        if (code === 0) {
          resolve(stdout.trim());
          return;
        }
        reject(new CredentialStoreError(
          "Windows 凭据系统操作失败；不会回退到明文文件。",
          stderr.includes("1168") ? "credential-not-found" : "credential-write-failed",
          { cause: stderr },
        ));
      });
      child.stdin.end(JSON.stringify(command));
    });
  }
}

export function createSystemCredentialStore(): CredentialStore {
  return platform() === "win32" ? new WindowsCredentialStore() : new UnavailableCredentialStore();
}
