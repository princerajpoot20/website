const core = require('@actions/core');
const htmlContent = require('./htmlContent.js');

const KIT_API_BASE = 'https://api.kit.com/v4';

/**
 * Sends a Kit.com broadcast to TSC Voting subscribers.
 * Input is the URL to the issue/discussion/PR and its title.
 */
module.exports = async (link, title) => {
  const apiKey = process.env.KIT_API_KEY;

  if (!apiKey) {
    return core.setFailed('KIT_API_KEY environment variable is not set');
  }

  const tscVotingTagId = parseInt(process.env.KIT_TAG_ID_TSC_VOTING, 10);

  if (!tscVotingTagId) {
    return core.setFailed('KIT_TAG_ID_TSC_VOTING environment variable is not set or invalid');
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Kit-Api-Key': apiKey
  };

  const scheduleDate = new Date(Date.now() + 60 * 60 * 1000);
  scheduleDate.setUTCMinutes(0, 0, 0);

  try {
    const response = await fetch(`${KIT_API_BASE}/broadcasts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subject: `TSC attention required: ${title}`,
        content: htmlContent(link, title),
        description: `New topic info - ${new Date().toUTCString()}`,
        public: false,
        published_at: new Date().toISOString(),
        send_at: scheduleDate.toISOString(),
        preview_text: 'Check out the latest topic that TSC members have to be aware of',
        subscriber_filter: [
          {
            all: [{ type: 'tag', ids: [tscVotingTagId] }],
            any: null,
            none: null
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();

      return core.setFailed(`Failed creating broadcast: ${JSON.stringify(error)}`);
    }

    core.info('New email broadcast created and scheduled');
  } catch (error) {
    return core.setFailed(`Failed creating broadcast: ${error.message || JSON.stringify(error)}`);
  }
};
