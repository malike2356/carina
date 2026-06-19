import type { Tool } from '../../../types/index.js';
import type { CyberToolDef } from '../../cyber-tools-registry.js';
import { createReconTool } from '../factory.js';
import { runBinary } from '../exec.js';
import { writeFile, unlink } from 'node:fs/promises';
import {
  clampInt,
  sanitizeBlockDevice,
  sanitizePath,
  sanitizeTarget,
} from '../sanitize.js';

const DEFAULT_YARA_RULES = '/opt/yara-rules';
const DEFAULT_INGEST = [
  'RecentActivity', 'HashLookup', 'FileTypeId', 'EmbeddedFileExtractor',
  'ExifParser', 'KeywordSearch', 'EmailParser', 'WebArtifacts',
];
const DEFAULT_VOL_PLUGINS = [
  'windows.info', 'windows.pslist', 'windows.netscan', 'windows.malfind',
  'windows.cmdline', 'windows.dlllist', 'windows.registry.hivelist',
];
const DEFAULT_REKALL_PLUGINS = ['pslist', 'netscan', 'malfind', 'cmdline'];

function csvList(raw: unknown, fallback: string[]): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return fallback;
}

export function parseDc3ddLog(text: string): {
  hashes: Record<string, string>;
  errors: number;
  bytes?: string;
} {
  const hashes: Record<string, string> = {};
  let errors = 0;
  for (const line of text.split('\n')) {
    const md5 = line.match(/md5\s*[:=]\s*([a-fA-F0-9]{32})/i);
    const sha1 = line.match(/sha1\s*[:=]\s*([a-fA-F0-9]{40})/i);
    const sha256 = line.match(/sha256\s*[:=]\s*([a-fA-F0-9]{64})/i);
    if (md5) hashes.md5 = md5[1]!.toLowerCase();
    if (sha1) hashes.sha1 = sha1[1]!.toLowerCase();
    if (sha256) hashes.sha256 = sha256[1]!.toLowerCase();
    const err = line.match(/(\d+)\s+error/i);
    if (err) errors = Number(err[1]);
  }
  const bytes = text.match(/(\d+)\s+bytes/i)?.[1];
  return { hashes, errors, bytes };
}

export function parseMmls(text: string): Array<{ slot: string; start: string; length: string; description: string }> {
  const rows: Array<{ slot: string; start: string; length: string; description: string }> = [];
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*(\d+:\s*\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
    if (match) {
      rows.push({
        slot: match[1]!.trim(),
        start: match[2]!,
        length: match[3]!,
        description: match[4]!.trim(),
      });
    }
  }
  return rows;
}

export function parseFls(text: string): Array<{ type: string; inode: string; name: string }> {
  const rows: Array<{ type: string; inode: string; name: string }> = [];
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*([rd/+\-]+)\s+(\d+)(?:-\d+-\d+-\d+-\d+-\d+:\d+:\d+)?\s+(.+)$/);
    if (match) {
      rows.push({ type: match[1]!, inode: match[2]!, name: match[3]!.trim() });
    }
  }
  return rows;
}

export function parseYaraOutput(text: string): Array<{ rule: string; target: string; strings: string[] }> {
  const hits: Array<{ rule: string; target: string; strings: string[] }> = [];
  let current: { rule: string; target: string; strings: string[] } | null = null;
  for (const line of text.split('\n')) {
    const header = line.match(/^(\S+)\s+(.+)$/);
    if (header && !line.startsWith('0x')) {
      if (current) hits.push(current);
      current = { rule: header[1]!, target: header[2]!.trim(), strings: [] };
      continue;
    }
    if (current && line.trim().startsWith('0x')) {
      current.strings.push(line.trim());
    }
  }
  if (current) hits.push(current);
  return hits;
}

export function parseBinwalkFindings(text: string): Array<{ offset: string; description: string }> {
  const rows: Array<{ offset: string; description: string }> = [];
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*(\d+)\s+0x[0-9a-fA-F]+\s+(.+)$/);
    if (match) rows.push({ offset: match[1]!, description: match[2]!.trim() });
  }
  return rows;
}

export function parseHashdeepSummary(text: string): { matched: number; missing: number; extra: number } {
  let matched = 0;
  let missing = 0;
  let extra = 0;
  for (const line of text.split('\n')) {
    if (/^\+/.test(line)) matched += 1;
    if (/^-/.test(line)) missing += 1;
    if (/^!/.test(line)) extra += 1;
  }
  return { matched, missing, extra };
}

async function runPluginLoop(
  binary: string,
  dump: string,
  plugins: string[],
  buildArgs: (plugin: string) => string[],
  timeoutMs: number,
): Promise<Record<string, { exitCode: number; output: string }>> {
  const results: Record<string, { exitCode: number; output: string }> = {};
  for (const plugin of plugins) {
    const result = await runBinary(binary, buildArgs(plugin), timeoutMs);
    results[plugin] = {
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    };
  }
  return results;
}

export function createAutopsyTool(def: CyberToolDef): Tool {
  return createReconTool({
    def,
    defaultTimeoutMs: 3_600_000,
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Disk image path' },
        caseName: { type: 'string', description: 'Case name' },
        caseNumber: { type: 'string', description: 'Case reference number' },
        examiner: { type: 'string', description: 'Examiner name' },
        outputDir: { type: 'string', description: 'Case output directory' },
        ingestModules: { type: 'array', description: 'Ingest module list' },
        report: { type: 'string', enum: ['html', 'pdf', 'none'], description: 'Report format' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['image', 'outputDir'],
    },
    buildArgs: (params) => {
      const image = sanitizePath(params.image);
      if (typeof image !== 'string') return image;
      const outputDir = sanitizePath(params.outputDir);
      if (typeof outputDir !== 'string') return outputDir;

      const modules = csvList(params.ingestModules, DEFAULT_INGEST).join(',');
      const caseName = String(params.caseName ?? `case_${Date.now()}`).replace(/[^\w.-]/g, '_');
      const report = String(params.report ?? 'html');

      return [
        '--createCase',
        `--caseName=${caseName}`,
        `--caseDir=${outputDir}`,
        `--caseNum=${String(params.caseNumber ?? '')}`,
        `--examiner=${String(params.examiner ?? 'Carina Forensic Agent')}`,
        `--dataSource=${image}`,
        `--ingestModules=${modules}`,
        '--generateReport',
        `--reportFormats=${report}`,
      ];
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'autopsy',
      image: String(params.image ?? ''),
      caseName: params.caseName,
      outputDir: params.outputDir,
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });
}

export function createVolatilityTool(def: CyberToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    dangerous: true,
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        dump: { type: 'string', description: 'Memory dump file' },
        image: { type: 'string', description: 'Dump file alias' },
        plugins: { type: 'array', description: 'Volatility3 plugins' },
        outputDir: { type: 'string', description: 'Extracted artifact directory' },
        dumpPids: { type: 'array', description: 'PIDs to dump' },
        timeout: { type: 'number', description: 'Max seconds per plugin' },
      },
      required: ['dump'],
    },
    execute: async (params) => {
      const dump = sanitizePath(params.dump ?? params.image);
      if (typeof dump !== 'string') return dump;

      const plugins = csvList(params.plugins, DEFAULT_VOL_PLUGINS);
      const outDir = params.outputDir
        ? sanitizePath(params.outputDir)
        : `/tmp/vol_${Date.now()}`;
      if (typeof outDir !== 'string') return outDir;

      const timeoutMs = clampInt(params.timeout, 300, 30, 7200) * 1000;
      const binary = 'vol';

      const results = await runPluginLoop(
        binary,
        dump,
        plugins,
        (plugin) => ['-f', dump, '-o', outDir, plugin],
        timeoutMs,
      );

      const pids = csvList(params.dumpPids, []);
      for (const pid of pids) {
        const pidNum = clampInt(pid, 0, 1, 65535);
        if (pidNum > 0) {
          await runBinary(binary, ['-f', dump, '-o', outDir, 'windows.dumpfiles', '--pid', String(pidNum)], timeoutMs);
        }
      }

      return {
        tool: 'volatility3',
        dump,
        outputDir: outDir,
        plugins: results,
      };
    },
  };
}

export function createDc3ddTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 86_400_000,
    parameters: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'Source block device' },
        output: { type: 'string', description: 'Output image path' },
        hash: { type: 'string', enum: ['md5', 'sha1', 'sha256', 'all'], description: 'Hash algorithms' },
        split: { type: 'number', description: 'Split size in GB' },
        log: { type: 'string', description: 'Audit log path' },
        errorLog: { type: 'string', description: 'Error log path' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['device'],
    },
    buildArgs: (params) => {
      const device = sanitizeBlockDevice(params.device);
      if (typeof device !== 'string') return device;

      const output = params.output
        ? sanitizePath(params.output)
        : `/tmp/${device.replace('/dev/', '')}_${Date.now()}.dd`;
      if (typeof output !== 'string') return output;

      const hashMode = String(params.hash ?? 'all');
      const args = [`if=${device}`, `of=${output}`, 'verb=on'];

      if (hashMode === 'all') {
        args.push('hash=md5', 'hash=sha1', 'hash=sha256');
      } else {
        args.push(`hash=${hashMode}`);
      }

      const split = params.split != null ? clampInt(params.split, 0, 1, 4096) : 0;
      if (split > 0) args.push(`split=${split}g`);

      const log = params.log
        ? sanitizePath(params.log)
        : `/tmp/dc3dd_${Date.now()}.log`;
      if (typeof log !== 'string') return log;
      args.push(`log=${log}`);

      if (params.errorLog) {
        const errlog = sanitizePath(params.errorLog);
        if (typeof errlog !== 'string') return errlog;
        args.push(`errlog=${errlog}`);
      }

      return args;
    },
    formatResult: (result, params, startedAt) => {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      return {
        tool: 'dc3dd',
        device: String(params.device ?? ''),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        ...parseDc3ddLog(output),
        output,
      };
    },
  });

  tool.needsConfirmation = () => true;
  return tool;
}

const SLEUTHKIT_ACTIONS = {
  mmls: 'mmls',
  list: 'fls',
  recover: 'tsk_recover',
  stat: 'istat',
  icat: 'icat',
} as const;

export function createSleuthkitTool(def: CyberToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    dangerous: true,
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Disk image path' },
        action: { type: 'string', enum: ['mmls', 'list', 'recover', 'timeline', 'stat', 'icat'], description: 'TSK action' },
        inode: { type: 'number', description: 'Inode number' },
        offset: { type: 'number', description: 'Partition offset sectors' },
        outputDir: { type: 'string', description: 'Recovery output directory' },
        fileType: { type: 'string', description: 'fls type filter' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['image', 'action'],
    },
    execute: async (params) => {
      const image = sanitizePath(params.image);
      if (typeof image !== 'string') return image;

      const action = String(params.action ?? 'mmls');
      const offset = params.offset != null ? clampInt(params.offset, 0, 0, Number.MAX_SAFE_INTEGER) : null;
      const offsetArgs = offset && offset > 0 ? ['-o', String(offset)] : [];
      const timeoutMs = clampInt(params.timeout, 600, 30, 7200) * 1000;

      if (action === 'timeline') {
        const bodyFile = `/tmp/body_${Date.now()}.txt`;
        const fls = await runBinary('fls', ['-r', '-m', '/', ...offsetArgs, image], timeoutMs);
        await writeFile(bodyFile, fls.stdout, 'utf8');
        const mactime = await runBinary('mactime', ['-b', bodyFile], timeoutMs);
        await unlink(bodyFile).catch(() => undefined);
        return {
          tool: 'sleuthkit',
          action,
          image,
          exitCode: mactime.exitCode,
          output: [mactime.stdout, mactime.stderr].filter(Boolean).join('\n').trim(),
          flsPreview: fls.stdout.split('\n').slice(0, 20),
        };
      }

      if (action === 'recover') {
        const outputDir = sanitizePath(params.outputDir ?? `/tmp/tsk_recover_${Date.now()}`);
        if (typeof outputDir !== 'string') return outputDir;
        const result = await runBinary('tsk_recover', [...offsetArgs, image, outputDir], timeoutMs);
        return {
          tool: 'sleuthkit',
          action,
          image,
          outputDir,
          exitCode: result.exitCode,
          output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
        };
      }

      if (action === 'stat' || action === 'icat') {
        const inode = clampInt(params.inode, 0, 1, Number.MAX_SAFE_INTEGER);
        if (inode <= 0) return { error: 'inode is required for stat/icat actions' };
        const binary = SLEUTHKIT_ACTIONS[action];
        const result = await runBinary(binary, [...offsetArgs, image, String(inode)], timeoutMs);
        return {
          tool: 'sleuthkit',
          action,
          image,
          inode,
          exitCode: result.exitCode,
          output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
        };
      }

      const binary = action === 'list' ? 'fls' : SLEUTHKIT_ACTIONS[action as keyof typeof SLEUTHKIT_ACTIONS] ?? 'mmls';
      const args = action === 'list'
        ? ['-r', '-p', ...offsetArgs, image]
        : [...offsetArgs, image];

      if (action === 'list' && params.fileType) {
        args.splice(1, 0, String(params.fileType));
      }

      const result = await runBinary(binary, args, timeoutMs);
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();

      return {
        tool: 'sleuthkit',
        action,
        image,
        exitCode: result.exitCode,
        output,
        entries: action === 'list' ? parseFls(output) : undefined,
        partitions: action === 'mmls' ? parseMmls(output) : undefined,
      };
    },
  };
}

export function createBinwalkTool(def: CyberToolDef): Tool {
  return createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Firmware or binary image' },
        extract: { type: 'boolean', description: 'Extract embedded files' },
        entropy: { type: 'boolean', description: 'Entropy graph' },
        deep: { type: 'boolean', description: 'Recursive extraction' },
        signature: { type: 'boolean', description: 'Signature scan' },
        outputDir: { type: 'string', description: 'Extraction directory' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['image'],
    },
    buildArgs: (params) => {
      const image = sanitizePath(params.image);
      if (typeof image !== 'string') return image;
      const outDir = sanitizePath(params.outputDir ?? `/tmp/binwalk_${Date.now()}`);
      if (typeof outDir !== 'string') return outDir;

      const args: string[] = [];
      if (params.extract !== false) args.push('-e');
      if (params.entropy === true) args.push('-E');
      if (params.deep === true) args.push('-M');
      if (params.signature !== false) args.push('-B');
      args.push('--directory', outDir, image);
      return args;
    },
    formatResult: (result, params, startedAt) => {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      return {
        tool: 'binwalk',
        image: String(params.image ?? ''),
        outputDir: params.outputDir,
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        findings: parseBinwalkFindings(output),
        output,
      };
    },
  });
}

export function createGhidraTool(def: CyberToolDef): Tool {
  return createReconTool({
    def,
    defaultTimeoutMs: 3_600_000,
    parameters: {
      type: 'object',
      properties: {
        binary: { type: 'string', description: 'Binary to analyze' },
        projectDir: { type: 'string', description: 'Ghidra project directory' },
        projectName: { type: 'string', description: 'Project name' },
        script: { type: 'string', description: 'Post-analysis script' },
        deleteProject: { type: 'boolean', description: 'Delete project after analysis' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['binary'],
    },
    buildArgs: (params) => {
      const binary = sanitizePath(params.binary);
      if (typeof binary !== 'string') return binary;
      const projectDir = sanitizePath(params.projectDir ?? `/tmp/ghidra_${Date.now()}`);
      if (typeof projectDir !== 'string') return projectDir;
      const projectName = String(params.projectName ?? 'carina_analysis').replace(/[^\w.-]/g, '_');

      const args = [projectDir, projectName, '-import', binary, '-overwrite'];
      if (params.deleteProject !== false) args.push('-deleteProject');

      if (params.script) {
        const script = sanitizePath(params.script);
        if (typeof script !== 'string') return script;
        const scriptDir = script.includes('/') ? script.slice(0, script.lastIndexOf('/')) : '.';
        const scriptName = script.includes('/') ? script.slice(script.lastIndexOf('/') + 1) : script;
        args.push('-scriptPath', scriptDir, '-postScript', scriptName);
      }

      return args;
    },
    resolveBinary: () => {
      const home = process.env.GHIDRA_HOME ?? '/opt/ghidra';
      return `${home}/support/analyzeHeadless`;
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'ghidra',
      binary: String(params.binary ?? ''),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });
}

export function createBulkExtractorTool(def: CyberToolDef): Tool {
  return createReconTool({
    def,
    defaultTimeoutMs: 86_400_000,
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Disk image or directory' },
        features: { type: 'array', description: 'Feature scanners' },
        outputDir: { type: 'string', description: 'Output directory' },
        threads: { type: 'number', description: 'Worker threads (0=auto)' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['image', 'outputDir'],
    },
    buildArgs: (params) => {
      const image = sanitizePath(params.image);
      if (typeof image !== 'string') return image;
      const outputDir = sanitizePath(params.outputDir);
      if (typeof outputDir !== 'string') return outputDir;

      const features = csvList(params.features, ['all']);
      const featFlag = features.includes('all') ? 'all' : features.join(',');
      const threads = clampInt(params.threads, 0, 0, 128);

      return ['-o', outputDir, '-e', featFlag, '-j', String(threads), image];
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'bulk-extractor',
      image: String(params.image ?? ''),
      outputDir: params.outputDir,
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });
}

export function createYaraTool(def: CyberToolDef): Tool {
  return createReconTool({
    def,
    defaultTimeoutMs: 3_600_000,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'File, directory, or PID' },
        rulesDir: { type: 'string', description: 'YARA rules directory or file' },
        recursive: { type: 'boolean', description: 'Recursive scan' },
        timeout: { type: 'number', description: 'Per-file timeout seconds' },
        tags: { type: 'array', description: 'Rule tag filter' },
      },
      required: ['target'],
    },
    buildArgs: (params) => {
      let scanTarget: string | { error: string };
      const asPath = sanitizePath(params.target);
      if (typeof asPath === 'string') {
        scanTarget = asPath;
      } else {
        scanTarget = sanitizeTarget(params.target);
      }
      if (typeof scanTarget !== 'string') return scanTarget;

      const rules = sanitizePath(params.rulesDir ?? DEFAULT_YARA_RULES);
      if (typeof rules !== 'string') return rules;

      const args: string[] = [];
      if (params.recursive !== false) args.push('-r');
      args.push('-s', '--timeout', String(clampInt(params.timeout, 60, 1, 3600)));

      for (const tag of csvList(params.tags, [])) {
        args.push('-t', tag);
      }

      args.push(rules, scanTarget);
      return args;
    },
    formatResult: (result, params, startedAt) => {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      return {
        tool: 'yara',
        target: String(params.target ?? ''),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        matches: parseYaraOutput(output),
        output,
      };
    },
  });
}

export function createGuymagerTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 86_400_000,
    parameters: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'Source block device' },
        output: { type: 'string', description: 'Output image path' },
        format: { type: 'string', enum: ['dd', 'e01', 'aff'], description: 'Image format' },
        caseName: { type: 'string', description: 'Case name' },
        examiner: { type: 'string', description: 'Examiner name' },
        compress: { type: 'boolean', description: 'Enable compression' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['device', 'output'],
    },
    buildArgs: (params) => {
      const device = sanitizeBlockDevice(params.device);
      if (typeof device !== 'string') return device;
      const output = sanitizePath(params.output);
      if (typeof output !== 'string') return output;

      const args = [
        '--cli',
        `--device=${device}`,
        `--output=${output}`,
        `--format=${String(params.format ?? 'e01')}`,
        `--case=${String(params.caseName ?? '')}`,
        `--examiner=${String(params.examiner ?? 'Carina Forensic Agent')}`,
        '--hash=sha256',
      ];
      if (params.compress !== false) args.push('--compress');
      return args;
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'guymager',
      device: String(params.device ?? ''),
      output: String(params.output ?? ''),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      log: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });

  tool.needsConfirmation = () => true;
  return tool;
}

export function createRekallTool(def: CyberToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    dangerous: true,
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        dump: { type: 'string', description: 'Memory dump file' },
        image: { type: 'string', description: 'Dump alias' },
        plugins: { type: 'array', description: 'Rekall plugins' },
        profile: { type: 'string', description: 'Memory profile' },
        outputDir: { type: 'string', description: 'Output directory' },
        timeout: { type: 'number', description: 'Max seconds per plugin' },
      },
      required: ['dump'],
    },
    execute: async (params) => {
      const dump = sanitizePath(params.dump ?? params.image);
      if (typeof dump !== 'string') return dump;

      const plugins = csvList(params.plugins, DEFAULT_REKALL_PLUGINS);
      const timeoutMs = clampInt(params.timeout, 300, 30, 7200) * 1000;
      const profile = params.profile ? String(params.profile).trim() : '';

      const results = await runPluginLoop(
        'rekall',
        dump,
        plugins,
        (plugin) => {
          const args = ['-f', dump];
          if (profile) args.push('--profile', profile);
          if (params.outputDir) {
            const out = sanitizePath(params.outputDir);
            if (typeof out === 'string') args.push('--output_dir', out);
          }
          args.push(plugin);
          return args;
        },
        timeoutMs,
      );

      return { tool: 'rekall', dump, plugins: results };
    },
  };
}

export function createForemostTool(def: CyberToolDef): Tool {
  return createReconTool({
    def,
    defaultTimeoutMs: 3_600_000,
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Disk image to carve' },
        types: { type: 'array', description: 'File types to carve' },
        outputDir: { type: 'string', description: 'Output directory' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['image', 'outputDir'],
    },
    buildArgs: (params) => {
      const image = sanitizePath(params.image);
      if (typeof image !== 'string') return image;
      const outputDir = sanitizePath(params.outputDir);
      if (typeof outputDir !== 'string') return outputDir;

      const types = csvList(params.types, ['all']);
      const typeFlag = types.includes('all') ? 'all' : types.join(',');
      return ['-t', typeFlag, '-i', image, '-o', outputDir];
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'foremost',
      image: String(params.image ?? ''),
      outputDir: params.outputDir,
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });
}

export function createPlasmoTool(def: CyberToolDef): Tool {
  return createReconTool({
    def,
    defaultTimeoutMs: 3_600_000,
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Evidence image or directory' },
        outputFile: { type: 'string', description: 'Plaso storage output (.plaso)' },
        parsers: { type: 'array', description: 'Parser filter list' },
        partition: { type: 'number', description: 'Partition number' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['image', 'outputFile'],
    },
    buildArgs: (params) => {
      const image = sanitizePath(params.image);
      if (typeof image !== 'string') return image;
      const outputFile = sanitizePath(params.outputFile);
      if (typeof outputFile !== 'string') return outputFile;

      const args = ['--source', image];
      if (params.partition != null) {
        args.push('--partitions', String(clampInt(params.partition, 1, 1, 128)));
      } else {
        args.push('--partitions', 'all');
      }

      const parsers = csvList(params.parsers, []);
      if (parsers.length > 0) args.push('--parsers', parsers.join(','));

      args.push('-w', outputFile);
      return args;
    },
    resolveBinary: () => 'psteal.py',
    formatResult: (result, params, startedAt) => ({
      tool: 'plasmo',
      image: String(params.image ?? ''),
      outputFile: params.outputFile,
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });
}

export function createXplicoTool(def: CyberToolDef): Tool {
  return createReconTool({
    def,
    defaultTimeoutMs: 1_800_000,
    parameters: {
      type: 'object',
      properties: {
        pcap: { type: 'string', description: 'PCAP file path' },
        image: { type: 'string', description: 'PCAP alias' },
        outputDir: { type: 'string', description: 'Decoded output directory' },
        decode: { type: 'array', description: 'Protocol decoders' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['pcap', 'outputDir'],
    },
    buildArgs: (params) => {
      const pcap = sanitizePath(params.pcap ?? params.image);
      if (typeof pcap !== 'string') return pcap;
      const outputDir = sanitizePath(params.outputDir);
      if (typeof outputDir !== 'string') return outputDir;

      return ['-m', 'pcap', '-f', pcap, '-o', outputDir];
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'xplico',
      pcap: String(params.pcap ?? params.image ?? ''),
      outputDir: params.outputDir,
      decode: csvList(params.decode, ['all']),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });
}

export function createRegripperTool(def: CyberToolDef): Tool {
  return createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        hive: { type: 'string', description: 'Registry hive file' },
        plugins: { type: 'array', description: 'RegRipper plugins' },
        outputFile: { type: 'string', description: 'Output file path' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['hive'],
    },
    buildArgs: (params) => {
      const hive = sanitizePath(params.hive);
      if (typeof hive !== 'string') return hive;

      const plugins = csvList(params.plugins, ['all']);
      const args = ['-r', hive];
      if (plugins.includes('all')) {
        args.push('-a');
      } else {
        args.push('-p', ...plugins);
      }
      return args;
    },
    resolveBinary: () => 'rip',
    formatResult: (result, params, startedAt) => ({
      tool: 'regripper',
      hive: String(params.hive ?? ''),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });
}

export function createHashdeepTool(def: CyberToolDef): Tool {
  return createReconTool({
    def,
    defaultTimeoutMs: 3_600_000,
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Directory to hash' },
        algorithm: { type: 'string', enum: ['md5', 'sha1', 'sha256'], description: 'Hash algorithm' },
        compare: { type: 'string', description: 'Known hash set file' },
        outputFile: { type: 'string', description: 'Output hash file' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['directory'],
    },
    buildArgs: (params) => {
      const directory = sanitizePath(params.directory);
      if (typeof directory !== 'string') return directory;

      const algo = String(params.algorithm ?? 'sha256');
      const args = ['-c', algo, '-r'];

      if (params.compare) {
        const compare = sanitizePath(params.compare);
        if (typeof compare !== 'string') return compare;
        args.push('-k', compare);
      }

      args.push(directory);
      return args;
    },
    formatResult: (result, params, startedAt) => {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      return {
        tool: 'hashdeep',
        directory: String(params.directory ?? ''),
        algorithm: String(params.algorithm ?? 'sha256'),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        summary: parseHashdeepSummary(output),
        output,
      };
    },
  });
}

export function createOllydbgTool(def: CyberToolDef): Tool {
  const ollyPath = process.env.OLLYDBG_PATH ?? '/opt/ollydbg/ollydbg.exe';

  const tool = createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        binary: { type: 'string', description: 'Windows PE binary to debug' },
        script: { type: 'string', description: 'ODBGScript path' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['binary'],
    },
    buildArgs: (params) => {
      const binary = sanitizePath(params.binary);
      if (typeof binary !== 'string') return binary;

      const args = [ollyPath];
      if (params.script) {
        const script = sanitizePath(params.script);
        if (typeof script !== 'string') return script;
        args.push('/r', script);
      }
      args.push(binary);
      return args;
    },
    resolveBinary: () => 'wine',
    formatResult: (result, params, startedAt) => ({
      tool: 'ollydbg',
      binary: String(params.binary ?? ''),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });

  tool.needsConfirmation = () => true;
  return tool;
}
