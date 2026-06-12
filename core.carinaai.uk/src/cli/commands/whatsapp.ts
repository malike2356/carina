import chalk from 'chalk';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

export async function runWhatsAppCommand(action = 'setup'): Promise<void> {
  if (action === 'setup') {
    const home = process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina');
    const envPath = path.join(home, '.env');
    let env = '';
    try {
      env = await fs.readFile(envPath, 'utf8');
    } catch {
      // new
    }
    if (!env.includes('BAILEYS_WHATSAPP_ENABLED')) {
      await fs.mkdir(home, { recursive: true });
      await fs.appendFile(envPath, '\nBAILEYS_WHATSAPP_ENABLED=true\nBAILEYS_QR_TERMINAL=true\n');
    }
    process.env.BAILEYS_WHATSAPP_ENABLED = 'true';
    process.env.BAILEYS_QR_TERMINAL = 'true';
    process.env.SKIP_CLI = 'true';
    process.env.WEB_ENABLED = 'false';

    console.log(chalk.bold('\nWhatsApp pairing\n'));
    console.log('Scan the QR code below with WhatsApp > Linked Devices > Link a Device\n');
    const { startBaileysWhatsApp } = await import('../../gateway/baileys/whatsapp-baileys.js');
    await startBaileysWhatsApp();
    console.log(chalk.green('\nWhatsApp linked. Keep this process running or start with: carina web\n'));
    return;
  }

  if (action === 'status') {
    const authDir = path.join(process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina'), 'baileys-auth');
    const { whatsappBridgeMode, whatsappSelfBridgeEnabled } = await import('../../gateway/channels/channel-status.js');
    const mode = whatsappBridgeMode();
    console.log(chalk.bold('\nWhatsApp bridge status\n'));
    console.log(`  transport: ${mode}`);
    console.log(`  self-bridge: ${whatsappSelfBridgeEnabled() ? 'ON (operator opt-in)' : 'off'}`);
    try {
      await fs.access(authDir);
      console.log(chalk.green(`  auth: present (${authDir})`));
    } catch {
      console.log(chalk.yellow('  auth: not paired'));
    }
    if (mode === 'none') {
      console.log(chalk.gray('\nEnable: BAILEYS_WHATSAPP_ENABLED=true  or configure Twilio vars'));
      console.log('Run: carina whatsapp setup\n');
    }
    return;
  }

  console.error('Usage: carina whatsapp <setup|status>');
  process.exit(1);
}
