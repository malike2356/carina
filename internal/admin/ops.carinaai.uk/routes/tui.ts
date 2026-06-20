import { Router } from 'express';
import { issueWsToken } from '../lib/ws-tokens.js';

export const tuiRouter = Router();

tuiRouter.get('/', (req, res) => {
  const wsToken = issueWsToken();
  res.render('tui', {
    title: 'Carina TUI',
    wsToken,
    layout: false,
  });
});
