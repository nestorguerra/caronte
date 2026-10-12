-- Synthetic bounded-receipt assertions. All rows roll back; no providers/files/orders.
begin;
do $$
declare sid uuid;mid uuid;revision timestamptz;j public.future_book_print_jobs;
  lease public.future_book_print_jobs;source jsonb;original jsonb;receipt jsonb;
  before_row jsonb;caught boolean;
begin
  source:=jsonb_build_object('prompt_version','caronte-literary-v2','title','Synthetic geometry',
    'sections',(select jsonb_agg(jsonb_build_object('kind','chapter','title','Synthetic',
      'paragraphs',jsonb_build_array('Synthetic database contract only'))) from generate_series(1,5)));
  insert into public.future_book_sessions(status,question_count,source,metadata)
    values('book_ready',1,'caronte_geometry_sql_test','{"synthetic":true}') returning id into sid;
  insert into public.future_book_manuscripts(session_id,status,title,manuscript,quality_report,provider_chain)
    values(sid,'ready','Synthetic geometry',source,'{"editorial_gate":"pass"}','{"degraded":false}')
    returning id,updated_at into mid,revision;
  j:=public.caronte_enqueue_print(sid,mid,revision,source,repeat('a',64),repeat('b',64),
    'caronte-a5-chunks-v1','sandbox',repeat('c',64),'0583X0827.BW.STD.PB.060UC444.MXX');
  lease:=public.caronte_claim_print_job(j.id);
  original:=jsonb_build_object('sourceFingerprint',repeat('a',64),'fontFingerprint',repeat('f',64),
    'candidates',jsonb_build_array(jsonb_build_object('size',12,'leading',16.8,'paragraphCount',1,
      'pages',jsonb_build_array('{}'::jsonb,'{}'::jsonb))));
  perform public.caronte_checkpoint_print_job(j.id,lease.lease_token,
    jsonb_build_object('step_key','plan:0:12','stage','plan','status','completed','attempt',1,
      'input_hash',repeat('d',64),'output',original,'output_hash',repeat('e',64)),'running');
  select to_jsonb(s) into before_row from public.future_book_print_steps s where job_id=j.id and step_key='plan:0:12';
  receipt:=jsonb_build_object('step_key','geometry:0:12','stage','plan','status','completed','attempt',1,
    'input_hash',repeat('d',64),'output_hash',repeat('b',64),'output',jsonb_build_object(
      'format','chapter-counts-v1','sourceFingerprint',repeat('a',64),'fontFingerprint',repeat('f',64),
      'originalPlanKey','plan:0:12','originalPlanHash',repeat('e',64),
      'candidates',jsonb_build_array(jsonb_build_object('size',12,'leading',16.8,'paragraphCount',1,'pageCount',2))));
  caught:=false;
  begin perform public.caronte_checkpoint_print_job(j.id,lease.lease_token,
    jsonb_set(receipt,'{output,originalPlanHash}',to_jsonb(repeat('0',64))),'running');
  exception when others then if sqlerrm='print_geometry_receipt_mismatch' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_geometry_parent_hash';end if;
  caught:=false;
  begin perform public.caronte_checkpoint_print_job(j.id,lease.lease_token,
    jsonb_set(receipt,'{output,candidates,0,pageCount}','4'),'running');
  exception when others then if sqlerrm='print_geometry_receipt_mismatch' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_geometry_page_count';end if;
  perform public.caronte_checkpoint_print_job(j.id,lease.lease_token,receipt,'queued');
  if (select to_jsonb(s) from public.future_book_print_steps s where job_id=j.id and step_key='plan:0:12')
    is distinct from before_row then raise exception 'test_failed_original_receipt_mutated';end if;
  if not exists(select 1 from public.future_book_print_steps where job_id=j.id and step_key='geometry:0:12'
    and status='completed' and output->>'originalPlanHash'=repeat('e',64)) then raise exception 'test_failed_geometry_readback';end if;
  if has_function_privilege('anon','public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer)','EXECUTE')
    or has_function_privilege('authenticated','public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer)','EXECUTE')
    or not has_function_privilege('service_role','public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer)','EXECUTE')
    then raise exception 'test_failed_private_geometry_access';end if;
end;$$;
rollback;
