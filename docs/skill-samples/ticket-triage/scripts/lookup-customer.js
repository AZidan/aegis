/**
 * Looks up customer context from routing rules data.
 *
 * This script receives `input.customer` and `input.routing_rules`
 * and returns enrichment data about the customer.
 *
 * Runs in a sandboxed environment — no network access, no filesystem
 * outside the skill package, no process/child_process.
 */
module.exports = async function lookupCustomer(input) {
  const { customer, routing_rules } = input;

  if (!customer) {
    return {
      tier: 'unknown',
      recent_tickets: 0,
      notes: 'No customer identifier provided',
    };
  }

  // Check if customer exists in the VIP list from routing rules
  const vipList = routing_rules
    .filter(r => r.vip_customers)
    .flatMap(r => r.vip_customers);

  const isVip = vipList.some(
    vip => vip.toLowerCase() === customer.toLowerCase(),
  );

  return {
    tier: isVip ? 'enterprise' : 'standard',
    recent_tickets: 0, // Would be enriched by platform in production
    notes: isVip ? 'VIP customer — expedite handling' : null,
  };
};
