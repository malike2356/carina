import { config } from '../../../config/index.js';
import { MetaGraphAdapter } from './meta-graph-base.js';

export class InstagramAdapter extends MetaGraphAdapter {
  constructor(
    enabled: boolean,
    accessToken = config.instagram.accessToken,
    verifyToken = config.instagram.verifyToken,
    appSecret = config.instagram.appSecret,
  ) {
    super(enabled, {
      channel: 'instagram',
      accessToken,
      verifyToken,
      appSecret,
    });
  }
}
