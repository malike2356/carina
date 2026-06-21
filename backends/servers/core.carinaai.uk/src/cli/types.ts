export type CliHandler = (args: string[]) => Promise<void>;

export type CliCommand = {
  name: string;
  summary: string;
  usage?: string;
  aliases?: string[];
  subcommands?: Record<string, CliCommand>;
  handler?: CliHandler;
  loadEnv?: boolean;
};

export type PackageInfo = {
  name: string;
  version: string;
};
