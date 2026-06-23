import { config } from '../../../config/index.js';
import { MetaGraphAdapter } from './meta-graph-base.js';

export class MessengerAdapter extends MetaGraphAdapter {
  constructor(
    enabled: boolean,
    pageAccessToken = config.messenger.pageAccessToken,
    verifyToken = config.messenger.verifyToken,
    appSecret = config.messenger.appSecret,
  ) {
    super(enabled, {
      channel: 'messenger',
      accessToken: pageAccessToken,
      verifyToken,
      appSecret,
    });
  }
}
