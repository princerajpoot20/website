/**
 * Returns the HTML body content for TSC notification emails.
 * Kit.com wraps this in its own email template which handles
 * layout, header, footer, and unsubscribe links automatically.
 *
 * Personalization uses Liquid syntax: {{ subscriber.first_name }}
 */
module.exports = (link, title) => {
  return `<p>Hey {{ subscriber.first_name }},</p>
<p>There is a new topic at AsyncAPI Initiative that requires Technical Steering Committee attention.</p>
<p>Please have a look if it is just something you need to be aware of, or maybe your vote is needed.</p>
<p>Topic: <a href="${link}">${title}</a>.</p>
<p>Cheers,<br>AsyncAPI Initiative</p>`;
};
