import {
  COMMAND_CENTER_CONTRACT_AREAS,
  getCommandCenterContractSummary,
  renderCommandCenterContractTable,
} from '../contracts/command-center-contract.js';

export { COMMAND_CENTER_CONTRACT_AREAS, getCommandCenterContractSummary, renderCommandCenterContractTable };

export function getCommandCenterContractReport(): string {
  return renderCommandCenterContractTable(COMMAND_CENTER_CONTRACT_AREAS);
}
