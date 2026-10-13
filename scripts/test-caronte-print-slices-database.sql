-- Independent persistence reproduction. Prepared assertions, not an executed pass.
-- Run only in an approved, migrated PostgreSQL environment with service_role.
-- The first new legal key is intentionally RED with the old checkpoint RPC.
-- Every source, count, cursor and hash below is explicitly synthetic. The page
-- counts exercise storage contracts; they are NOT font measurements or PDFs.
-- No helper functions, new tables, providers, object uploads or orders are used.
-- The transaction rolls back every fixture, including on the hosted service.
begin;
set local role service_role;
do $$
declare
  sid uuid; mid uuid; revision timestamptz;
  job public.future_book_print_jobs;
  lease public.future_book_print_jobs;
  replacement public.future_book_print_jobs;
  source jsonb;
  identity jsonb:=jsonb_build_object('template','caronte-a5-embedded-v2',
    'stagesVersion','caronte-a5-chunks-v1','sourceFingerprint',repeat('a',64),
    'fontFingerprint',repeat('f',64));
  receipt jsonb; candidate jsonb; slice_output jsonb; first_output jsonb;
  previous_output jsonb; next_output jsonb; selection_output jsonb; selected_output jsonb;
  old_completed jsonb; old_started jsonb; durable_first jsonb; durable_next jsonb;
  before_rejection jsonb; after_rejection jsonb; mutation jsonb; mutant jsonb;
  mutations jsonb; selection_mutations jsonb;
  caught boolean; key text;
  size numeric; chapter integer; ordinal integer; from_paragraph integer; to_paragraph integer;
  first_page integer; last_page integer; start_cursor jsonb; pages jsonb;
  para_units integer; para_characters integer; expected_pages integer;
  unicode_sid uuid; unicode_mid uuid; unicode_source jsonb;
  unicode_job public.future_book_print_jobs; unicode_lease public.future_book_print_jobs;
begin
  if current_user<>'service_role'
    or not has_function_privilege('service_role',
      'public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer)','EXECUTE')
    or has_function_privilege('anon',
      'public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer)','EXECUTE')
    or has_table_privilege('anon','public.future_book_print_jobs','SELECT, INSERT, UPDATE, DELETE')
    or has_table_privilege('anon','public.future_book_print_steps','SELECT, INSERT, UPDATE, DELETE')
    or has_table_privilege('authenticated','public.future_book_print_jobs','SELECT, INSERT, UPDATE, DELETE')
    or has_table_privilege('authenticated','public.future_book_print_steps','SELECT, INSERT, UPDATE, DELETE')
    then raise exception 'test_failed_slices_private_service_scope'; end if;

  source:=jsonb_build_object('prompt_version','caronte-literary-v3',
    'title','Synthetic slice database fixture','subtitle','Storage assertions only',
    'current_age',50,'future_age',80,'word_count',55000,
    'target_pages',jsonb_build_object('min',216,'max',224,'verified',false),
    'sections',(select jsonb_agg(jsonb_build_object('kind','chapter',
      'title','Synthetic chapter '||chapter_number,'paragraphs',
      (select jsonb_agg('Synthetic chapter '||chapter_number||' paragraph '||
        lpad(paragraph_number::text,3,'0')||' 🧭' order by paragraph_number)
       from generate_series(1,100) paragraph_number)) order by chapter_number)
      from generate_series(1,5) chapter_number));
  -- word_count is fixture metadata for the enqueue contract, not a claim that
  -- these deliberately short synthetic paragraphs form a 55,000-word book.
  insert into public.future_book_sessions(status,question_count,source,metadata)
    values('book_ready',1,'caronte_print_slices_database_test',
      '{"synthetic":true,"purpose":"checkpoint contract; no rendered book"}') returning id into sid;
  insert into public.future_book_manuscripts(session_id,status,title,manuscript,
    quality_report,provider_chain,prompt_version,page_target_min,page_target_max)
    values(sid,'ready','Synthetic slice database fixture',source,
      '{"editorial_gate":"pass","synthetic":true}','{"degraded":false}',
      'caronte-literary-v3',216,224) returning id,updated_at into mid,revision;
  job:=public.caronte_enqueue_print(sid,mid,revision,source,repeat('a',64),repeat('b',64),
    'caronte-a5-chunks-v1','sandbox',repeat('c',64),'0583X0827.BW.STD.PB.060UC444.MXX');
  lease:=public.caronte_claim_print_job(job.id);
  if lease.id<>job.id or lease.lease_token is null or lease.pdf_id<>job.pdf_id
    or lease.version<>job.version then raise exception 'test_failed_slices_claim_identity'; end if;

  -- Model the already durable old receipts. They are never recalculated or
  -- replaced by derivatives. Only this synthetic transaction seeds rows.
  candidate:=identity||jsonb_build_object('format','chapter-counts-v1','chapterIndex',0,
    'candidates',jsonb_build_array(jsonb_build_object('size',12,'leading',16.8,
      'paragraphCount',100,'pageCount',42)),'sha256',repeat('1',64));
  insert into public.future_book_print_steps(job_id,step_key,stage,status,attempt,input_hash,output,output_hash)
    values(job.id,'plan:0:12','plan','completed',1,repeat('2',64),candidate,repeat('3',64));
  receipt:=jsonb_build_object('step_key','plan:0:12.9','stage','plan','status','started',
    'attempt',1,'input_hash',repeat('d',64),'output',null,'output_hash',null);
  perform public.caronte_checkpoint_print_job(job.id,lease.lease_token,receipt,'running');
  select to_jsonb(s) into old_completed from public.future_book_print_steps s
    where job_id=job.id and step_key='plan:0:12';
  select to_jsonb(s) into old_started from public.future_book_print_steps s
    where job_id=job.id and step_key='plan:0:12.9';

  first_output:=identity||jsonb_build_object('format','chapter-slice-v1','chapterIndex',0,
    'size',12.9,'mode','counts','startParagraph',0,'endParagraph',24,'totalParagraphs',100,
    'previousSha256',null,'startState',null,'maxParagraphs',24,'maxCharacters',16000,
    'done',false,'state',jsonb_build_object('pageNumber',14,'y',100),'sha256',repeat('4',64));
  receipt:=jsonb_build_object('step_key','slice-count:0:12.9:0','stage','plan','status','started',
    'attempt',1,'input_hash',repeat('5',64),'output',null,'output_hash',null);
  -- RED: the baseline rejects this legal bounded key with print_step_contract.
  perform public.caronte_checkpoint_print_job(job.id,lease.lease_token,receipt,'running');
  if not exists(select 1 from public.future_book_print_steps where job_id=job.id
    and step_key='slice-count:0:12.9:0' and status='started' and output is null
    and attempt=1 and input_hash=repeat('5',64))
    then raise exception 'test_failed_slices_first_intent'; end if;
  receipt:=receipt||jsonb_build_object('status','completed','output',first_output,'output_hash',repeat('6',64));
  perform public.caronte_checkpoint_print_job(job.id,lease.lease_token,receipt,'running');
  select to_jsonb(s) into durable_first from public.future_book_print_steps s
    where job_id=job.id and step_key='slice-count:0:12.9:0';
  if durable_first->'output' is distinct from first_output
    or durable_first->>'status'<>'completed' or durable_first->>'attempt'<>'1'
    or jsonb_array_length(durable_first->'history')<>1
    or durable_first->'history'->0->>'status'<>'started'
    then raise exception 'test_failed_slices_durable_completion'; end if;
  if (select to_jsonb(s) from public.future_book_print_steps s where job_id=job.id and step_key='plan:0:12')
      is distinct from old_completed
    or (select to_jsonb(s) from public.future_book_print_steps s where job_id=job.id and step_key='plan:0:12.9')
      is distinct from old_started then raise exception 'test_failed_slices_old_receipts_changed'; end if;

  -- Completing a receipt does not permit a second write, even after a lost ack.
  caught:=false;
  begin perform public.caronte_checkpoint_print_job(job.id,lease.lease_token,receipt,'running');
  exception when others then if sqlerrm='completed_step_is_immutable' then caught:=true; else raise; end if; end;
  if not caught or (select to_jsonb(s) from public.future_book_print_steps s
      where job_id=job.id and step_key='slice-count:0:12.9:0') is distinct from durable_first
    then raise exception 'test_failed_slices_completed_immutable'; end if;

  next_output:=identity||jsonb_build_object('format','chapter-slice-v1','chapterIndex',0,
    'size',12.9,'mode','counts','startParagraph',24,'endParagraph',48,'totalParagraphs',100,
    'previousSha256',first_output->>'sha256','startState',first_output->'state',
    'maxParagraphs',24,'maxCharacters',16000,'done',false,
    'state',jsonb_build_object('pageNumber',24,'y',100),'sha256',repeat('7',64));
  receipt:=jsonb_build_object('step_key','slice-count:0:12.9:24','stage','plan','status','started',
    'attempt',1,'input_hash',repeat('8',64),'output',null,'output_hash',null);
  perform public.caronte_checkpoint_print_job(job.id,lease.lease_token,receipt,'running');
  select to_jsonb(s) into before_rejection from public.future_book_print_steps s
    where job_id=job.id and step_key=receipt->>'step_key';

  select sum(char_length(value)),sum(char_length(value)+char_length(regexp_replace(value,'[^𐀀-􏿿]','','g')))
    into para_characters,para_units
    from jsonb_array_elements_text(source->'sections'->0->'paragraphs') with ordinality p(value,n)
    where n>24 and n<=48;
  if para_units<=para_characters then raise exception 'test_failed_slices_utf16_fixture'; end if;
  mutations:=jsonb_build_array(
    jsonb_build_object('name','wrong source','patch',jsonb_build_object('sourceFingerprint',repeat('9',64))),
    jsonb_build_object('name','wrong chapter','patch','{"chapterIndex":1}'::jsonb),
    jsonb_build_object('name','wrong mode','patch','{"mode":"geometry"}'::jsonb),
    jsonb_build_object('name','wrong size','patch','{"size":12.8}'::jsonb),
    jsonb_build_object('name','wrong template','patch','{"template":"not-the-print-template"}'::jsonb),
    jsonb_build_object('name','wrong version','patch','{"stagesVersion":"not-the-stages-version"}'::jsonb),
    jsonb_build_object('name','wrong font','patch',jsonb_build_object('fontFingerprint',repeat('0',64))),
    jsonb_build_object('name','wrong format','patch','{"format":"chapter-counts-v1"}'::jsonb),
    jsonb_build_object('name','noncanonical start','patch','{"startParagraph":25}'::jsonb),
    jsonb_build_object('name','too many paragraphs','patch','{"endParagraph":49}'::jsonb),
    jsonb_build_object('name','premature end','patch','{"endParagraph":47}'::jsonb),
    jsonb_build_object('name','end beyond source','patch','{"endParagraph":101}'::jsonb),
    jsonb_build_object('name','wrong total','patch','{"totalParagraphs":99}'::jsonb),
    jsonb_build_object('name','premature done','patch','{"done":true}'::jsonb),
    jsonb_build_object('name','wrong predecessor','patch',jsonb_build_object('previousSha256',repeat('0',64))),
    jsonb_build_object('name','missing predecessor','patch','{"previousSha256":null}'::jsonb),
    jsonb_build_object('name','wrong start cursor','patch','{"startState":{"pageNumber":14,"y":101}}'::jsonb),
    jsonb_build_object('name','missing start cursor','patch','{"startState":null}'::jsonb),
    jsonb_build_object('name','backwards cursor','patch','{"state":{"pageNumber":13,"y":100}}'::jsonb),
    jsonb_build_object('name','cursor outside page','patch','{"state":{"pageNumber":24,"y":596}}'::jsonb),
    jsonb_build_object('name','fractional page','patch','{"state":{"pageNumber":24.5,"y":100}}'::jsonb),
    jsonb_build_object('name','paragraph budget','patch','{"maxParagraphs":25}'::jsonb),
    jsonb_build_object('name','character budget','patch','{"maxCharacters":16001}'::jsonb),
    jsonb_build_object('name','UTF16 budget overflow','patch',jsonb_build_object('maxCharacters',para_characters)),
    jsonb_build_object('name','counts containing geometry','patch','{"pages":[]}'::jsonb),
    jsonb_build_object('name','malformed slice hash','patch','{"sha256":"not-a-hash"}'::jsonb));
  for mutation in select value from jsonb_array_elements(mutations) loop
    mutant:=receipt||jsonb_build_object('status','completed','output',next_output||(mutation->'patch'),
      'output_hash',repeat('a',64));
    caught:=false;
    begin perform public.caronte_checkpoint_print_job(job.id,lease.lease_token,mutant,'running');
    exception when others then if sqlerrm like 'print_%' then caught:=true; else raise; end if; end;
    if not caught then raise exception 'test_failed_slices_malformed_accepted: %',mutation->>'name'; end if;
    select to_jsonb(s) into after_rejection from public.future_book_print_steps s
      where job_id=job.id and step_key=receipt->>'step_key';
    if after_rejection is distinct from before_rejection
      then raise exception 'test_failed_slices_rejection_mutated_intent: %',mutation->>'name'; end if;
  end loop;
  -- Key and stage must describe the exact same interval as the output.
  for mutant in select value from jsonb_array_elements(jsonb_build_array(
    receipt||jsonb_build_object('step_key','slice-count:0:12.9:25','status','completed','output',next_output,'output_hash',repeat('a',64)),
    receipt||jsonb_build_object('stage','compose','status','completed','output',next_output,'output_hash',repeat('a',64)),
    (receipt-'input_hash'),receipt||'{"attempt":0}'::jsonb,receipt||'{"attempt":4}'::jsonb)) loop
    caught:=false;
    begin perform public.caronte_checkpoint_print_job(job.id,lease.lease_token,mutant,'running');
    exception when others then
      if sqlerrm like 'print_%' or sqlstate='23514' then caught:=true; else raise; end if; end;
    if not caught then raise exception 'test_failed_slices_key_stage_hash_or_attempt_accepted'; end if;
  end loop;

  -- The original count cannot be manufactured from an incomplete chain.
  candidate:=identity||jsonb_build_object('format','chapter-counts-v1','chapterIndex',0,
    'candidates',jsonb_build_array(jsonb_build_object('size',12.9,'leading',18.06,
      'paragraphCount',100,'pageCount',42)),'sha256',repeat('b',64));
  caught:=false;
  begin perform public.caronte_checkpoint_print_job(job.id,lease.lease_token,
    jsonb_build_object('step_key','plan:0:12.9','stage','plan','status','completed','attempt',2,
      'input_hash',repeat('d',64),'output',candidate,'output_hash',repeat('c',64)),'running');
  exception when others then if sqlerrm like 'print_%' then caught:=true; else raise; end if; end;
  if not caught or (select to_jsonb(s) from public.future_book_print_steps s
    where job_id=job.id and step_key='plan:0:12.9') is distinct from old_started
    then raise exception 'test_failed_slices_incomplete_count_chain'; end if;

  -- A new process reclaims only the expired lease; cursor and receipts survive.
  update public.future_book_print_jobs set lease_until=clock_timestamp()-interval '1 second' where id=job.id;
  replacement:=public.caronte_claim_print_job(job.id);
  if replacement.lease_token is null or replacement.lease_token=lease.lease_token
    or replacement.pdf_id<>job.pdf_id or replacement.version<>job.version
    then raise exception 'test_failed_slices_recovery_reservation'; end if;
  caught:=false;
  begin perform public.caronte_checkpoint_print_job(job.id,lease.lease_token,receipt,'running');
  exception when others then if sqlerrm='lease_lost' then caught:=true; else raise; end if; end;
  if not caught then raise exception 'test_failed_slices_stale_lease'; end if;
  if (select to_jsonb(s) from public.future_book_print_steps s
    where job_id=job.id and step_key='slice-count:0:12.9:0') is distinct from durable_first
    then raise exception 'test_failed_slices_lost_ack_recalculated'; end if;
  receipt:=receipt||'{"attempt":2}'::jsonb;
  perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,receipt,'running');
  caught:=false;
  begin perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,receipt||'{"attempt":1}'::jsonb,'running');
  exception when others then if sqlerrm like 'print_%' then caught:=true; else raise; end if; end;
  if not caught then raise exception 'test_failed_slices_decreased_attempt'; end if;
  caught:=false;
  begin perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,
    receipt||jsonb_build_object('input_hash',repeat('0',64)),'running');
  exception when others then if sqlerrm='print_step_input_changed' then caught:=true; else raise; end if; end;
  if not caught then raise exception 'test_failed_slices_replaced_input_hash'; end if;
  receipt:=receipt||jsonb_build_object('status','completed','output',next_output,'output_hash',repeat('e',64));
  perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,receipt,'running');
  select to_jsonb(s) into durable_next from public.future_book_print_steps s
    where job_id=job.id and step_key='slice-count:0:12.9:24';
  if durable_next->>'attempt'<>'2' or durable_next->'output' is distinct from next_output
    or jsonb_array_length(durable_next->'history')<>2
    or durable_next->'history'->0->>'attempt'<>'1'
    or durable_next->'history'->1->>'attempt'<>'2'
    then raise exception 'test_failed_slices_retry_history'; end if;

  previous_output:=next_output;
  for ordinal in 2..4 loop
    from_paragraph:=ordinal*24; to_paragraph:=least(from_paragraph+24,100);
    last_page:=case when to_paragraph=100 then 46 else 14+ordinal*10 end;
    slice_output:=identity||jsonb_build_object('format','chapter-slice-v1','chapterIndex',0,
      'size',12.9,'mode','counts','startParagraph',from_paragraph,'endParagraph',to_paragraph,
      'totalParagraphs',100,'previousSha256',previous_output->>'sha256',
      'startState',previous_output->'state','maxParagraphs',24,'maxCharacters',16000,
      'done',to_paragraph=100,'state',jsonb_build_object('pageNumber',last_page,
        'y',case when to_paragraph=100 then 523.44 else 100 end),
      'sha256',md5('synthetic count slice '||ordinal)||md5('synthetic count slice suffix '||ordinal));
    receipt:=jsonb_build_object('step_key','slice-count:0:12.9:'||from_paragraph,
      'stage','plan','status','started','attempt',1,
      'input_hash',md5('synthetic count input '||ordinal)||md5('synthetic count input suffix '||ordinal),
      'output',null,'output_hash',null);
    perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,receipt,'running');
    perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,
      receipt||jsonb_build_object('status','completed','output',slice_output,
        'output_hash',md5('synthetic count output '||ordinal)||md5('synthetic count output suffix '||ordinal)),'running');
    previous_output:=slice_output;
  end loop;
  if (select to_jsonb(s) from public.future_book_print_steps s
      where job_id=job.id and step_key='plan:0:12.9') is distinct from old_started
    then raise exception 'test_failed_slices_derivatives_reset_original'; end if;
  receipt:=jsonb_build_object('step_key','plan:0:12.9','stage','plan','status','completed',
    'attempt',2,'input_hash',repeat('d',64),'output',candidate,'output_hash',repeat('c',64));
  perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,receipt,'running');
  if not exists(select 1 from public.future_book_print_steps where job_id=job.id and step_key='plan:0:12.9'
      and status='completed' and attempt=2 and input_hash=repeat('d',64) and output=candidate
      and history->0->>'status'='started' and history->0->>'attempt'='1')
    then raise exception 'test_failed_slices_original_finished_without_reset'; end if;

  selection_output:=identity||jsonb_build_object('format','layout-selection-v1','size',12.9,'pageCount',220,
    'plansHash',repeat('9',64),'sha256',repeat('a',64));
  receipt:=jsonb_build_object('step_key','selection','stage','plan','status','completed','attempt',1,
    'input_hash',repeat('b',64),'output',selection_output,'output_hash',repeat('c',64));
  caught:=false;
  begin perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,receipt,'running');
  exception when others then if sqlerrm like 'print_%' then caught:=true; else raise; end if; end;
  if not caught or exists(select 1 from public.future_book_print_steps where job_id=job.id and step_key='selection')
    then raise exception 'test_failed_slices_selection_before_complete_matrix'; end if;

  -- Seed the remaining historical count matrix only in this rolled-back fixture.
  -- 12.9 has 4 front pages + 42+42+44+44+44 = 220. Every other size totals 214.
  for chapter in 0..4 loop
    for ordinal in 0..20 loop
      size:=12+ordinal::numeric/10; key:='plan:'||chapter||':'||trim(trailing '.' from trim(trailing '0' from size::text));
      if size=12 then key:='plan:'||chapter||':12'; elsif size=13 then key:='plan:'||chapter||':13';
        elsif size=14 then key:='plan:'||chapter||':14'; end if;
      if not exists(select 1 from public.future_book_print_steps where job_id=job.id and step_key=key) then
        expected_pages:=case when size=12.9 and chapter>=2 then 44 else 42 end;
        candidate:=identity||jsonb_build_object('format','chapter-counts-v1','chapterIndex',chapter,
          'candidates',jsonb_build_array(jsonb_build_object('size',size,
            'leading',size::double precision*1.4::double precision,'paragraphCount',100,'pageCount',expected_pages)),
          'sha256',md5('synthetic historical plan '||key)||md5('synthetic historical plan suffix '||key));
        insert into public.future_book_print_steps(job_id,step_key,stage,status,attempt,input_hash,output,output_hash)
          values(job.id,key,'plan','completed',1,
            md5('synthetic historical input '||key)||md5('synthetic historical input suffix '||key),candidate,
            md5('synthetic historical output '||key)||md5('synthetic historical output suffix '||key));
      end if;
    end loop;
  end loop;
  if (select count(*) from public.future_book_print_steps where job_id=job.id and step_key like 'plan:%'
      and status='completed')<>105 then raise exception 'test_failed_slices_matrix_fixture'; end if;
  selection_mutations:=jsonb_build_array(
    jsonb_build_object('sourceFingerprint',repeat('0',64)),jsonb_build_object('fontFingerprint',repeat('0',64)),
    '{"template":"wrong"}'::jsonb,'{"stagesVersion":"wrong"}'::jsonb,
    '{"size":12,"pageCount":214}'::jsonb,'{"pageCount":224}'::jsonb,
    '{"size":12.95}'::jsonb,'{"plansHash":"not-a-hash"}'::jsonb,'{"format":"wrong"}'::jsonb);
  for mutation in select value from jsonb_array_elements(selection_mutations) loop
    caught:=false;
    begin perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,
      receipt||jsonb_build_object('output',selection_output||mutation),'running');
    exception when others then if sqlerrm like 'print_%' then caught:=true; else raise; end if; end;
    if not caught then raise exception 'test_failed_slices_invalid_selection_accepted: %',mutation; end if;
  end loop;
  perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,
    receipt||jsonb_build_object('status','started','output',null,'output_hash',null),'running');
  perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,receipt,'running');
  if not exists(select 1 from public.future_book_print_steps where job_id=job.id and step_key='selection'
    and status='completed' and output=selection_output) then raise exception 'test_failed_slices_selection_durable'; end if;

  -- An assembled geometry cannot skip its own intervals, although counts exist.
  select jsonb_agg(jsonb_build_object('number',n,'kind',case when n=5 then 'chapter'
    when n=46 then 'binding_blank' else 'body' end,'lines',
    (case when n=5 then jsonb_build_array(
      jsonb_build_object('text','CAPÍTULO 1','width',70,'x',72,'y',491.44,'kind','heading','font','regular','size',10),
      jsonb_build_object('text','Synthetic chapter 1','width',180,'x',72,'y',451.44,'kind','heading','font','bold','size',25))
      else '[]'::jsonb end)||coalesce((select jsonb_agg(jsonb_build_object('text',p.value,
        'width',180,'x',case when n%2=1 then 72 else 36 end,'y',400-(p.ordinality-1)%3*18.06,
        'kind','body','font','regular','size',12.9) order by p.ordinality)
        from jsonb_array_elements_text(source->'sections'->0->'paragraphs') with ordinality p(value,ordinality)
        where 5+((p.ordinality-1)*41/100)::integer=n),'[]'::jsonb)) order by n)
    into pages from generate_series(5,46) n;
  selected_output:=identity||jsonb_build_object('chapterIndex',0,
    'candidates',jsonb_build_array(jsonb_build_object('size',12.9,'leading',18.06,'paragraphCount',100,
      'pages',pages)),'sha256',repeat('d',64));
  receipt:=jsonb_build_object('step_key','selected:0:12.9','stage','plan','status','completed','attempt',1,
    'input_hash',repeat('e',64),'output',selected_output,'output_hash',repeat('f',64));
  caught:=false;
  begin perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,receipt,'running');
  exception when others then if sqlerrm like 'print_%' then caught:=true; else raise; end if; end;
  if not caught then raise exception 'test_failed_slices_selected_without_geometry_chain'; end if;

  previous_output:=null;
  for ordinal in 0..4 loop
    from_paragraph:=ordinal*24; to_paragraph:=least(from_paragraph+24,100);
    first_page:=coalesce((previous_output->'state'->>'pageNumber')::integer,5);
    last_page:=case when to_paragraph=100 then 46 else 14+ordinal*10 end;
    start_cursor:=case when ordinal=0 then null else previous_output->'state' end;
    -- Structurally scoped synthetic lines, not a renderer measurement. Body
    -- text is distributed across the fixture pages, and shared page lines merge.
    select jsonb_agg(jsonb_build_object('number',n,'kind',case when n=5 then 'chapter'
      when to_paragraph=100 and n=last_page then 'binding_blank' else 'body' end,
      'lines',(case when n=5 then jsonb_build_array(
        jsonb_build_object('text','CAPÍTULO 1','width',70,'x',72,'y',491.44,'kind','heading','font','regular','size',10),
        jsonb_build_object('text','Synthetic chapter 1','width',180,'x',72,'y',451.44,'kind','heading','font','bold','size',25))
        else '[]'::jsonb end)||coalesce((select jsonb_agg(jsonb_build_object('text',p.value,
          'width',180,'x',case when n%2=1 then 72 else 36 end,'y',400-(p.ordinality-from_paragraph-1)%3*18.06,
          'kind','body','font','regular','size',12.9) order by p.ordinality)
          from jsonb_array_elements_text(source->'sections'->0->'paragraphs') with ordinality p(value,ordinality)
          where p.ordinality>from_paragraph and p.ordinality<=to_paragraph and
            first_page+((p.ordinality-from_paragraph-1)*(last_page-first_page+
              case when to_paragraph=100 then 0 else 1 end)/(to_paragraph-from_paragraph))::integer=n),'[]'::jsonb))
      order by n) into pages from generate_series(first_page,last_page) n;
    slice_output:=identity||jsonb_build_object('format','chapter-slice-v1','chapterIndex',0,
      'size',12.9,'mode','geometry','startParagraph',from_paragraph,'endParagraph',to_paragraph,
      'totalParagraphs',100,'previousSha256',previous_output->>'sha256','startState',start_cursor,
      'maxParagraphs',24,'maxCharacters',16000,'done',to_paragraph=100,
      'state',jsonb_build_object('pageNumber',last_page,'y',case when to_paragraph=100 then 523.44 else 100 end),
      'pages',pages,'sha256',md5('synthetic geometry slice '||ordinal)||md5('synthetic geometry slice suffix '||ordinal));
    receipt:=jsonb_build_object('step_key','slice-geometry:0:12.9:'||from_paragraph,
      'stage','plan','status','started','attempt',1,
      'input_hash',md5('synthetic geometry input '||ordinal)||md5('synthetic geometry input suffix '||ordinal),
      'output',null,'output_hash',null);
    perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,receipt,'running');
    if ordinal=0 then
      for mutation in select value from jsonb_array_elements(jsonb_build_array(
        '{"mode":"counts"}'::jsonb,'{"size":12.8}'::jsonb,'{"pages":null}'::jsonb,
        jsonb_build_object('pages',jsonb_set(pages,'{0,number}','6'::jsonb)))) loop
        caught:=false;
        begin perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,
          receipt||jsonb_build_object('status','completed','output',slice_output||mutation,'output_hash',repeat('a',64)),'running');
        exception when others then if sqlerrm like 'print_%' then caught:=true; else raise; end if; end;
        if not caught then raise exception 'test_failed_slices_geometry_selection_or_pages'; end if;
      end loop;
      -- Matching key/output for another available size must still be fenced
      -- by the durable selection, not merely by the key/size consistency check.
      caught:=false;
      begin perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,
        receipt||jsonb_build_object('step_key','slice-geometry:0:12.8:0','status','completed',
          'output',slice_output||'{"size":12.8}'::jsonb,'output_hash',repeat('a',64)),'running');
      exception when others then if sqlerrm like 'print_%' then caught:=true; else raise; end if; end;
      if not caught then raise exception 'test_failed_slices_geometry_unselected_size'; end if;
    end if;
    perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,
      receipt||jsonb_build_object('status','completed','output',slice_output,
        'output_hash',md5('synthetic geometry output '||ordinal)||md5('synthetic geometry output suffix '||ordinal)),'running');
    previous_output:=slice_output;
  end loop;
  select jsonb_agg(jsonb_build_object('number',n,'kind',case when n=5 then 'chapter'
      when n=46 then 'binding_blank' else 'body' end,'lines',coalesce((
        select jsonb_agg(line.value order by (s.output->>'startParagraph')::integer,line.ordinality)
          from public.future_book_print_steps s
          cross join lateral jsonb_array_elements(s.output->'pages') page(value)
          cross join lateral jsonb_array_elements(page.value->'lines') with ordinality line(value,ordinality)
          where s.job_id=job.id and s.step_key like 'slice-geometry:0:12.9:%'
            and s.status='completed' and (page.value->>'number')::integer=n),'[]'::jsonb)) order by n)
    into pages from generate_series(5,46) n;
  selected_output:=identity||jsonb_build_object('chapterIndex',0,
    'candidates',jsonb_build_array(jsonb_build_object('size',12.9,'leading',18.06,
      'paragraphCount',100,'pages',pages)),'sha256',repeat('d',64));
  receipt:=jsonb_build_object('step_key','selected:0:12.9','stage','plan','status','started','attempt',1,
    'input_hash',repeat('e',64),'output',null,'output_hash',null);
  perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,receipt,'running');
  for mutation in select value from jsonb_array_elements(jsonb_build_array(
      '{"chapterIndex":1}'::jsonb,jsonb_build_object('sourceFingerprint',repeat('0',64)),
      jsonb_build_object('candidates',jsonb_build_array(jsonb_build_object('size',12.9,'leading',18.06,
        'paragraphCount',100,'pages',pages-41))),
      jsonb_build_object('candidates',jsonb_build_array(jsonb_build_object('size',12.8,'leading',17.92,
        'paragraphCount',100,'pages',pages))))) loop
    caught:=false;
    begin perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,
      receipt||jsonb_build_object('status','completed','output',selected_output||mutation,'output_hash',repeat('f',64)),'running');
    exception when others then if sqlerrm like 'print_%' then caught:=true; else raise; end if; end;
    if not caught then raise exception 'test_failed_slices_selected_identity_or_count'; end if;
  end loop;
  perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,
    receipt||jsonb_build_object('status','completed','output',selected_output,'output_hash',repeat('f',64)),'running');
  if not exists(select 1 from public.future_book_print_steps where job_id=job.id and step_key='selected:0:12.9'
    and status='completed' and output=selected_output and jsonb_array_length(output->'candidates'->0->'pages')=42)
    then raise exception 'test_failed_slices_selected_assembly_durable'; end if;

  -- A manuscript mutation still fences all derived stages. The subtransaction
  -- rolls that deliberately invalid source back before the final assertions.
  caught:=false;
  begin
    update public.future_book_manuscripts set manuscript=source||'{"changed":true}'::jsonb where id=mid;
    perform public.caronte_checkpoint_print_job(job.id,replacement.lease_token,
      jsonb_build_object('step_key','slice-count:1:12:0','stage','plan','status','started',
        'attempt',1,'input_hash',repeat('a',64),'output',null,'output_hash',null),'running');
  exception when others then if sqlerrm='print_source_changed' then caught:=true; else raise; end if; end;
  if not caught or not exists(select 1 from public.future_book_manuscripts
      where id=mid and manuscript=source and updated_at=revision)
    then raise exception 'test_failed_slices_source_revision_fence'; end if;
  if (select to_jsonb(s) from public.future_book_print_steps s where job_id=job.id and step_key='plan:0:12')
      is distinct from old_completed
    or (select to_jsonb(s) from public.future_book_print_steps s where job_id=job.id and step_key='slice-count:0:12.9:0')
      is distinct from durable_first
    or (select to_jsonb(s) from public.future_book_print_steps s where job_id=job.id and step_key='slice-count:0:12.9:24')
      is distinct from durable_next
    or exists(select 1 from public.future_book_pdfs where session_id=sid)
    then raise exception 'test_failed_slices_final_receipt_preservation'; end if;
  if not exists(select 1 from public.future_book_print_jobs where id=job.id
    and pdf_id=job.pdf_id and version=job.version and source_snapshot=source
    and source_sha256=repeat('a',64) and stages_version='caronte-a5-chunks-v1'
    and status='running' and lease_token=replacement.lease_token)
    then raise exception 'test_failed_slices_final_job_identity'; end if;

  -- Separate synthetic Unicode source: one indivisible paragraph has 8,001
  -- astral characters, i.e. 16,002 UTF-16 units, although char_length is 8,001.
  -- The fixed 16,000-unit coordinator budget must reject it, not truncate it.
  unicode_source:=jsonb_set(source,'{sections,0,paragraphs,0}',to_jsonb(repeat('🧭',8001)));
  insert into public.future_book_sessions(status,question_count,source,metadata)
    values('book_ready',1,'caronte_print_slices_database_test',
      '{"synthetic":true,"purpose":"UTF16 budget; no rendered book"}') returning id into unicode_sid;
  insert into public.future_book_manuscripts(session_id,status,title,manuscript,
    quality_report,provider_chain,prompt_version,page_target_min,page_target_max)
    values(unicode_sid,'ready','Synthetic Unicode database fixture',unicode_source,
      '{"editorial_gate":"pass","synthetic":true}','{"degraded":false}',
      'caronte-literary-v3',216,224) returning id,updated_at into unicode_mid,revision;
  unicode_job:=public.caronte_enqueue_print(unicode_sid,unicode_mid,revision,unicode_source,
    repeat('a',64),repeat('b',64),'caronte-a5-chunks-v1','sandbox',repeat('c',64),
    '0583X0827.BW.STD.PB.060UC444.MXX');
  unicode_lease:=public.caronte_claim_print_job(unicode_job.id);
  caught:=false;
  begin perform public.caronte_checkpoint_print_job(unicode_job.id,unicode_lease.lease_token,
    jsonb_build_object('step_key','slice-count:0:12.9:0','stage','plan','status','completed',
      'attempt',1,'input_hash',repeat('d',64),'output',first_output||
        jsonb_build_object('endParagraph',1),'output_hash',repeat('e',64)),'running');
  exception when others then if sqlerrm like 'print_%' then caught:=true; else raise; end if; end;
  if not caught or exists(select 1 from public.future_book_print_steps where job_id=unicode_job.id
      and step_key='slice-count:0:12.9:0')
    then raise exception 'test_failed_slices_fixed_utf16_budget_or_truncation'; end if;
end;
$$;
select 'PASS: synthetic sliced checkpoint scope, bounds, UTF16, chain, selection, lease, attempts and immutable receipts; no rendered PDF' as result;
rollback;
