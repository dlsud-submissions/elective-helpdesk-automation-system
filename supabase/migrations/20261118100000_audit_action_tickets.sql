-- Tickets created or escalated through POST /api/actions/execute are written
-- by the create_helpdesk_ticket / create_helpdesk_escalation RPCs, which only
-- record automation_runs. Agents read ticket history from audit_logs, so those
-- tickets showed an empty history. This trigger adds the matching audit row.
--
-- It fires on automation_runs instead of tickets because POST /api/tickets
-- already writes its own ticket.created audit row from the API. An idempotent
-- replay inserts no automation_runs row, so it adds no duplicate audit row.

create or replace function public.audit_automation_ticket_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    actor_id, action, resource_type, resource_id, outcome, summary
  ) values (
    new.actor_id,
    case new.action_type
      when 'escalate_to_human' then 'ticket.escalated'
      else 'ticket.created'
    end,
    'ticket',
    new.ticket_id::text,
    'success',
    case new.action_type
      when 'escalate_to_human' then 'Escalated to a human agent from chat.'
      else 'Ticket created from chat.'
    end
  );
  return new;
end;
$$;

revoke all on function public.audit_automation_ticket_run() from public, anon, authenticated;

drop trigger if exists automation_runs_audit_ticket on public.automation_runs;
create trigger automation_runs_audit_ticket
  after insert on public.automation_runs
  for each row
  when (
    new.ticket_id is not null
    and new.status = 'succeeded'
    and new.action_type in ('create_ticket', 'escalate_to_human')
  )
  execute function public.audit_automation_ticket_run();
