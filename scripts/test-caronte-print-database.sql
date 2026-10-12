-- Prepared integration assertions, NOT part of the local Node pass count.
-- Run only against an approved disposable/migrated PostgreSQL environment.
-- Synthetic rows and all mutations roll back. Does not create or submit orders.
begin;
do $$
declare sid uuid;mid uuid;j public.future_book_print_jobs;same public.future_book_print_jobs;
  lease public.future_book_print_jobs;replacement public.future_book_print_jobs;revision timestamptz;
  source jsonb:=jsonb_build_object('prompt_version','caronte-literary-v2','title','Synthetic SQL contract only','sections',
    (select jsonb_agg(jsonb_build_object('kind','chapter','title','Synthetic','paragraphs',jsonb_build_array('Synthetic SQL only')))
      from generate_series(1,5)));
  caught boolean;receipt jsonb;completed_snapshot jsonb;intent_snapshot jsonb;
begin
  if has_table_privilege('anon','public.future_book_print_jobs','SELECT')
    or has_table_privilege('authenticated','public.future_book_print_steps','INSERT')
    or has_function_privilege('anon','public.caronte_claim_print_job(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.caronte_control_print_job(uuid,text,text,text,jsonb)','EXECUTE')
    then raise exception 'test_failed_private_print_access';end if;
  insert into public.future_book_sessions(status,question_count,source,metadata)
    values('book_ready',1,'caronte_print_database_test','{"synthetic":true}') returning id into sid;
  insert into public.future_book_manuscripts(session_id,status,title,manuscript,quality_report,provider_chain)
    values(sid,'ready','Synthetic SQL contract only',source,'{"editorial_gate":"pass"}','{"degraded":false}')
    returning id,updated_at into mid,revision;
  j:=public.caronte_enqueue_print(sid,mid,revision,source,repeat('a',64),repeat('b',64),
    'caronte-a5-chunks-v1','sandbox',repeat('c',64),'0583X0827.BW.STD.PB.060UC444.MXX');
  same:=public.caronte_enqueue_print(sid,mid,revision,source,repeat('a',64),repeat('b',64),
    'caronte-a5-chunks-v1','sandbox',repeat('c',64),'0583X0827.BW.STD.PB.060UC444.MXX');
  if j.id<>same.id or j.pdf_id<>same.pdf_id or j.version<>same.version then raise exception 'test_failed_print_reservation';end if;
  if not exists(select 1 from public.future_book_sessions where id=sid and status='pdf_generating'
    and pdf_review_status='not_generated') then raise exception 'test_failed_print_session_checkpoint';end if;
  lease:=public.caronte_claim_print_job(j.id);same:=public.caronte_claim_print_job(j.id);
  if lease.lease_token is null or same.id is not null then raise exception 'test_failed_print_exclusive_claim';end if;
  receipt:=jsonb_build_object('step_key','plan:0:12','stage','plan','status','started','attempt',1,'input_hash',repeat('d',64));
  caught:=false;
  begin perform public.caronte_checkpoint_print_job(j.id,gen_random_uuid(),receipt,'running');
  exception when others then if sqlerrm='lease_lost' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_print_stale_lease';end if;
  perform public.caronte_checkpoint_print_job(j.id,lease.lease_token,receipt,'running');
  receipt:=receipt||jsonb_build_object('status','completed','output',jsonb_build_object('synthetic',true),'output_hash',repeat('e',64));
  perform public.caronte_checkpoint_print_job(j.id,lease.lease_token,receipt,'running');
  caught:=false;
  begin perform public.caronte_checkpoint_print_job(j.id,lease.lease_token,receipt,'queued');
  exception when others then if sqlerrm='completed_step_is_immutable' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_print_immutable_step';end if;
  caught:=false;
  begin
    insert into public.future_book_pdfs(session_id,manuscript_id,version,file_name,pdf_base64)
      values(sid,mid,j.version,'synthetic-legacy-reservation-collision.pdf',null);
  exception when others then if sqlerrm='print_reserved_version' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_legacy_reserved_version';end if;
  caught:=false;
  begin perform public.caronte_finish_print_job(j.id,lease.lease_token,'{}');
  exception when others then if sqlerrm='print_parts_incomplete' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_print_incomplete_finish';end if;
  update public.future_book_print_jobs set lease_until=clock_timestamp()-interval '1 second' where id=j.id;
  replacement:=public.caronte_claim_print_job(j.id);
  if replacement.lease_token=lease.lease_token or replacement.pdf_id<>j.pdf_id or replacement.version<>j.version
    then raise exception 'test_failed_print_recovery_identity';end if;
  select to_jsonb(s) into completed_snapshot from public.future_book_print_steps s where job_id=j.id and step_key='plan:0:12';
  intent_snapshot:=jsonb_build_object('sha256',repeat('e',64),'path','synthetic-intent-retained');
  receipt:=jsonb_build_object('step_key','part:1:10','stage','part','status','failed','attempt',3,
    'input_hash',repeat('d',64),'output',intent_snapshot,'output_hash',repeat('e',64),'error_code','print_archive_timeout');
  perform public.caronte_checkpoint_print_job(j.id,replacement.lease_token,receipt,'blocked');
  select * into j from public.future_book_print_jobs where id=j.id;
  caught:=false;
  begin perform public.caronte_control_print_job(j.id,(j.updated_at-interval '1 second')::text,'resume','Storage fixed','{"role":"ops"}');
  exception when others then if sqlerrm='print_control_conflict' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_print_control_cas';end if;
  same:=public.caronte_control_print_job(j.id,j.updated_at::text,'resume','Storage fixed','{"role":"ops"}');
  if same.status<>'queued' or same.pdf_id<>j.pdf_id or same.version<>j.version
    or same.control_history->-1->>'action'<>'resume' then raise exception 'test_failed_print_control_resume';end if;
  if (select to_jsonb(s) from public.future_book_print_steps s where job_id=j.id and step_key='plan:0:12') is distinct from completed_snapshot
    or not exists(select 1 from public.future_book_print_steps where job_id=j.id and step_key='part:1:10'
      and attempt=0 and status='started' and output=intent_snapshot and output_hash=repeat('e',64) and jsonb_array_length(history)>0)
    then raise exception 'test_failed_print_control_receipts';end if;
  caught:=false;
  begin perform public.caronte_control_print_job(j.id,same.updated_at::text,'cancel','Cancel active work','{"role":"ops"}');
  exception when others then if sqlerrm='print_control_not_allowed' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_print_control_active';end if;
  replacement:=public.caronte_claim_print_job(j.id);
  update public.future_book_manuscripts set manuscript=source||'{"changed":true}'::jsonb where id=mid;
  update public.future_book_print_jobs set lease_until=clock_timestamp()-interval '1 second' where id=j.id;
  same:=public.caronte_claim_print_job(j.id);
  if same.id is not null or not exists(select 1 from public.future_book_print_jobs where id=j.id
    and status='blocked' and error_code='print_source_changed') then raise exception 'test_failed_print_changed_source';end if;
  select * into j from public.future_book_print_jobs where id=j.id;
  caught:=false;
  begin perform public.caronte_control_print_job(j.id,j.updated_at::text,'resume','Do not bypass source','{"role":"ops"}');
  exception when others then if sqlerrm='print_control_not_allowed' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_print_control_unsafe_resume';end if;
  same:=public.caronte_control_print_job(j.id,j.updated_at::text,'cancel','Cancel without deletion','{"role":"ops"}');
  if same.status<>'cancelled' or jsonb_array_length(same.control_history)<>2
    or (select to_jsonb(s) from public.future_book_print_steps s where job_id=j.id and step_key='plan:0:12') is distinct from completed_snapshot
    then raise exception 'test_failed_print_control_cancel';end if;
  delete from public.future_book_sessions where id=sid;
  if exists(select 1 from public.future_book_print_jobs where id=j.id)
    or exists(select 1 from public.future_book_print_steps where job_id=j.id) then raise exception 'test_failed_print_privacy_cascade';end if;
end;$$;
select 'PASS: print reservation, private access, lease, immutable steps, legacy fencing, source change and erasure' as result;
rollback;
