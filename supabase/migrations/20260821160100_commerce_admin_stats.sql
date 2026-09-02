-- Admin aggregate helpers for customer / guest lists (service_role only).

create or replace function private.admin_order_stats_for_users(p_user_ids uuid[])
returns table (
  customer_user_id uuid,
  order_count bigint,
  total_spend_minor bigint,
  last_order_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.customer_user_id,
    count(*)::bigint as order_count,
    coalesce(
      sum(o.total_minor) filter (
        where o.payment_status = 'paid' and o.order_status <> 'cancelled'
      ),
      0
    )::bigint as total_spend_minor,
    max(o.placed_at) as last_order_at
  from public.orders o
  where o.customer_user_id = any (p_user_ids)
  group by o.customer_user_id;
$$;

create or replace function private.admin_order_stats_for_guests(p_guest_ids uuid[])
returns table (
  guest_purchaser_id uuid,
  order_count bigint,
  total_spend_minor bigint,
  first_order_at timestamptz,
  last_order_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.guest_purchaser_id,
    count(*)::bigint as order_count,
    coalesce(
      sum(o.total_minor) filter (
        where o.payment_status = 'paid' and o.order_status <> 'cancelled'
      ),
      0
    )::bigint as total_spend_minor,
    min(o.placed_at) as first_order_at,
    max(o.placed_at) as last_order_at
  from public.orders o
  where o.guest_purchaser_id = any (p_guest_ids)
    and o.customer_user_id is null
  group by o.guest_purchaser_id;
$$;

revoke all on function private.admin_order_stats_for_users(uuid[]) from public;
revoke all on function private.admin_order_stats_for_guests(uuid[]) from public;
grant execute on function private.admin_order_stats_for_users(uuid[]) to service_role;
grant execute on function private.admin_order_stats_for_guests(uuid[]) to service_role;
