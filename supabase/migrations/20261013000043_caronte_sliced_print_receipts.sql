-- Persist bounded renderer intervals without changing original receipts or ACLs.
-- Canonical JSON/typographic/text validation remains in the shared renderer;
-- this RPC enforces durable identity, fixed budgets, chains and chosen counts.
create or replace function public.caronte_checkpoint_print_job(p_job_id uuid,p_lease_token uuid,p_step jsonb,
  p_state text,p_delay_seconds integer default 0) returns boolean
language plpgsql security definer set search_path='' as $$
declare
  j public.future_book_print_jobs; previous public.future_book_print_steps;
  original public.future_book_print_steps; predecessor public.future_book_print_steps;
  link public.future_book_print_steps; selection public.future_book_print_steps;
  key text:=p_step->>'step_key'; output jsonb:=nullif(p_step->'output','null'::jsonb); candidate jsonb;
  prefix text; mode text; chapter integer; size numeric; start_at integer; end_at integer;
  total integer; units integer; used integer; paragraphs jsonb; font text;
  cursor integer; last_output jsonb; page jsonb; line jsonb; page_at integer; first_page integer;
  count_pages integer; sum_pages integer; chosen_pages integer; chosen_size numeric;
  candidate_size numeric; size_tick integer; chapter_at integer;
  modern boolean; sliced boolean;
begin
  select * into j from public.future_book_print_jobs where id=p_job_id and status='running'
    and lease_token=p_lease_token and lease_until>clock_timestamp() for update;
  if j.id is null then raise exception 'lease_lost';end if;
  if not exists(select 1 from public.future_book_manuscripts where id=j.manuscript_id and status='ready'
    and updated_at=j.manuscript_revision and manuscript=j.source_snapshot and quality_report->>'editorial_gate'='pass')
    then raise exception 'print_source_changed';end if;
  if p_state is null or p_state not in ('running','queued','blocked')
    or p_step->>'status' is null or p_step->>'status' not in ('started','completed','failed')
    or coalesce(key,'') !~ '^((plan|geometry|selected):[0-4]:(1[23]([.][1-9])?|14)|slice-(count|geometry):[0-4]:(1[23]([.][1-9])?|14):(0|[1-9][0-9]{0,8})|selection|compose|part:[0-9]+:[0-9]+|interior|cover|finish|gate)$'
    or p_step->>'stage' is null or p_step->>'stage' not in ('plan','compose','part','interior','cover','finish','gate')
    then raise exception 'print_step_contract';end if;
  modern:=j.source_snapshot->>'prompt_version'='caronte-literary-v3';
  sliced:=key='selection' or key like 'selected:%' or key like 'slice-%';
  if (sliced or key like 'plan:%' or key like 'geometry:%') and p_step->>'stage' is distinct from 'plan'
    then raise exception 'print_step_contract';end if;
  if p_step->>'stage'='plan' and (
    (j.source_snapshot->>'prompt_version'='caronte-literary-v2' and key<>'selection'
      and split_part(key,':',3) not in ('12','12.5','13','13.5','14'))
    or coalesce(j.source_snapshot->>'prompt_version','') not in ('caronte-literary-v2','caronte-literary-v3'))
    then raise exception 'print_step_contract';end if;
  if p_step->>'stage'<>'gate' and coalesce(p_step->>'input_hash','') !~ '^[a-f0-9]{64}$'
    then raise exception 'print_step_contract';end if;
  if output is not null and output<>'null'::jsonb and
    (jsonb_typeof(output)<>'object' or coalesce(p_step->>'output_hash','') !~ '^[a-f0-9]{64}$'
      or output ? 'bytes') then raise exception 'print_step_contract';end if;
  if p_step->>'status'='completed' and (output is null or output='null'::jsonb)
    then raise exception 'print_step_contract';end if;
  -- Preserve rejection priority, immutable bytes, input identity and history.
  select * into previous from public.future_book_print_steps where job_id=p_job_id and step_key=key for update;
  if previous.status='completed' then raise exception 'completed_step_is_immutable';end if;
  if previous.input_hash is not null and previous.input_hash is distinct from p_step->>'input_hash'
    then raise exception 'print_step_input_changed';end if;
  if previous.output is not null and previous.output<>'null'::jsonb
    and (previous.output-'storage_verified') is distinct from (output-'storage_verified')
    then raise exception 'print_step_output_changed';end if;
  if previous.attempt is not null and (p_step->>'attempt')::integer<previous.attempt
    then raise exception 'print_step_contract';end if;
  if sliced and (jsonb_typeof(p_step->'attempt') is distinct from 'number'
    or coalesce(p_step->>'attempt','') !~ '^[1-3]$') then raise exception 'print_step_contract';end if;

  select * into selection from public.future_book_print_steps
    where job_id=j.id and step_key='selection' and status='completed' for share;
  if sliced and output is not null and output<>'null'::jsonb then
    if output->>'template' is distinct from 'caronte-a5-embedded-v2'
      or output->>'stagesVersion' is distinct from j.stages_version
      or output->>'sourceFingerprint' is distinct from j.source_sha256
      or coalesce(output->>'fontFingerprint','') !~ '^[a-f0-9]{64}$'
      or coalesce(output->>'sha256','') !~ '^[a-f0-9]{64}$'
      then raise exception 'print_slice_identity';end if;
    select s.output->>'fontFingerprint' into font from public.future_book_print_steps s
      where s.job_id=j.id and s.status='completed' and s.stage='plan'
        and s.output->>'fontFingerprint' is not null order by s.created_at,s.step_key limit 1;
    if font is not null and output->>'fontFingerprint' is distinct from font
      then raise exception 'print_slice_identity';end if;
  end if;

  if key like 'slice-%' then
    prefix:=split_part(key,':',1);chapter:=split_part(key,':',2)::integer;
    size:=split_part(key,':',3)::numeric;start_at:=split_part(key,':',4)::integer;
    mode:=case when prefix='slice-count' then 'counts' else 'geometry' end;
    paragraphs:=j.source_snapshot->'sections'->chapter->'paragraphs';
    if jsonb_typeof(paragraphs) is distinct from 'array' then raise exception 'print_slice_contract';end if;
    total:=jsonb_array_length(paragraphs);
    if start_at>=total then raise exception 'print_slice_contract';end if;
    select * into original from public.future_book_print_steps where job_id=j.id
      and step_key='plan:'||chapter||':'||size and status='completed' for share;
    if mode='counts' and original.job_id is not null then raise exception 'print_slice_chain';end if;
    if mode='geometry' and (selection.job_id is null or original.job_id is null
      or selection.output->'size' is distinct from to_jsonb(size)) then raise exception 'print_slice_chain';end if;
    if start_at>0 then
      select * into predecessor from public.future_book_print_steps s where s.job_id=j.id and s.status='completed'
        and s.step_key like prefix||':'||chapter||':'||size||':%'
        and s.output->'endParagraph'=to_jsonb(start_at) for share;
      if predecessor.job_id is null or predecessor.output->'done' is distinct from 'false'::jsonb
        then raise exception 'print_slice_chain';end if;
    end if;
    -- JavaScript length counts UTF-16 units, not UTF-8 bytes or code points.
    end_at:=start_at;used:=0;
    while end_at<total and end_at-start_at<24 loop
      if jsonb_typeof(paragraphs->end_at) is distinct from 'string' then raise exception 'print_slice_contract';end if;
      units:=char_length(paragraphs->>end_at)+regexp_count(paragraphs->>end_at,U&'[\+010000-\+10FFFF]');
      exit when used+units>16000;
      used:=used+units;end_at:=end_at+1;
    end loop;
    if end_at=start_at then raise exception 'print_slice_paragraph_limit';end if;
    if output is not null and output<>'null'::jsonb then
      if output->>'format' is distinct from 'chapter-slice-v1' or output->>'mode' is distinct from mode
        or output->'chapterIndex' is distinct from to_jsonb(chapter) or output->'size' is distinct from to_jsonb(size)
        or output->'startParagraph' is distinct from to_jsonb(start_at) or output->'endParagraph' is distinct from to_jsonb(end_at)
        or output->'totalParagraphs' is distinct from to_jsonb(total)
        or output->'maxParagraphs' is distinct from '24'::jsonb or output->'maxCharacters' is distinct from '16000'::jsonb
        or output->'done' is distinct from to_jsonb(end_at=total)
        or output->'previousSha256' is distinct from coalesce(predecessor.output->'sha256','null'::jsonb)
        or output->'startState' is distinct from coalesce(predecessor.output->'state','null'::jsonb)
        or jsonb_typeof(output->'state'->'pageNumber') is distinct from 'number'
        or coalesce(output->'state'->>'pageNumber','') !~ '^[1-9][0-9]{0,3}$'
        or jsonb_typeof(output->'state'->'y') is distinct from 'number'
        then raise exception 'print_slice_receipt_mismatch';end if;
      page_at:=(output->'state'->>'pageNumber')::integer;
      first_page:=coalesce((predecessor.output->'state'->>'pageNumber')::integer,5);
      if page_at<first_page or page_at<5 or (end_at=total and page_at%2<>0)
        or (output->'state'->>'y')::numeric<54-size*1.4*1.35-0.000001
        or (output->'state'->>'y')::numeric>523.44 then raise exception 'print_slice_receipt_mismatch';end if;
      if mode='counts' then
        if output ? 'pages' then raise exception 'print_slice_receipt_mismatch';end if;
      else
        if output->>'fontFingerprint' is distinct from selection.output->>'fontFingerprint'
          or output->>'fontFingerprint' is distinct from original.output->>'fontFingerprint'
          or jsonb_typeof(output->'pages') is distinct from 'array'
          then raise exception 'print_slice_receipt_mismatch';end if;
        if jsonb_array_length(output->'pages')<>page_at-first_page+1 then raise exception 'print_slice_receipt_mismatch';end if;
        cursor:=first_page;
        for page in select value from jsonb_array_elements(output->'pages') loop
          if page->'number' is distinct from to_jsonb(cursor) or jsonb_typeof(page->'lines') is distinct from 'array'
            or page->>'kind' is distinct from (case when cursor=5 then 'chapter'
              when end_at=total and cursor=page_at and page->>'kind'='binding_blank' then 'binding_blank' else 'body' end)
            then raise exception 'print_slice_receipt_mismatch';end if;
          if page->>'kind'='binding_blank' and jsonb_array_length(page->'lines')<>0 then raise exception 'print_slice_receipt_mismatch';end if;
          for line in select value from jsonb_array_elements(page->'lines') loop
            if jsonb_typeof(line->'text') is distinct from 'string' or coalesce(btrim(line->>'text'),'')=''
              or coalesce(line->>'kind','') not in ('body','heading')
              or line->'x' is distinct from to_jsonb(case when cursor%2=1 then 72 else 36 end)
              or jsonb_typeof(line->'y') is distinct from 'number' or jsonb_typeof(line->'width') is distinct from 'number'
              then raise exception 'print_slice_receipt_mismatch';end if;
            if (line->>'y')::numeric<54 or (line->>'y')::numeric>523.44
              or (line->>'width')::numeric<0 or (line->>'width')::numeric>311.77
              or (line->>'kind'='body' and (line->>'font' is distinct from 'regular' or line->'size' is distinct from to_jsonb(size)))
              or (line->>'kind'='heading' and (start_at<>0 or cursor<>5 or coalesce(line->>'font','') not in ('regular','bold')
                or line->'size' is distinct from to_jsonb(case when line->>'font'='regular' then 10 else 25 end)))
              then raise exception 'print_slice_receipt_mismatch';end if;
          end loop;
          cursor:=cursor+1;
        end loop;
      end if;
    end if;
  end if;

  if key='selection' then
    -- The complete original matrix is required, including previously frozen plans.
    for size_tick in 120..140 loop
      if not modern and size_tick not in (120,125,130,135,140) then continue;end if;
      candidate_size:=size_tick::numeric/10;sum_pages:=4;
      for chapter_at in 0..4 loop
        -- numeric formatting must use the renderer's keys (12, not 12.0).
        select * into original from public.future_book_print_steps where job_id=j.id
          and step_key='plan:'||chapter_at||':'||trim_scale(candidate_size) and status='completed' for share;
        candidate:=original.output->'candidates'->0;
        if original.job_id is null or jsonb_typeof(original.output->'candidates') is distinct from 'array'
          or original.output->>'sourceFingerprint' is distinct from j.source_sha256
          or original.output->>'template' is distinct from 'caronte-a5-embedded-v2'
          or original.output->>'stagesVersion' is distinct from j.stages_version
          or coalesce(original.output->>'fontFingerprint','') !~ '^[a-f0-9]{64}$'
          or original.output->'chapterIndex' is distinct from to_jsonb(chapter_at)
          or candidate->'size' is distinct from to_jsonb(candidate_size)
          or candidate->'paragraphCount' is distinct from to_jsonb(jsonb_array_length(j.source_snapshot->'sections'->chapter_at->'paragraphs'))
          then raise exception 'print_selection_chain';end if;
        if jsonb_array_length(original.output->'candidates')<>1 then raise exception 'print_selection_chain';end if;
        if font is null then font:=original.output->>'fontFingerprint';end if;
        if original.output->>'fontFingerprint' is distinct from font then raise exception 'print_selection_chain';end if;
        if original.output->>'format'='chapter-counts-v1' then
          if coalesce(candidate->>'pageCount','') !~ '^[1-9][0-9]{0,3}$' then raise exception 'print_selection_chain';end if;
          count_pages:=(candidate->>'pageCount')::integer;
        elsif original.output->>'format' is null and jsonb_typeof(candidate->'pages')='array' then
          count_pages:=jsonb_array_length(candidate->'pages');
        else raise exception 'print_selection_chain';end if;
        if count_pages<2 or count_pages%2<>0 then raise exception 'print_selection_chain';end if;
        sum_pages:=sum_pages+count_pages;
      end loop;
      if sum_pages between (case when modern then 216 else 180 end) and (case when modern then 224 else 200 end)
        and (chosen_size is null or abs(sum_pages-(case when modern then 220 else 190 end))<
          abs(chosen_pages-(case when modern then 220 else 190 end))) then
        chosen_size:=candidate_size;chosen_pages:=sum_pages;
      end if;
    end loop;
    if chosen_size is null then raise exception 'print_pagination_needs_revision';end if;
    if output is not null and output<>'null'::jsonb and (output->>'format' is distinct from 'layout-selection-v1'
      or output->'size' is distinct from to_jsonb(chosen_size) or output->'pageCount' is distinct from to_jsonb(chosen_pages)
      or output->>'fontFingerprint' is distinct from font or coalesce(output->>'plansHash','') !~ '^[a-f0-9]{64}$')
      then raise exception 'print_selection_receipt_mismatch';end if;
  end if;

  if key like 'selected:%' or (key like 'plan:%' and p_step->>'status'='completed' and exists(
    select 1 from public.future_book_print_steps where job_id=j.id and step_key=replace(key,'plan:','slice-count:')||':0')) then
    chapter:=split_part(key,':',2)::integer;size:=split_part(key,':',3)::numeric;
    mode:=case when key like 'selected:%' then 'geometry' else 'counts' end;
    prefix:=case when mode='geometry' then 'slice-geometry' else 'slice-count' end;
    total:=jsonb_array_length(j.source_snapshot->'sections'->chapter->'paragraphs');
    if mode='geometry' then
      select * into original from public.future_book_print_steps where job_id=j.id
        and step_key='plan:'||chapter||':'||size and status='completed' for share;
      if selection.job_id is null or original.job_id is null or selection.output->'size' is distinct from to_jsonb(size)
        then raise exception 'print_slice_chain';end if;
    end if;
    if p_step->>'status'='completed' then
      cursor:=0;last_output:=null;
      while cursor<total loop
        select * into link from public.future_book_print_steps where job_id=j.id
          and step_key=prefix||':'||chapter||':'||size||':'||cursor and status='completed' for share;
        if link.job_id is null or link.output->'startParagraph' is distinct from to_jsonb(cursor)
          or link.output->'previousSha256' is distinct from coalesce(last_output->'sha256','null'::jsonb)
          or link.output->'startState' is distinct from coalesce(last_output->'state','null'::jsonb)
          or link.output->>'sourceFingerprint' is distinct from j.source_sha256
          or link.output->>'fontFingerprint' is distinct from output->>'fontFingerprint'
          or coalesce(link.output->>'endParagraph','') !~ '^[1-9][0-9]{0,8}$'
          then raise exception 'print_slice_chain';end if;
        end_at:=(link.output->>'endParagraph')::integer;
        if end_at<=cursor or end_at>total or link.output->'done' is distinct from to_jsonb(end_at=total)
          then raise exception 'print_slice_chain';end if;
        cursor:=end_at;last_output:=link.output;
      end loop;
      candidate:=output->'candidates'->0;count_pages:=(last_output->'state'->>'pageNumber')::integer-4;
      if output->>'template' is distinct from 'caronte-a5-embedded-v2' or output->>'stagesVersion' is distinct from j.stages_version
        or output->>'sourceFingerprint' is distinct from j.source_sha256 or coalesce(output->>'sha256','') !~ '^[a-f0-9]{64}$'
        or output->'chapterIndex' is distinct from to_jsonb(chapter) or jsonb_typeof(output->'candidates') is distinct from 'array'
        or candidate->'size' is distinct from to_jsonb(size) or candidate->'paragraphCount' is distinct from to_jsonb(total)
        then raise exception 'print_slice_receipt_mismatch';end if;
      if jsonb_array_length(output->'candidates')<>1 or count_pages<2 or count_pages%2<>0
        then raise exception 'print_slice_receipt_mismatch';end if;
      if mode='counts' then
        if output->>'format' is distinct from 'chapter-counts-v1' or candidate ? 'pages'
          or candidate->'pageCount' is distinct from to_jsonb(count_pages) then raise exception 'print_slice_receipt_mismatch';end if;
      else
        if output ? 'format' or jsonb_typeof(candidate->'pages') is distinct from 'array'
          or output->>'fontFingerprint' is distinct from selection.output->>'fontFingerprint'
          or candidate->'leading' is distinct from original.output->'candidates'->0->'leading'
          then raise exception 'print_slice_receipt_mismatch';end if;
        if jsonb_array_length(candidate->'pages')<>count_pages or count_pages is distinct from coalesce(
          (original.output->'candidates'->0->>'pageCount')::integer,jsonb_array_length(original.output->'candidates'->0->'pages'))
          then raise exception 'print_slice_receipt_mismatch';end if;
      end if;
    end if;
  end if;

  if key='compose' and selection.job_id is not null then
    for chapter_at in 0..4 loop
      if not exists(select 1 from public.future_book_print_steps where job_id=j.id and status='completed'
        and step_key='selected:'||chapter_at||':'||trim_scale((selection.output->>'size')::numeric))
        then raise exception 'print_slice_chain';end if;
    end loop;
  end if;
  -- Legacy compact caches remain valid, and never replace the original plan.
  if key like 'geometry:%' and p_step->>'status'='completed' then
    select * into original from public.future_book_print_steps where job_id=j.id
      and step_key=replace(key,'geometry:','plan:') and status='completed' for share;
    if original.job_id is null or jsonb_typeof(original.output->'candidates'->0->'pages') is distinct from 'array'
      or output->>'format' is distinct from 'chapter-counts-v1'
      or output->>'originalPlanKey' is distinct from original.step_key or output->>'originalPlanHash' is distinct from original.output_hash
      or output->>'sourceFingerprint' is distinct from j.source_sha256
      or output->>'fontFingerprint' is distinct from original.output->>'fontFingerprint'
      or (output->'candidates'->0->>'pageCount')::integer is distinct from jsonb_array_length(original.output->'candidates'->0->'pages')
      or output->'candidates'->0->'size' is distinct from original.output->'candidates'->0->'size'
      or output->'candidates'->0->'leading' is distinct from original.output->'candidates'->0->'leading'
      or output->'candidates'->0->'paragraphCount' is distinct from original.output->'candidates'->0->'paragraphCount'
      then raise exception 'print_geometry_receipt_mismatch';end if;
  end if;
  if p_step->>'status'='completed' and p_step->>'stage' in ('part','interior','cover')
    and output->>'storage_verified' is distinct from 'true' then raise exception 'print_step_contract';end if;
  insert into public.future_book_print_steps(job_id,step_key,stage,status,attempt,input_hash,output,output_hash,error_code)
    values(p_job_id,key,p_step->>'stage',p_step->>'status',(p_step->>'attempt')::integer,
      p_step->>'input_hash',output,p_step->>'output_hash',p_step->>'error_code')
    on conflict(job_id,step_key) do update set status=excluded.status,attempt=excluded.attempt,
      input_hash=excluded.input_hash,output=excluded.output,output_hash=excluded.output_hash,error_code=excluded.error_code,
      history=future_book_print_steps.history||jsonb_build_array(jsonb_build_object('at',now(),
        'status',future_book_print_steps.status,'attempt',future_book_print_steps.attempt,
        'output_hash',future_book_print_steps.output_hash,'error_code',future_book_print_steps.error_code)),updated_at=now();
  update public.future_book_print_jobs set status=p_state,stage=p_step->>'stage',error_code=p_step->>'error_code',
    lease_token=case when p_state='running' then lease_token else null end,
    lease_until=case when p_state='running' then lease_until else null end,
    next_run_at=now()+make_interval(secs=>greatest(0,least(p_delay_seconds,3600))),updated_at=now() where id=p_job_id;
  return true;
end;$$;
revoke all on function public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.caronte_checkpoint_print_job(uuid,uuid,jsonb,text,integer) to service_role;
