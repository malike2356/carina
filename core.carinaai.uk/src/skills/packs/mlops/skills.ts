import type { PackSkillInput } from '../../pack-types.js';

export const mlopsSkills: PackSkillInput[] = [
  {
    name: 'model-training',
    description: 'Train sklearn or PyTorch models on tabular or small datasets',
    trigger: ['train model', 'machine learning', 'sklearn', 'pytorch train'],
    steps: '1. Split train/val.\n2. Train with code-exec.\n3. Report metrics.\n4. Save model artifact path.',
    toolsUsed: ['code-exec'],
  },
  {
    name: 'mlflow-tracking',
    description: 'Log experiments to MLflow',
    trigger: ['mlflow', 'experiment tracking', 'log metrics'],
    steps: '1. Confirm MLFLOW_TRACKING_URI.\n2. Log params/metrics via code-exec or http-request.\n3. Return run ID.',
    toolsUsed: ['code-exec', 'http-request'],
  },
  {
    name: 'docker-ml-deploy',
    description: 'Package ML inference in Docker',
    trigger: ['docker ml', 'deploy model', 'inference container'],
    steps: '1. Draft Dockerfile.\n2. Use file-write.\n3. Build with shell-exec if allowed.',
    toolsUsed: ['file-write', 'shell-exec'],
  },
  {
    name: 'hf-model-hub',
    description: 'Search and use Hugging Face models',
    trigger: ['hugging face', 'transformers', 'hf model'],
    steps: '1. Search hub via http-request.\n2. Load model in code-exec.\n3. Run inference on sample input.',
    toolsUsed: ['http-request', 'code-exec'],
  },
  {
    name: 'dataset-versioning',
    description: 'Version datasets with DVC or git-lfs patterns',
    trigger: ['dvc', 'dataset version', 'data versioning'],
    steps: '1. Check for dvc config.\n2. Propose dvc add/push workflow.\n3. Document in README snippet.',
    toolsUsed: ['shell-exec', 'file-read'],
  },
  {
    name: 'model-evaluation',
    description: 'Evaluate classifier/regressor metrics and confusion matrices',
    trigger: ['model evaluation', 'confusion matrix', 'f1 score', 'roc auc'],
    steps: '1. Load predictions and labels.\n2. Compute metrics in code-exec.\n3. Summarize strengths and failure modes.',
    toolsUsed: ['code-exec'],
  },
];
