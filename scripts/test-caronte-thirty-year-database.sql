-- Synthetic contract assertions only. No provider calls, files, approvals or orders.
begin;
do $$
declare sid uuid;mid uuid;j public.future_book_jobs;b public.future_book_jobs;
  pj public.future_book_print_jobs;pl public.future_book_print_jobs;revision timestamptz;
  manuscript jsonb;policy jsonb;report jsonb;receipt jsonb;pdf jsonb;prefix text;
  caught boolean;chapter integer;font_size text;page_start integer;
begin
  policy:='{"version":"caronte-literary-v3","horizonYears":30,"chapters":5,"unitsPerChapter":6,
    "unitWords":{"min":1800,"max":2200},"manuscriptWords":{"min":55000,"max":65000},
    "physicalPages":{"min":216,"max":224,"target":220},"reviewMinimum":4}'::jsonb;
  manuscript:=jsonb_build_object('prompt_version','caronte-literary-v3','title','Synthetic SQL contract',
    'current_age',50,'future_age',80,'narrative_year',2056,'word_count',60000,
    'target_pages',jsonb_build_object('min',216,'max',224,'verified',false),
    'sections',(select jsonb_agg(jsonb_build_object('kind','chapter','title','Synthetic',
      'paragraphs',jsonb_build_array(repeat('palabra ',12000)))) from generate_series(1,5)));
  report:=jsonb_build_object('editorial_gate','pass','page_target',manuscript->'target_pages');
  insert into public.future_book_sessions(status,question_count,source,metadata)
    values('interview_completed',1,'caronte_thirty_year_sql_test','{"synthetic":true}') returning id into sid;
  j:=public.caronte_enqueue_book(sid,repeat('a',64),
    '{"interviewDate":"2026-10-12T00:00:00Z","sources":[{"id":"q_01","transcript":"Synthetic age 50"}]}',
    'caronte-longform-v2',jsonb_build_object('writerModel','gpt-6.1-sol',
      'reviewerModel','claude-opus-5-5','writerReasoningEffort','xhigh','literaryContract',policy));
  b:=public.caronte_claim_book_job(j.id);
  caught:=false;
  begin perform public.caronte_finish_book_job(j.id,b.lease_token,
    manuscript||'{"future_age":90}',report,'{"degraded":false}');
  exception when others then if sqlerrm='book_contract_mismatch' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_future_horizon';end if;
  caught:=false;
  begin perform public.caronte_finish_book_job(j.id,b.lease_token,
    manuscript||'{"word_count":48000}',report,'{"degraded":false}');
  exception when others then if sqlerrm='manuscript_word_count' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_new_word_floor';end if;
  caught:=false;
  begin perform public.caronte_finish_book_job(j.id,b.lease_token,
    manuscript||'{"target_pages":{"min":180,"max":200,"verified":false}}',report,'{"degraded":false}');
  exception when others then if sqlerrm='book_contract_mismatch' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_old_page_policy';end if;
  update public.future_book_jobs set model_config=jsonb_set(model_config,'{literaryContract,horizonYears}','40') where id=j.id;
  caught:=false;
  begin perform public.caronte_finish_book_job(j.id,b.lease_token,manuscript,report,'{"degraded":false}');
  exception when others then if sqlerrm='book_contract_unsupported' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_changed_frozen_contract';end if;
  update public.future_book_jobs set model_config=jsonb_set(model_config,'{literaryContract}',policy) where id=j.id;
  mid:=public.caronte_finish_book_job(j.id,b.lease_token,manuscript,report,'{"degraded":false}');
  if not exists(select 1 from public.future_book_manuscripts m where m.id=mid and m.page_target_min=216
    and m.page_target_max=224 and m.manuscript->>'future_age'='80') then raise exception 'test_failed_persisted_contract';end if;
  select updated_at into revision from public.future_book_manuscripts where id=mid;
  pj:=public.caronte_enqueue_print(sid,mid,revision,manuscript,repeat('a',64),repeat('b',64),
    'caronte-a5-chunks-v1','sandbox',repeat('c',64),'0583X0827.BW.STD.PB.060UC444.MXX');
  pl:=public.caronte_claim_print_job(pj.id);
  receipt:=jsonb_build_object('step_key','plan:0:12.1','stage','plan','status','completed','attempt',1,
    'input_hash',repeat('d',64),'output',jsonb_build_object('synthetic',true),'output_hash',repeat('e',64));
  perform public.caronte_checkpoint_print_job(pj.id,pl.lease_token,receipt,'running');
  caught:=false;
  begin perform public.caronte_checkpoint_print_job(pj.id,pl.lease_token,
    receipt||'{"step_key":"plan:0:12.15"}','running');
  exception when others then if sqlerrm='print_step_contract' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_font_allowlist';end if;
  for chapter in 0..4 loop
    for font_size in select case when n%10=0 then (n/10)::text else (n/10.0)::numeric(3,1)::text end from generate_series(120,140) n loop
      insert into public.future_book_print_steps(job_id,step_key,stage,status,attempt,input_hash,output,output_hash)
        values(pj.id,'plan:'||chapter||':'||font_size,'plan','completed',1,repeat('d',64),'{"synthetic":true}',repeat('e',64))
        on conflict(job_id,step_key) do nothing;
    end loop;
  end loop;
  for page_start in select generate_series(1,220,10) loop
    insert into public.future_book_print_steps(job_id,step_key,stage,status,attempt,input_hash,output,output_hash)
      values(pj.id,'part:'||page_start||':'||(page_start+9),'part','completed',1,repeat('d',64),
        '{"storage_verified":true}',repeat('e',64));
  end loop;
  prefix:=sid||'/v01/'||pj.id||'/';
  insert into public.future_book_print_steps(job_id,step_key,stage,status,attempt,input_hash,output,output_hash)
    values(pj.id,'compose','compose','completed',1,repeat('d',64),
      jsonb_build_object('proof',false,'layout',jsonb_build_object('pages',
        (select jsonb_agg('{}'::jsonb) from generate_series(1,220)))),repeat('e',64)),
      (pj.id,'interior','interior','completed',1,repeat('d',64),
        jsonb_build_object('pageCount',220,'storage_verified',true,'path',prefix||'interior.pdf',
          'sourceFingerprint',repeat('a',64),'sha256',repeat('f',64)),repeat('e',64)),
      (pj.id,'cover','cover','completed',1,repeat('d',64),
        jsonb_build_object('pageCount',1,'storage_verified',true,'path',prefix||'cover.pdf',
          'sourceFingerprint',repeat('a',64),'sha256',repeat('e',64)),repeat('e',64));
  pdf:=jsonb_build_object('id',pj.pdf_id,'session_id',sid,'manuscript_id',mid,'print_job_id',pj.id,
    'version',1,'page_count',220,'storage_path',prefix||'interior.pdf','file_name','synthetic.pdf',
    'status','generated','review_status','pending_review','quality_report',report,
    'print_validation',jsonb_build_object('source_sha256',repeat('a',64),'interior_sha256',repeat('f',64),
      'cover_sha256',repeat('e',64),'ready_for_print',false),
    'lulu_metadata',jsonb_build_object('ready_for_print',false,'send_to_lulu',false,'environment','sandbox',
      'pod_package_id',pj.pod_package_id,'cover_pdf_storage_path',prefix||'cover.pdf'),
    'metadata',jsonb_build_object('print_job_id',pj.id,'lulu_credential_tag',repeat('c',64),
      'literary_contract_version','caronte-literary-v3'));
  caught:=false;
  begin perform public.caronte_finish_print_job(pj.id,pl.lease_token,jsonb_set(pdf,'{metadata}','{}'));
  exception when others then if sqlerrm='print_pdf_reservation_mismatch' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_pdf_contract_binding';end if;
  update public.future_book_print_steps set output=jsonb_set(output,'{pageCount}','214') where job_id=pj.id and step_key='interior';
  caught:=false;
  begin perform public.caronte_finish_print_job(pj.id,pl.lease_token,pdf);
  exception when others then if sqlerrm='print_parts_incomplete' then caught:=true;else raise;end if;end;
  if not caught then raise exception 'test_failed_physical_page_floor';end if;
  update public.future_book_print_steps set output=jsonb_set(output,'{pageCount}','220') where job_id=pj.id and step_key='interior';
  perform public.caronte_finish_print_job(pj.id,pl.lease_token,pdf);
  if not exists(select 1 from public.future_book_pdfs where id=pj.pdf_id and page_count=220
    and review_status='pending_review' and print_validation->>'ready_for_print'='false')
    then raise exception 'test_failed_physical_print_contract';end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('caronte_finish_book_job','caronte_enqueue_print','caronte_checkpoint_print_job','caronte_finish_print_job')
    and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')))
    then raise exception 'test_failed_current_private_rpc';end if;
end;$$;
select 'PASS: frozen thirty-year contract, 216-224 physical pages, fine fonts and private RPCs' as result;
rollback;
