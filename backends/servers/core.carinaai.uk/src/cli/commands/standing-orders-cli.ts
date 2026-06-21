import chalk from 'chalk';
import {
  getStandingOrdersStore,
  standingOrdersEnabled,
} from '../../agents/standing-orders-store.js';

export async function runStandingOrdersCommand(args: string[]): Promise<void> {
  if (!standingOrdersEnabled()) {
    console.error('Standing orders disabled. Set CARINA_STANDING_ORDERS_ENABLED=true.');
    process.exit(1);
  }

  const action = args[0] ?? 'list';
  const store = getStandingOrdersStore();
  const agentFlag = args.indexOf('--agent');
  const agentId = agentFlag >= 0 ? args[agentFlag + 1] ?? '*' : '*';

  if (action === 'add') {
    const directive = args.slice(1).filter((a) => a !== '--agent' && a !== agentId).join(' ').trim();
    if (!directive) {
      console.error('Usage: carina standing-orders add <directive> [--agent <id>]');
      process.exit(1);
    }
    const order = await store.add({
      agentId,
      directive,
      priority: 0,
      enabled: true,
      source: 'user',
    });
    console.log(chalk.green(`Added ${order.id.slice(0, 8)}`));
    return;
  }

  if (action === 'list') {
    const orders = await store.list(agentId);
    if (args.includes('--json')) {
      console.log(JSON.stringify(orders, null, 2));
      return;
    }
    for (const order of orders) {
      console.log(`[${order.id.slice(0, 8)}] ${order.enabled ? 'on' : 'off'} ${order.directive}`);
    }
    return;
  }

  if (action === 'remove') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina standing-orders remove <id>');
      process.exit(1);
    }
    console.log(await store.remove(id) ? chalk.green('Removed') : chalk.yellow('Not found'));
    return;
  }

  if (action === 'toggle') {
    const id = args[1];
    const order = id ? await store.get(id) : null;
    if (!order) {
      console.error('Order not found');
      process.exit(1);
    }
    await store.update(id, { enabled: !order.enabled });
    console.log(chalk.green('Toggled'));
    return;
  }

  if (action === 'cleanup') {
    const removed = await store.cleanupExpired();
    console.log(chalk.green(`Removed ${removed} expired order(s)`));
    return;
  }

  console.error('Usage: carina standing-orders <add|list|remove|toggle|cleanup>');
  process.exit(1);
}
