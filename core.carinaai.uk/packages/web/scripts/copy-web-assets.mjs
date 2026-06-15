#!/usr/bin/env node
import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

mkdirSync(dist, { recursive: true });
cpSync(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });
cpSync(path.join(root, 'public'), path.join(dist, 'public'), { recursive: true });
