import { $billingSessions, $commitments, $killSwitchActive, $killSwitchReason, $learningMetrics, $orchestrationAgents, $plan, $scoutConnected, $scoutUrl, $securityEvents, $systemHealth, $trustScore, $usageThisPeriod, $workspaces, $activeWorkspace, } from '../store/carina.js';
import { $gatewayStatus } from '../store/connection.js';
import { getBillingPlan, getBillingSessions, getBillingUsage, getCommitments, getKillSwitchStatus, getLearningMetrics, getOrchestrationAgents, getSecurityEvents, getSystemHealth, getTrustScore, getWorkspaces, } from './gateway-client.js';
let started = false;
const timers = [];
function clearTimers() {
    while (timers.length > 0) {
        const timer = timers.pop();
        if (timer)
            clearInterval(timer);
    }
}
function resetAtoms() {
    $trustScore.set(0);
    $securityEvents.set([]);
    $killSwitchActive.set(false);
    $killSwitchReason.set('');
    $plan.set(null);
    $usageThisPeriod.set(null);
    $billingSessions.set([]);
    $workspaces.set([]);
    $activeWorkspace.set(null);
    $commitments.set([]);
    $learningMetrics.set(null);
    $systemHealth.set(null);
    $orchestrationAgents.set([]);
    $scoutConnected.set(false);
    $scoutUrl.set(null);
}
async function pollSecurity() {
    const [trust, events, killSwitch] = await Promise.all([
        getTrustScore(),
        getSecurityEvents(5),
        getKillSwitchStatus(),
    ]);
    $trustScore.set(trust.score);
    $scoutConnected.set(trust.scoutConnected);
    $scoutUrl.set(trust.scoutUrl);
    $securityEvents.set(events);
    $killSwitchActive.set(killSwitch.active);
    $killSwitchReason.set(killSwitch.reason);
}
async function pollBilling() {
    const [plan, usage, sessions] = await Promise.all([
        getBillingPlan(),
        getBillingUsage(),
        getBillingSessions(5),
    ]);
    $plan.set(plan);
    $usageThisPeriod.set(usage);
    $billingSessions.set(sessions);
}
async function pollWorkspaces() {
    const data = await getWorkspaces();
    $workspaces.set(data.workspaces);
    $activeWorkspace.set(data.workspaces.find((workspace) => workspace.id === data.activeId) ?? data.workspaces[0] ?? null);
}
async function pollOperator() {
    const [commitments, learning, health, agents] = await Promise.all([
        getCommitments(),
        getLearningMetrics(),
        getSystemHealth(),
        getOrchestrationAgents(),
    ]);
    $commitments.set(commitments);
    $learningMetrics.set(learning);
    $systemHealth.set(health);
    $orchestrationAgents.set(agents);
}
export function startCarinaPolling() {
    if (started)
        return stopCarinaPolling;
    started = true;
    const tickSecurity = () => {
        if ($gatewayStatus.get() !== 'ok')
            return;
        void pollSecurity();
    };
    const tickBilling = () => {
        if ($gatewayStatus.get() !== 'ok')
            return;
        void pollBilling();
    };
    const tickWorkspaces = () => {
        if ($gatewayStatus.get() !== 'ok')
            return;
        void pollWorkspaces();
    };
    const tickOperator = () => {
        if ($gatewayStatus.get() !== 'ok')
            return;
        void pollOperator();
    };
    tickSecurity();
    tickBilling();
    tickWorkspaces();
    tickOperator();
    timers.push(setInterval(tickSecurity, 10_000));
    timers.push(setInterval(() => void getKillSwitchStatus().then((status) => {
        $killSwitchActive.set(status.active);
        $killSwitchReason.set(status.reason);
    }), 5_000));
    timers.push(setInterval(tickBilling, 30_000));
    timers.push(setInterval(tickWorkspaces, 20_000));
    timers.push(setInterval(tickOperator, 15_000));
    const unsubscribe = $gatewayStatus.subscribe((status) => {
        if (status !== 'ok')
            resetAtoms();
        else {
            void pollSecurity();
            void pollBilling();
            void pollWorkspaces();
            void pollOperator();
        }
    });
    return () => {
        unsubscribe();
        stopCarinaPolling();
    };
}
export function stopCarinaPolling() {
    started = false;
    clearTimers();
}
