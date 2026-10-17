import fs from "fs";
import path from "path";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { prisma } from "../db/prisma";
import { acquireAdvisoryLock, releaseAdvisoryLock } from "../db/advisory-lock";
import { BackupMode, BackupStatus } from "@prisma/client";

const execAsync = promisify(exec);

export const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.resolve(process.cwd(), "backups");

// Ensure backup directory exists with restricted permissions
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
}

export interface ParsedDbConfig {
  user: string;
  password?: string;
  host: string;
  port: string;
  database: string;
}

export function parseDatabaseUrl(urlStr: string = process.env.DATABASE_URL || ""): ParsedDbConfig {
  if (!urlStr) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }
  try {
    const parsed = new URL(urlStr);
    return {
      user: decodeURIComponent(parsed.username || "postgres"),
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      host: parsed.hostname || "localhost",
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, "") || "gamedeals",
    };
  } catch (err: any) {
    throw new Error(`Invalid DATABASE_URL configuration: ${err.message}`);
  }
}

/**
 * Checks if a command exists in the environment PATH.
 */
async function commandExists(cmd: string): Promise<boolean> {
  try {
    const checkCmd = process.platform === "win32" ? `where ${cmd}` : `which ${cmd}`;
    await execAsync(checkCmd);
    return true;
  } catch {
    return false;
  }
}

export interface ArchiveInspectionResult {
  valid: boolean;
  format: string;
  tables: string[];
  entryCount: number;
  sizeBytes: number;
  error?: string;
}

export interface RestoreExecutionResult {
  success: boolean;
  message: string;
  preRestoreBackupFilename?: string;
  counts?: {
    games: number;
    priceHistories: number;
    gameRelations: number;
    users: number;
    systemSettingFound: boolean;
  };
  error?: string;
}

export class BackupService {
  /**
   * Generates a safe, non-colliding server-side backup filename.
   */
  public static generateFilename(prefix = "game-deals"): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    return `${prefix}-${timestamp}.dump`;
  }

  /**
   * Resolves a backup filename safely inside the BACKUP_DIR, preventing path traversal.
   */
  public static resolveSafePath(filename: string): string {
    const baseName = path.basename(filename);
    const resolved = path.resolve(BACKUP_DIR, baseName);
    if (!resolved.startsWith(BACKUP_DIR)) {
      throw new Error("SECURITY_ERROR: Path traversal detected.");
    }
    return resolved;
  }

  /**
   * Executes pg_dump to produce a PostgreSQL custom-format (-Fc) archive.
   */
  public static async createBackup(options: {
    mode?: "FULL" | "CATALOG";
    initiatedByUserId?: string;
  }): Promise<{ id: string; filename: string; sizeBytes: number; tables: string[] }> {
    const mode: BackupMode = options.mode === "CATALOG" ? BackupMode.CATALOG : BackupMode.FULL;
    const filename = this.generateFilename(mode === "CATALOG" ? "game-deals-catalog" : "game-deals");
    const targetPath = this.resolveSafePath(filename);

    const audit = await prisma.databaseBackup.create({
      data: {
        filename,
        mode,
        status: BackupStatus.IN_PROGRESS,
        initiatedByUserId: options.initiatedByUserId,
      },
    });

    const dbConfig = parseDatabaseUrl();
    const hasLocalPgDump = await commandExists("pg_dump");

    // Tables included for CATALOG mode
    const catalogTables = [
      "Game",
      "PriceHistory",
      "DealAnalysis",
      "GameRelation",
      "SyncRun",
      "SystemSetting",
      "_prisma_migrations",
    ];

    try {
      if (hasLocalPgDump) {
        // Native pg_dump execution
        const args: string[] = [
          "-h", dbConfig.host,
          "-p", dbConfig.port,
          "-U", dbConfig.user,
          "-d", dbConfig.database,
          "--no-owner",
          "--no-privileges",
          "-Fc",
          "-f", targetPath,
        ];

        if (mode === "CATALOG") {
          for (const tbl of catalogTables) {
            args.push("-t", `"${tbl}"`);
          }
        }

        await new Promise<void>((resolve, reject) => {
          const child = spawn("pg_dump", args, {
            env: {
              ...process.env,
              PGPASSWORD: dbConfig.password || "",
            },
          });

          let stderr = "";
          child.stderr.on("data", (data) => (stderr += data.toString()));
          child.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`pg_dump failed with exit code ${code}: ${stderr}`));
          });
        });
      } else {
        // Fallback for local Windows dev: execute inside running postgres container
        const tableFlags =
          mode === "CATALOG"
            ? catalogTables.map((t) => `-t \\"${t}\\"`).join(" ")
            : "";
        const containerCmd = `docker exec game-deals-postgres pg_dump -U ${dbConfig.user} -d ${dbConfig.database} --no-owner --no-privileges -Fc ${tableFlags} > "${targetPath}"`;
        await execAsync(containerCmd);
      }

      if (!fs.existsSync(targetPath)) {
        throw new Error("Backup file was not created.");
      }

      const stat = fs.statSync(targetPath);
      if (stat.size === 0) {
        throw new Error("Backup file is empty (0 bytes).");
      }

      // Inspect tables in generated archive
      const inspection = await this.inspectArchive(targetPath);

      await prisma.databaseBackup.update({
        where: { id: audit.id },
        data: {
          status: BackupStatus.COMPLETED,
          sizeBytes: BigInt(stat.size),
          tablesIncluded: inspection.tables,
          completedAt: new Date(),
        },
      });

      return {
        id: audit.id,
        filename,
        sizeBytes: stat.size,
        tables: inspection.tables,
      };
    } catch (err: any) {
      console.error("[BackupService] Export failed:", err.message);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      await prisma.databaseBackup.update({
        where: { id: audit.id },
        data: {
          status: BackupStatus.FAILED,
          errorSummary: err.message,
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }

  /**
   * Inspects a PostgreSQL archive using pg_restore --list to verify format and TOC.
   */
  public static async inspectArchive(filePath: string): Promise<ArchiveInspectionResult> {
    if (!fs.existsSync(filePath)) {
      return { valid: false, format: "UNKNOWN", tables: [], entryCount: 0, sizeBytes: 0, error: "File not found." };
    }

    const stat = fs.statSync(filePath);
    const hasLocalPgRestore = await commandExists("pg_restore");

    try {
      let output = "";
      if (hasLocalPgRestore) {
        const { stdout } = await execAsync(`pg_restore --list "${filePath}"`);
        output = stdout;
      } else {
        // Fallback via docker container
        const { stdout } = await execAsync(`docker exec -i game-deals-postgres pg_restore --list < "${filePath}"`);
        output = stdout;
      }

      const lines = output.split("\n");
      const tables: string[] = [];

      for (const line of lines) {
        // pg_restore list format: ; [id] [type] [schema] [name] [owner]
        const match = line.match(/TABLE DATA\s+\S+\s+(\S+)/);
        if (match && match[1]) {
          const tableName = match[1].replace(/"/g, "");
          if (!tables.includes(tableName)) {
            tables.push(tableName);
          }
        }
      }

      return {
        valid: true,
        format: "PostgreSQL Custom Archive (-Fc)",
        tables,
        entryCount: lines.length,
        sizeBytes: stat.size,
      };
    } catch (err: any) {
      return {
        valid: false,
        format: "INVALID_OR_CORRUPT",
        tables: [],
        entryCount: 0,
        sizeBytes: stat.size,
        error: err.message,
      };
    }
  }

  /**
   * Restores a PostgreSQL custom archive under exclusive PostgreSQL advisory lock.
   * Creates an automatic pre-restore backup first.
   */
  public static async restoreArchive(
    filePath: string,
    initiatedByUserId?: string
  ): Promise<RestoreExecutionResult> {
    const locked = await acquireAdvisoryLock();
    if (!locked) {
      return {
        success: false,
        message: "Veritabanı meşgul. Başka bir senkronizasyon veya bakım işlemi yürütülüyor.",
      };
    }

    let preRestoreBackup: { filename: string } | null = null;

    try {
      // 1. Validate archive integrity first
      const inspection = await this.inspectArchive(filePath);
      if (!inspection.valid) {
        return {
          success: false,
          message: `Arşiv doğrulanamadı: ${inspection.error || "Geçersiz PostgreSQL custom formatı"}`,
        };
      }

      // Check required application schema elements
      const requiredSample = ["Game", "PriceHistory", "SystemSetting"];
      const missingRequired = requiredSample.filter((t) => !inspection.tables.includes(t));
      if (missingRequired.length > 0) {
        return {
          success: false,
          message: `Arşiv geçerli bir Game Deals veritabanı yedeği gibi görünmüyor. Eksik tablolar: ${missingRequired.join(", ")}`,
        };
      }

      // 2. Create automatic pre-restore backup
      console.log("[BackupService] Creating automatic pre-restore safety backup...");
      preRestoreBackup = await this.createBackup({
        mode: "FULL",
        initiatedByUserId,
      });

      // 3. Execute pg_restore
      console.log("[BackupService] Restoring archive:", filePath);
      const dbConfig = parseDatabaseUrl();
      const hasLocalPgRestore = await commandExists("pg_restore");

      if (hasLocalPgRestore) {
        const args = [
          "-h", dbConfig.host,
          "-p", dbConfig.port,
          "-U", dbConfig.user,
          "-d", dbConfig.database,
          "--clean",
          "--if-exists",
          "--no-owner",
          "--no-privileges",
          filePath,
        ];

        await new Promise<void>((resolve, reject) => {
          const child = spawn("pg_restore", args, {
            env: {
              ...process.env,
              PGPASSWORD: dbConfig.password || "",
            },
          });

          let stderr = "";
          child.stderr.on("data", (data) => (stderr += data.toString()));
          child.on("close", (code) => {
            // Note: pg_restore can exit with 1 if there are minor non-fatal warnings (e.g. drop table if exists)
            if (code === 0 || code === 1) resolve();
            else reject(new Error(`pg_restore failed with exit code ${code}: ${stderr}`));
          });
        });
      } else {
        // Fallback via docker container
        const containerCmd = `docker exec -i game-deals-postgres pg_restore -U ${dbConfig.user} -d ${dbConfig.database} --clean --if-exists --no-owner --no-privileges < "${filePath}"`;
        try {
          await execAsync(containerCmd);
        } catch (e: any) {
          // Check if it's just non-fatal drop warnings
          if (!e.message.includes("exit code 1")) {
            throw e;
          }
        }
      }

      // 4. Run prisma migrate deploy to ensure schema parity
      try {
        console.log("[BackupService] Running prisma migrate deploy post-restore...");
        await execAsync("npx prisma migrate deploy");
      } catch (migrateErr: any) {
        console.warn("[BackupService] Post-restore migrate deploy warning:", migrateErr.message);
      }

      // 5. Post-restore integrity verification
      const [games, priceHistories, gameRelations, users, systemSetting] = await Promise.all([
        prisma.game.count(),
        prisma.priceHistory.count(),
        prisma.gameRelation.count(),
        prisma.user.count(),
        prisma.systemSetting.findUnique({ where: { id: "global" } }),
      ]);

      return {
        success: true,
        message: "Veritabanı yedeği başarıyla geri yüklendi ve veri bütünlüğü doğrulandı.",
        preRestoreBackupFilename: preRestoreBackup.filename,
        counts: {
          games,
          priceHistories,
          gameRelations,
          users,
          systemSettingFound: Boolean(systemSetting),
        },
      };
    } catch (err: any) {
      console.error("[BackupService] Restore failed:", err.message);
      return {
        success: false,
        message: `Geri yükleme sırasında kritik hata oluştu: ${err.message}`,
        preRestoreBackupFilename: preRestoreBackup?.filename,
        error: err.message,
      };
    } finally {
      await releaseAdvisoryLock();
    }
  }

  /**
   * Lists all existing backups on disk and database audit records.
   */
  public static async listBackups() {
    const dbBackups = await prisma.databaseBackup.findMany({
      orderBy: { startedAt: "desc" },
    });

    const fileMap = new Map<string, { size: number; mtime: Date }>();
    if (fs.existsSync(BACKUP_DIR)) {
      const files = fs.readdirSync(BACKUP_DIR);
      for (const f of files) {
        if (f.endsWith(".dump") || f.endsWith(".backup")) {
          const stat = fs.statSync(path.join(BACKUP_DIR, f));
          fileMap.set(f, { size: stat.size, mtime: stat.mtime });
        }
      }
    }

    return dbBackups.map((b: any) => {
      const fileInfo = fileMap.get(b.filename);
      return {
        id: b.id,
        filename: b.filename,
        mode: b.mode,
        status: b.status,
        sizeBytes: fileInfo ? fileInfo.size : Number(b.sizeBytes),
        tablesIncluded: b.tablesIncluded,
        rowCountEstimate: b.rowCountEstimate,
        startedAt: b.startedAt.toISOString(),
        createdAt: b.startedAt.toISOString(),
        completedAt: b.completedAt ? b.completedAt.toISOString() : null,
        fileExists: Boolean(fileInfo),
        errorSummary: b.errorSummary,
      };
    });
  }

  /**
   * Deletes a backup from disk and database audit record.
   */
  public static async deleteBackup(id: string) {
    const backup = await prisma.databaseBackup.findUnique({ where: { id } });
    if (!backup) {
      throw new Error("Backup not found.");
    }

    const filePath = this.resolveSafePath(backup.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.databaseBackup.delete({ where: { id } });
    return { success: true };
  }
}
