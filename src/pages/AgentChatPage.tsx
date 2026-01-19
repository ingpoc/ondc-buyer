import { AgentChat } from '@ondc-sdk/shared/design-system';
import { PageLayout, PageHeader, DRAMS, SPACING, TYPOGRAPHY } from '@ondc-sdk/shared/design-system';

export function AgentChatPage(): JSX.Element {
  return (
    <PageLayout>
      <PageHeader
        title="Buyer Agent Assistant"
        subtitle="Chat with the AI agent to search products, compare options, and get personalized recommendations."
      />
      <AgentChat
        endpoint="/api/agent/buyer"
        title="Buyer Agent"
        placeholder="e.g., Find organic mangoes under ₹500"
      />
    </PageLayout>
  );
}
